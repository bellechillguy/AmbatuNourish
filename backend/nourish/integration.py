"""HTTP boundary for partner traffic. Run on an integration host outside the STB."""

import hmac
import os
import re
from http import HTTPStatus
from urllib.parse import parse_qs

from .api import Application
from .common import ApiError, array, encode, identifier, invalid, missing, number, obj, pending, text
from .partner_http import JsonPartnerHttp, invalid_response, partner_error, unauthorized


def credentials(body):
    email = text(body.get('email'), 'email', maximum=128)
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise invalid('email', 'Masukkan alamat email yang valid.')
    password = body.get('password')
    if not isinstance(password, str) or not 6 <= len(password) <= 256:
        raise invalid('password', 'Masukkan kata sandi akun AmbatuFit.')
    return {'email': email, 'password': password}


def user_profile(raw):
    raw = obj(raw)
    email = text(raw.get('email'), 'email', maximum=128)
    # UserDTO AmbatuFit belum menyediakan nama tampilan.
    return {'id': identifier(raw.get('id')), 'email': email, 'name': email.split('@', 1)[0] or email}


def food_summary(raw):
    raw = obj(raw)
    return {'id': identifier(raw.get('id')), 'name': text(raw.get('name'), 'name', maximum=150),
            'region': text(raw.get('region'), 'region', maximum=100)}


def food_variant(raw):
    raw = obj(raw)
    nutrients = raw.get('nutrition')
    if nutrients is not None:
        nutrients = {text(key, 'nutrition', maximum=120): number(value, 'nutrition', maximum=1e15)
                     for key, value in obj(nutrients, 'nutrition').items()}
    return {
        'id': text(raw.get('id'), 'id', maximum=80),
        'name': text(raw.get('name'), 'name', maximum=100),
        'portionQuantity': number(raw.get('portion_quantity'), 'portion_quantity', minimum=0.000001),
        'portionUnit': text(raw.get('portion_unit'), 'portion_unit', maximum=40),
        'source': text(raw.get('source'), 'source', maximum=300),
        'nutrition': nutrients or None,
    }


class IntegrationApplication:
    def __init__(self, key, fit, eat):
        self.key = key.encode()
        self.fit = fit
        self.eat = eat

    def identity(self, raw, *, token=None, body=None):
        if not self.fit:
            raise pending()
        login = body is not None
        status, reply = self.fit.request(raw, method='POST' if login else 'GET', body=body, token=token)
        if status != 200:
            raise partner_error(status, forwards_identity=True)
        try:
            if login:
                reply = obj(reply)
                jwt = text(reply.get('access_token'), 'access_token', maximum=4096)
                if reply.get('token_type', 'bearer').lower() != 'bearer' or not re.fullmatch(r'[\w.~-]+', jwt, re.ASCII):
                    raise invalid_response()
                return {'token': jwt, 'user': user_profile(reply.get('user'))}
            return user_profile(reply)
        except (ApiError, AttributeError):
            raise invalid_response() from None

    def regional_foods(self, query='', food_id=None):
        if not self.eat:
            raise pending()
        path = '/regional-foods'
        if food_id is not None:
            path += '/' + food_id
        status, reply = self.eat.request(path, query={'q': query} if query else None)
        if status != 200:
            raise partner_error(status, forwards_missing=food_id is not None)
        try:
            data = obj(reply).get('data')
            if food_id is None:
                return [food_summary(food) for food in array(data, 'data', 0, 100)]
            food = food_summary(data)
            if food['id'] != food_id:
                raise invalid_response()
            return {**food, 'story': text(data.get('story'), 'story', maximum=5000),
                    'variants': [food_variant(item) for item in array(data.get('variants'), 'variants', 1, 20)]}
        except ApiError:
            raise invalid_response() from None

    def dispatch(self, environ):
        method, path = environ['REQUEST_METHOD'], environ['PATH_INFO']
        if method == 'GET' and path == '/health':
            return {'status': 'ok'}
        presented = environ.get('HTTP_X_INTEGRATION_KEY', '').encode()
        if not hmac.compare_digest(presented, self.key):
            raise ApiError(403, 'INTEGRATION_FORBIDDEN', 'Akses integrasi ditolak.')
        if method == 'POST' and path == '/identity/login':
            return self.identity('/auth/login', body=credentials(Application.parse_body(environ)))
        if method == 'GET' and path == '/identity/me':
            scheme, _, token = environ.get('HTTP_AUTHORIZATION', '').partition(' ')
            if scheme.lower() != 'bearer' or not re.fullmatch(r'[\w.~-]{1,4096}', token, re.ASCII):
                raise unauthorized()
            return self.identity('/auth/me', token=token)
        if method == 'GET' and path == '/regional-foods':
            try:
                value = parse_qs(environ.get('QUERY_STRING', ''), max_num_fields=8).get('q', [''])[-1]
            except ValueError:
                raise invalid('q') from None
            return self.regional_foods(text(value.strip(), 'q', maximum=120, optional=True) or '')
        if method == 'GET' and path.startswith('/regional-foods/'):
            return self.regional_foods(food_id=identifier(path.removeprefix('/regional-foods/')))
        raise missing()

    def __call__(self, environ, start_response):
        try:
            payload, status = self.dispatch(environ), 200
            body = encode(payload).encode()
        except ApiError as e:
            status = e.status
            body = encode({'code': e.code, 'message': str(e)}).encode()
        except (ValueError, UnicodeError):
            error = invalid_response()
            status = error.status
            body = encode({'code': error.code, 'message': str(error)}).encode()
        start_response(f'{status} {HTTPStatus(status).phrase}', [
            ('Content-Type', 'application/json; charset=utf-8'),
            ('Content-Length', str(len(body))),
            ('Cache-Control', 'no-store'),
        ])
        return [body]


def create_app():
    key = os.getenv('NOURISH_INTEGRATION_API_KEY', '')
    if not key:
        raise ValueError('NOURISH_INTEGRATION_API_KEY wajib diisi.')
    fit_url = os.getenv('AMBATUFIT_BASE_URL')
    eat_url = os.getenv('AMBATUEAT_BASE_URL')
    eat_key = os.getenv('AMBATUEAT_API_KEY')
    return IntegrationApplication(
        key, JsonPartnerHttp(fit_url) if fit_url else None,
        JsonPartnerHttp(eat_url, {'X-API-Key': eat_key}) if eat_url and eat_key else None,
    )
