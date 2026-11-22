import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from wsgiref.util import setup_testing_defaults

from nourish.api import Application
from nourish.db import Database
from nourish.integration import IntegrationApplication
from nourish.partner_http import IntegrationClient
from nourish.partners import Ambatueat, Ambatufit, SharedIdentity


USER = {'id': 'fit-user-1', 'email': 'sari@example.test', 'role': 'patient'}
FOOD = {
    'id': 'gudeg-1', 'name': 'Gudeg', 'region': 'Yogyakarta', 'story': 'Hidangan dari nangka muda.',
    'variants': [{
        'id': 'v1', 'name': 'Porsi kering', 'portion_quantity': 1, 'portion_unit': 'porsi',
        'source': 'Sumber contoh', 'nutrition': {'energy_kcal': 250},
    }, {
        'id': 'v2', 'name': 'Porsi basah', 'portion_quantity': 1, 'portion_unit': 'porsi',
        'source': 'Sumber contoh', 'nutrition': None,
    }],
}


def call(app, path, *, method='GET', body=None, token=None, key=None):
    url = urlsplit(path)
    payload = json.dumps(body).encode() if body is not None else b''
    env = {}
    setup_testing_defaults(env)
    env.update(REQUEST_METHOD=method, PATH_INFO=url.path, QUERY_STRING=url.query,
               CONTENT_LENGTH=str(len(payload)), CONTENT_TYPE='application/json')
    env['wsgi.input'] = io.BytesIO(payload)
    if token:
        env['HTTP_AUTHORIZATION'] = 'Bearer ' + token
    if key:
        env['HTTP_X_INTEGRATION_KEY'] = key
    statuses = []
    response = b''.join(app(env, lambda status, _: statuses.append(int(status.split()[0]))))
    return statuses[0], json.loads(response) if response else None


class StubProvider:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def request(self, path, **options):
        self.calls.append((path, options))
        return self.responses[path]


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.fit = StubProvider({
            '/auth/login': (200, {'access_token': 'test.jwt.token', 'token_type': 'bearer', 'user': USER}),
            '/auth/me': (200, USER),
        })
        self.eat = StubProvider({
            '/regional-foods': (200, {'data': [FOOD]}),
            '/regional-foods/gudeg-1': (200, {'data': FOOD}),
        })
        self.bridge = IntegrationApplication('service-only-key', self.fit, self.eat)
        client = IntegrationClient('http://127.0.0.1:8090', 'service-only-key')
        client.http.request = lambda path, query=None, **opts: call(
            self.bridge, path + ('?' + urlencode(query) if query else ''),
            key=client.http.headers['X-Integration-Key'], **opts,
        )
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        db = Database(Path(temp.name) / 'test.sqlite3')
        self.app = Application(db, SharedIdentity(client), None, Ambatufit(), Ambatueat(), integration=client)

    def test_ambatufit_login_and_authenticated_profile(self):
        body = {'email': USER['email'], 'password': 'TestOnly123', 'name': 'do not forward'}
        status, session = call(self.app, '/api/v1/auth/login', method='POST', body=body)
        self.assertEqual(status, 200)
        self.assertEqual(session, {'token': 'test.jwt.token',
                                   'user': {'id': USER['id'], 'name': 'sari', 'email': USER['email']}})
        self.assertEqual(self.fit.calls[-1][1]['body'], {'email': USER['email'], 'password': 'TestOnly123'})
        self.assertEqual(call(self.app, '/api/v1/auth/me', token=session['token']), (200, session['user']))
        self.assertEqual(self.fit.calls[-1][1]['token'], session['token'])
        self.fit.responses['/auth/me'] = (401, {})
        self.assertEqual(call(self.app, '/api/v1/auth/me', token=session['token'])[0], 401)

    def test_ambatueat_results_keep_provider_portions(self):
        self.assertEqual(call(self.app, '/api/v1/regional-foods')[0], 401)
        status, records = call(self.app, '/api/v1/regional-foods?q=gudeg', token='test.jwt.token')
        self.assertEqual(status, 200)
        self.assertEqual(records, [{'id': FOOD['id'], 'name': FOOD['name'], 'region': FOOD['region']}])
        self.assertEqual(self.eat.calls[-1], ('/regional-foods', {'query': {'q': 'gudeg'}}))
        status, detail = call(self.app, '/api/v1/regional-foods/gudeg-1', token='test.jwt.token')
        self.assertEqual(status, 200)
        self.assertEqual(detail['variants'][0]['nutrition'], {'energy_kcal': 250})
        self.assertEqual(detail['variants'][0]['portionUnit'], 'porsi')
        self.assertIsNone(detail['variants'][1]['nutrition'])
        self.assertEqual(call(self.app, '/api/v1/restaurants/locations?q=Yogyakarta', token='test.jwt.token')[0], 503)

    def test_integration_key_and_provider_errors(self):
        self.assertEqual(call(self.bridge, '/regional-foods', token='test.jwt.token')[0], 403)
        self.assertEqual(self.eat.calls, [])
        for result, expected_status, expected_code in [
            ((401, {}), 502, 'PARTNER_UNAVAILABLE'),
            ((200, {'data': {'invalid': True}}), 502, 'PARTNER_INVALID_RESPONSE'),
            ((504, {}), 504, 'PARTNER_TIMEOUT'),
        ]:
            self.eat.responses['/regional-foods'] = result
            status, error = call(self.app, '/api/v1/regional-foods', token='test.jwt.token')
            self.assertEqual((status, error['code']), (expected_status, expected_code))
        self.bridge.eat = None
        status, error = call(self.app, '/api/v1/regional-foods', token='test.jwt.token')
        self.assertEqual((status, error['code']), (503, 'CONTRACT_PENDING'))
