import hmac
import json
import logging
import os
import re
from dataclasses import dataclass
from http import HTTPStatus
from pathlib import Path
from time import monotonic
from urllib.parse import parse_qs

from .assessment import AssessmentService, preference_input
from .catalog import Catalog
from .common import (ApiError, array, choice, date_key, encode, identifier, integer, invalid, missing,
                     new_id, obj, pending, text)
from .consumption import Consumption
from .db import Database
from .meals import Meals, items_input
from .openapi import API_BASE, DISCOVERY, SWAGGER_HTML, build_openapi, public_path
from .open_food_facts import OpenFoodFacts
from .partner_http import IntegrationClient
from .partners import Ambatueat, Ambatufit, SharedIdentity
from .sync import Sync


LOG = logging.getLogger('ambatunourish')
ID = r'(?P<id>[a-zA-Z0-9_-]{1,96})'
NO_CONTENT = (204, None)


@dataclass
class Request:
    method: str
    body: dict
    query: dict
    token: str
    owner: str = ''

    def page(self):
        value = self.query.get('page', '1')
        if not re.fullmatch(r'[0-9]{1,6}', value):
            raise invalid('page')
        return integer(int(value), 'page', minimum=1, maximum=100_000)


class Application:
    def __init__(self, db, identity, catalog, nutrition, restaurants, partner_key=None, *, integration=None):
        self.db = db
        self.identity = identity
        self.catalog = catalog
        self.nutrition = nutrition
        self.restaurants = restaurants
        self.partner_key = partner_key
        self.integration = integration
        self.assessment = AssessmentService(db, catalog, nutrition)
        self.meals = Meals(db, self.assessment)
        self.consumption = Consumption(db, self.meals, catalog, nutrition)
        self.sync = Sync(db, self.meals, self.consumption)
        self.routes = [
            ('GET', '/health', 'none', self.health),
            ('POST', '/auth/register', 'none', lambda req: (201, self.identity.register(req.body))),
            ('POST', '/auth/login', 'none', lambda req: self.identity.login(req.body)),
            ('POST', '/auth/reset-password', 'none', lambda req: self.no_content(self.identity.request_reset, req.body)),
            ('POST', '/auth/logout', 'token', lambda req: self.no_content(self.identity.logout, req.token)),
            ('GET', '/auth/me', 'token', lambda req: self.identity.profile(req.token)),
            ('PATCH', '/auth/me', 'token', lambda req: self.identity.update_profile(req.token, req.body)),
            ('GET', '/products', 'user', self.search),
            ('GET', f'/products/barcode/{ID}', 'user', lambda req, id: catalog.lookup_for_user(req.owner, id)),
            ('GET', f'/products/{ID}', 'user', lambda req, id: catalog.detail(req.owner, id)),
            ('POST', f'/products/{ID}/refresh', 'user', lambda req, id: catalog.detail(req.owner, id, refresh=True)),
            ('GET', '/regional-foods', 'user', self.regional_foods),
            ('GET', f'/regional-foods/{ID}', 'user', self.regional_food),
            ('GET', '/manual-products', 'user', lambda req: catalog.search(req.owner, '', 'USER_ENTERED', req.page())),
            ('POST', '/manual-products', 'user', lambda req: (201, catalog.save_manual(req.owner, req.body))),
            ('PUT', f'/manual-products/{ID}', 'user', lambda req, id: catalog.save_manual(req.owner, req.body, id)),
            ('DELETE', f'/manual-products/{ID}', 'user', lambda req, id: self.no_content(catalog.delete_manual, req.owner, id)),
            ('GET', '/preferences', 'user', lambda req: self.assessment.preferences(req.owner)),
            ('PUT', f'/preferences/{ID}', 'user', lambda req, id: self.assessment.save_preference(req.owner, id, req.body)),
            ('DELETE', f'/preferences/{ID}', 'user', lambda req, id: self.no_content(self.assessment.delete_preference, req.owner, id)),
            ('POST', '/assessment/product', 'user', lambda req: self.assessment.assess(req.owner, req.body)),
            ('POST', '/assessment/compare', 'user', lambda req: self.assessment.compare(req.owner, req.body)),
            ('POST', '/assessment/meal', 'user', self.assess_meal),
            ('GET', '/nutrition-plan', 'user', self.nutrition_plan),
            ('GET', '/nutrition-plan/conflicts', 'user', self.conflicts),
            ('GET', '/nutrition-plan/booking-offer', 'user', lambda req: nutrition.booking_offer(req.owner)),
            ('GET', '/favorites', 'user', lambda req: self.meals.list_favorites(req.owner, req.page())),
            ('POST', '/favorites', 'user', lambda req: (201, self.meals.save_favorite(req.owner, req.body))),
            ('GET', f'/favorites/{ID}', 'user', lambda req, id: self.meals.get_favorite(req.owner, id)),
            ('PUT', f'/favorites/{ID}', 'user', lambda req, id: self.meals.save_favorite(req.owner, req.body, id)),
            ('DELETE', f'/favorites/{ID}', 'user', lambda req, id: self.no_content(self.meals.delete_favorite, req.owner, id)),
            ('GET', '/meal-plans', 'user', self.schedule),
            ('POST', '/restaurants/search', 'user', self.find_restaurants),
            ('GET', '/restaurants/locations', 'user', self.suggest_locations),
            ('GET', '/consumption/daily-targets', 'user', lambda req: self.consumption.targets(req.owner)),
            ('GET', '/consumption/daily-summary', 'user', self.daily_summary),
            ('GET', '/sync', 'user', lambda req: self.sync.pull(req.owner)),
            ('POST', '/sync', 'user', lambda req: self.sync.push(req.owner, req.body)),
            ('GET', f'/partner/v1/products/barcode/{ID}', 'partner', lambda req, id: catalog.lookup(id)),
            ('POST', '/partner/v1/assessment/product', 'partner', self.partner_assessment),
        ]
        self.openapi = build_openapi(self.routes, ID)
        self.routes = [
            (method, re.compile(route), auth, handler)
            for method, path, auth, handler in self.routes
            for route in ('/api' + path, API_BASE + public_path(path))
        ]
        self.routes.extend([
            ('GET', re.compile('/health'), 'none', self.health),
            ('GET', re.compile(API_BASE + '/?'), 'none', lambda req: DISCOVERY),
            ('GET', re.compile('/docs/?'), 'none', lambda req: SWAGGER_HTML),
            ('GET', re.compile(r'/openapi\.json'), 'none', lambda req: self.openapi),
        ])

    @staticmethod
    def no_content(handler, *args):
        handler(*args)
        return NO_CONTENT

    def health(self, request):
        with self.db.connection() as conn:
            conn.execute('SELECT 1 FROM sync_operations LIMIT 1')
        return {'status': 'ok', 'service': 'ambatunourish', 'apiVersion': '1'}

    def search(self, req):
        query = text(req.query.get('q', '').strip(), 'q', maximum=120, optional=True) or ''
        source = choice(req.query.get('source', 'ALL'), 'source', ('ALL', 'USER_ENTERED', 'OPEN_FOOD_FACTS'))
        return self.catalog.search(req.owner, query, source, req.page(), discover=req.query.get('discover') == '1')

    def regional_foods(self, req):
        if not self.integration:
            raise pending()
        query = text(req.query.get('q', '').strip(), 'q', maximum=120, optional=True)
        return self.integration.request('/regional-foods', query={'q': query} if query else None)

    def regional_food(self, req, id):
        if not self.integration:
            raise pending()
        return self.integration.request('/regional-foods/' + id, detail=True)

    def assess_meal(self, req):
        items = items_input(req.body.get('items'))
        plan = self.assessment.plan(req.owner)
        with self.db.connection(read_transaction=True) as conn:
            values, assessment = self.assessment.meal_assessment(
                conn, req.owner, items, self.assessment.preferences(req.owner, conn), plan, strict=True)
        return {**assessment, 'values': values}

    def nutrition_plan(self, req):
        plan = self.assessment.plan(req.owner)
        return plan.display if plan else None

    def conflicts(self, req):
        plan = self.assessment.plan(req.owner)
        return list(plan.conflicts) if plan else []

    def schedule(self, req):
        start = date_key(req.query['from'], 'from') if 'from' in req.query else None
        end = date_key(req.query['to'], 'to') if 'to' in req.query else None
        if start and end and start > end:
            raise invalid('to')
        return self.sync.pull(req.owner, start, end)['plans']

    def daily_summary(self, req):
        timezone = text(req.query.get('timezone'), 'timezone', maximum=100)
        return self.consumption.summary(req.owner, req.query.get('date'), timezone)

    def find_restaurants(self, req):
        plan_id = identifier(req.body.get('planId'), 'planId')
        with self.db.connection() as conn:
            plan = self.meals.active_plan(conn, req.owner, plan_id)
        # to do: konfirmasi penggunaan GPS atau lokasi manual sebelum meneruskan ke Ambatueat.
        return self.restaurants.find(req.owner, plan, obj(req.body.get('location'), 'location'))

    def suggest_locations(self, req):
        query = text(req.query.get('q', '').strip(), 'q', maximum=160, optional=True)
        return self.restaurants.suggest(req.owner, query) if query else []

    def partner_assessment(self, req):
        product = self.catalog.lookup(req.body.get('barcode'))
        serving = self.assessment.product_portion(product, req.body.get('portion'))
        rules = []
        for rule in array(req.body.get('preferences', []), 'preferences', 0, 3):
            rule = obj(rule, 'preferences')
            rules.append(preference_input(identifier(rule.get('id')), rule))
        if len({rule['id'] for rule in rules}) != len(rules):
            raise invalid('preferences')
        return self.assessment.assess_product(product, serving, rules)

    @staticmethod
    def parse_body(environ):
        size = environ.get('CONTENT_LENGTH', '') or '0'
        if not size.isascii() or not size.isdigit() or len(size) > 10:
            raise invalid('body')
        size = int(size)
        if size > 1_048_576:
            raise ApiError(413, 'BODY_TOO_LARGE', 'Ukuran permintaan melebihi batas.')
        if not size:
            return {}
        if environ.get('CONTENT_TYPE', '').partition(';')[0].strip().lower() != 'application/json':
            raise ApiError(415, 'CONTENT_TYPE', 'Gunakan application/json.')
        def reject_constant(value):
            raise ValueError(value)
        try:
            body = obj(json.loads(environ['wsgi.input'].read(size).decode('utf-8'), parse_constant=reject_constant))
            # Validasi Unicode dan bilangan JSON sekali sebelum dipakai atau disimpan.
            encode(body).encode('utf-8')
            return body
        except (ValueError, UnicodeError, RecursionError):
            raise invalid('body', 'JSON tidak valid.') from None

    def __call__(self, environ, start_response):
        start = monotonic()
        request_id = environ.get('HTTP_X_REQUEST_ID', '')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,96}', request_id):
            request_id = new_id()
        route_name, error_code = 'unmatched', None
        try:
            method, path = environ['REQUEST_METHOD'], environ['PATH_INFO']
            allowed = []
            for expected, route, auth, handler in self.routes:
                match = route.fullmatch(path)
                if not match:
                    continue
                allowed.append(expected)
                if expected != method:
                    continue
                route_name = route.pattern
                header = environ.get('HTTP_AUTHORIZATION', '')
                scheme, _, credential = header.partition(' ')
                token = credential if scheme.lower() == 'bearer' else ''
                owner = ''
                if auth in ('user', 'token') and not token:
                    raise ApiError(401, 'UNAUTHORIZED', 'Bearer token diperlukan.')
                if auth == 'user':
                    owner = self.identity.profile(token)['id']
                if auth == 'partner':
                    key = environ.get('HTTP_X_API_KEY', '').encode('utf-8')
                    if not self.partner_key or not hmac.compare_digest(key, self.partner_key.encode('utf-8')):
                        raise ApiError(401, 'UNAUTHORIZED', 'API key tidak valid atau belum diaktifkan.')
                try:
                    query = dict(parse_qs(environ.get('QUERY_STRING', ''), max_num_fields=20))
                except ValueError:
                    raise invalid('query') from None
                req = Request(method, self.parse_body(environ), {key: values[-1] for key, values in query.items()}, token, owner)
                result = handler(req, **match.groupdict())
                status, data = result if isinstance(result, tuple) else (200, result)
                break
            else:
                if allowed:
                    raise ApiError(405, 'METHOD_NOT_ALLOWED', 'Metode HTTP tidak tersedia.')
                raise missing()
        except ApiError as error:
            status, error_code = error.status, error.code
            data = {'status': status, 'code': error_code, 'message': str(error)}
            if error.field:
                data['data'] = {error.field: {'message': str(error)}}
        except Exception:
            LOG.exception('Unhandled error request_id=%s route=%s', request_id, route_name)
            status, error_code = 500, 'SERVER'
            data = {'status': status, 'code': error_code, 'message': 'Gangguan pada server.'}

        entry = {'requestId': request_id, 'route': route_name, 'status': status,
                 'durationMs': round((monotonic() - start) * 1000)}
        if error_code:
            entry['code'] = error_code
        if status == 200 and route_name in ('/api/sync', API_BASE + '/sync') and isinstance(data, list):
            entry['results'] = {key: sum(item['status'] == key for item in data)
                                for key in ('ACCEPTED', 'REJECTED', 'CONFLICT', 'RETRYABLE')}
        LOG.info(encode(entry))
        if isinstance(data, bytes):
            response, content_type = data, 'text/html; charset=utf-8'
        else:
            response = b'' if status == 204 else encode(data).encode()
            content_type = 'application/json; charset=utf-8'
        headers = [('Content-Type', content_type), ('Content-Length', str(len(response))),
                   ('X-Request-ID', request_id), ('Cache-Control', 'no-store')]
        if status == 405:
            headers.append(('Allow', ', '.join(allowed)))
        start_response(f'{status} {HTTPStatus(status).phrase}', headers)
        return [response]


def create_app():
    folder = Path(os.getenv('NOURISH_DATA_DIR', './data'))
    db = Database(folder / 'nourish.sqlite3')
    integration_url = os.getenv('NOURISH_INTEGRATION_BASE_URL')
    integration_key = os.getenv('NOURISH_INTEGRATION_API_KEY')
    if bool(integration_url) != bool(integration_key):
        raise ValueError('Isi NOURISH_INTEGRATION_BASE_URL dan NOURISH_INTEGRATION_API_KEY bersamaan.')
    integration = IntegrationClient(integration_url, integration_key) if integration_url else None
    identity = SharedIdentity(integration)
    if os.getenv('NOURISH_DEV_AUTH') == '1':
        from .dev_identity import DevIdentity
        identity = DevIdentity(folder / 'dev-identity.sqlite3')
    provider = OpenFoodFacts(os.getenv('OFF_ORIGIN', 'https://world.openfoodfacts.org'),
                             os.getenv('OFF_USER_AGENT', 'AmbatuNourish/0.1 (development)'),
                             float(os.getenv('OFF_TIMEOUT_SECONDS', '4')))
    ttl = os.getenv('OFF_CACHE_TTL_SECONDS')
    catalog = Catalog(db, provider, int(ttl) if ttl else None)
    return Application(db, identity, catalog, Ambatufit(), Ambatueat(), os.getenv('NOURISH_PARTNER_API_KEY'),
                       integration=integration)
