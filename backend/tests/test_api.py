import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from wsgiref.util import setup_testing_defaults

from nourish.api import Application
from nourish.catalog import Catalog
from nourish.common import ApiError
from nourish.db import Database
from nourish.dev_identity import DevIdentity
from nourish.open_food_facts import map_product
from nourish.partners import Ambatueat, Ambatufit, SharedIdentity


BARCODE = '1234567890123'
RAW_PRODUCT = {
    'code': BARCODE, 'product_name': 'Minuman Uji', 'quantity': '250 ml', 'serving_size': '50 ml',
    'ingredients_text': 'Air, apel, gandum', 'rev': 5,
    'nutrition': {'aggregated_set': {'per': '100ml', 'preparation': 'as_sold', 'nutrients': {
        'energy-kj': {'value': 418.4, 'unit': 'kJ'}, 'sugars': {'value': 10, 'unit': 'g'},
        'sodium': {'value': 0, 'unit': 'g'}, 'fat': {'value': 0.5, 'unit': 'g', 'modifier': '<'},
    }}},
}


class FakeOFF:
    def __init__(self):
        self.fail = False

    def lookup(self, barcode):
        if self.fail:
            raise ApiError(504, 'OFF_TIMEOUT', 'OFF timeout')
        return map_product(RAW_PRODUCT) if barcode == BARCODE else None

    def search(self, query):
        return [map_product(RAW_PRODUCT)] if query.lower() in RAW_PRODUCT['product_name'].lower() else []


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        db = self.db = Database(root / 'core.sqlite3')
        self.off = FakeOFF()
        self.catalog = Catalog(db, self.off, 3600)
        self.app = Application(db, DevIdentity(root / 'dev.sqlite3'), self.catalog, Ambatufit(), Ambatueat(), 'test-key')
        self.token = self.register('sari')
        self.other = self.register('budi')

    def call(self, method, path, expected, body=None, token=None, partner=None):
        raw = json.dumps(body).encode() if body is not None else b''
        uri = urlsplit('/api' + path)
        env = {}
        setup_testing_defaults(env)
        env.update(REQUEST_METHOD=method, PATH_INFO=uri.path, QUERY_STRING=uri.query, CONTENT_LENGTH=str(len(raw)),
                   CONTENT_TYPE='application/json')
        env['wsgi.input'] = io.BytesIO(raw)
        env['HTTP_AUTHORIZATION'] = 'Bearer ' + token if token else ''
        env['HTTP_X_API_KEY'] = partner or ''
        response = {}

        def start(status, headers):
            response.update(status=int(status.split()[0]), headers=dict(headers))

        payload = b''.join(self.app(env, start))
        self.assertIn('X-Request-ID', response['headers'])
        self.assertEqual(response['status'], expected, payload)
        return json.loads(payload) if payload else None

    def register(self, name):
        session = self.call('POST', '/auth/register', 201, {'name': name, 'email': f'{name}@example.test', 'password': 'Password123'})
        return session['token']

    def create_product(self, body=None):
        return self.call('POST', '/manual-products', 201, body or {
            'name': 'Oat uji', 'basis': 'MASS', 'barcode': BARCODE,
            'nutrientsPer100': {'energy': 100, 'sugar': 8, 'sodium': 0},
        }, self.token)

    def push(self, *ops, token=None):
        return self.call('POST', '/sync', 200, {'operations': list(ops)}, token or self.token)

    @staticmethod
    def operation(op_id, kind, entity_id, payload, *, op='CREATE', base=0):
        return {'opId': op_id, 'entityType': kind, 'entityId': entity_id, 'op': op,
                'baseVersion': base, 'payload': payload}

    def test_login_profile_logout_and_missing_identity_contract(self):
        self.call('GET', '/health', 200)
        self.call('GET', '/products', 401)
        self.call('POST', '/auth/login', 401, {'email': 'sari@example.test', 'password': 'wrong'})
        session = self.call('POST', '/auth/login', 200, {'email': 'sari@example.test', 'password': 'Password123'})
        self.assertEqual(self.call('GET', '/auth/me', 200, token=session['token']), session['user'])
        self.assertEqual(self.call('PATCH', '/auth/me', 200, {'name': 'Nama baru', 'id': 'ignored'}, session['token'])['name'], 'Nama baru')
        self.call('POST', '/auth/logout', 204, token=session['token'])
        self.call('GET', '/auth/me', 401, token=session['token'])
        expected = self.call('POST', '/auth/reset-password', 503, {'email': 'sari@example.test'})
        self.assertEqual(expected['code'], 'CONTRACT_PENDING')
        self.app.identity = SharedIdentity()
        self.call('GET', '/auth/me', 503, token=self.token)

    def test_catalog_discovery_refresh_and_private_products(self):
        self.assertEqual(self.call('GET', '/products?q=minuman', 200, token=self.token), [])
        product, = self.call('GET', '/products?q=minuman&discover=1', 200, token=self.token)
        self.assertTrue(product['isStale'])
        looked_up = self.call('GET', '/products/barcode/' + BARCODE, 200, token=self.token)
        self.assertEqual(looked_up['id'], product['id'])
        self.assertEqual(looked_up['basis'], 'VOLUME')
        self.assertEqual(looked_up['serving']['quantity'], 50)
        self.assertAlmostEqual(looked_up['nutrientsPer100']['energy'], 100)
        self.assertEqual(looked_up['nutrientsPer100']['sodium'], 0)
        self.assertIsNone(looked_up['nutrientsPer100']['fat'])
        self.assertEqual(looked_up['provenance']['sourceVersion'], '5')
        manual = self.create_product()
        self.assertIsNone(manual['nutrientsPer100']['fat'])
        self.assertEqual(self.call('GET', '/products/barcode/' + BARCODE, 200, token=self.token)['id'], looked_up['id'])
        self.call('GET', '/products/' + manual['id'], 404, token=self.other)
        self.call('DELETE', '/manual-products/' + manual['id'], 404, token=self.other)
        self.assertEqual(self.call('GET', '/manual-products', 200, token=self.other), [])
        self.call('POST', '/manual-products', 422, {
            'name': 'Duplikat', 'basis': 'MASS', 'barcode': BARCODE,
        }, self.token)
        self.off.fail = True
        self.assertTrue(self.call('POST', f"/products/{product['id']}/refresh", 200, token=self.token)['isStale'])
        self.assertEqual(self.call('GET', '/products/barcode/0000000000000', 504, token=self.token)['code'], 'OFF_TIMEOUT')
        self.off.fail = False
        self.call('GET', '/products/barcode/0000000000000', 404, token=self.token)
        self.call('DELETE', '/manual-products/' + manual['id'], 204, token=self.token)

    def test_assessment_user_rules_and_partner_scope(self):
        product = self.create_product()
        body = {'productId': product['id'], 'portion': {'quantity': 50, 'unit': 'g'}}
        self.assertEqual(self.call('POST', '/assessment/product', 200, body, self.token)['outcome'], 'BELUM_DAPAT_DINILAI')
        self.call('PUT', '/preferences/sugar', 200, {'value': 4}, self.token)
        assessment = self.call('POST', '/assessment/product', 200, body, self.token)
        self.assertEqual(assessment['outcome'], 'COCOK')
        self.assertEqual(assessment['values']['sugar'], 4)
        self.call('PUT', '/preferences/ingredients', 200, {'ingredients': ['gandum']}, self.token)
        self.assertEqual(self.call('POST', '/assessment/product', 200, body, self.token)['outcome'], 'BELUM_DAPAT_DINILAI')
        body['portion']['quantity'] = 100
        assessment = self.call('POST', '/assessment/product', 200, body, self.token)
        self.assertEqual(assessment['outcome'], 'KURANG_COCOK')
        self.assertEqual({item['result'] for item in assessment['evidence']}, {'VIOLATED', 'UNKNOWN'})
        body['portion']['unit'] = 'ml'
        self.call('POST', '/assessment/product', 422, body, self.token)
        self.call('POST', '/assessment/compare', 404, {'productIds': [product['id']]}, self.other)
        self.call('GET', '/partner/v1/products/barcode/' + BARCODE, 401)
        partner = self.call('POST', '/partner/v1/assessment/product', 200, {
            'barcode': BARCODE, 'portion': {'quantity': 50, 'unit': 'ml'},
            'preferences': [{'id': 'ingredients', 'ingredients': ['gandum']}],
        }, partner='test-key')
        self.assertEqual(partner['outcome'], 'KURANG_COCOK')
        self.assertIsNone(self.call('GET', '/nutrition-plan', 200, token=self.token))
        self.assertEqual(self.call('GET', '/consumption/daily-targets', 200, token=self.token), {})

    def test_sync_offline_snapshot_daily_summary_and_conflicts(self):
        product = self.create_product()
        item = {'productId': product['id'], 'productName': product['name'], 'quantity': 50, 'unit': 'g', 'source': 'USER_ENTERED'}
        favorite = self.call('POST', '/favorites', 201, {'name': 'Sarapan', 'items': [item]}, self.token)
        self.assertEqual(favorite['totals']['energy'], 50)
        self.call('GET', '/favorites/' + favorite['id'], 404, token=self.other)
        plan = {'id': 'plan-1', 'date': '2024-08-03', 'slot': 'SARAPAN', 'title': favorite['name'],
                'favoriteId': favorite['id'], 'items': [item], 'version': 0, 'status': 'CONSUMED'}
        plan_op = self.operation('op-plan', 'MEAL_PLAN', plan['id'], plan)
        first, = self.push(plan_op)
        self.assertEqual(first, {'opId': 'op-plan', 'status': 'ACCEPTED', 'version': 1})
        self.assertEqual(self.push(plan_op), [first])
        planned, = self.call('GET', '/meal-plans?from=2024-08-01&to=2024-08-07', 200, token=self.token)
        self.assertEqual(planned['status'], 'PLANNED')
        self.call('POST', '/restaurants/search', 404, {'planId': plan['id'], 'location': {}}, self.other)
        self.assertEqual(self.call('POST', '/restaurants/search', 503, {'planId': plan['id'], 'location': {}},
                                   self.token)['code'], 'CONTRACT_PENDING')
        daily_path = '/consumption/daily-summary?date=2024-08-03&timezone=Asia%2FJakarta'
        self.assertEqual(self.call('GET', daily_path, 200, token=self.token)['recordCount'], 0)
        record = {'id': 'record-1', 'title': 'Sarapan', 'source': 'PLAN', 'planEntryId': plan['id'],
                  'consumedAt': '2024-08-02T22:00:00Z', 'quantity': 50, 'unit': 'g', 'itemsCount': 1,
                  'snapshot': {'energy': 50, 'sodium': 0}}
        record_op = self.operation('op-record', 'CONSUMPTION', record['id'], record)
        duplicate = self.operation('op-duplicate', 'CONSUMPTION', 'record-2', {**record, 'id': 'record-2'})
        result, rejected = self.push(record_op, duplicate)
        self.assertEqual(result['status'], 'ACCEPTED')
        self.assertEqual(rejected['status'], 'REJECTED')
        self.assertEqual(self.push(record_op), [result])
        self.call('PUT', '/manual-products/' + product['id'], 200, {'name': product['name'], 'basis': 'MASS',
                  'nutrientsPer100': {'energy': 150}}, self.token)
        pulled = self.call('GET', '/sync', 200, token=self.token)
        self.assertEqual(pulled['plans'][0]['status'], 'CONSUMED')
        self.assertEqual(pulled['records'][0]['snapshot']['energy'], 50)
        self.assertEqual(self.call('GET', '/sync', 200, token=self.other), {'plans': [], 'records': []})
        daily = self.call('GET', daily_path, 200, token=self.token)
        self.assertEqual(daily['totals']['energy'], 50)
        self.assertEqual(daily['missingCount']['sodium'], 0)
        self.assertEqual(daily['missingCount']['sugar'], 1)
        stale, = self.push(self.operation('stale', 'CONSUMPTION', record['id'], record, op='UPDATE'))
        self.assertEqual(stale['server']['version'], 1)
        self.assertEqual(stale['status'], 'CONFLICT')
        deleted, = self.push(self.operation('delete', 'CONSUMPTION', record['id'], None, op='DELETE', base=1))
        self.assertEqual(deleted['version'], 2)
        self.assertEqual(self.call('GET', '/sync', 200, token=self.token)['plans'][0]['status'], 'PLANNED')
        retry, = self.push(self.operation('stale-edit', 'CONSUMPTION', record['id'], record, op='UPDATE', base=1))
        self.assertTrue(retry['deleted'])
        restore, = self.push(self.operation('restore', 'CONSUMPTION', record['id'], record, op='UPDATE', base=2))
        self.assertEqual(restore['version'], 3)
        future = {**record, 'id': 'future', 'source': 'MANUAL', 'planEntryId': None,
                  'consumedAt': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}
        invalid, = self.push(self.operation('future', 'CONSUMPTION', 'future', future))
        self.assertEqual(invalid['status'], 'REJECTED')
        replay_with_changes, = self.push({**plan_op, 'payload': {**plan, 'title': 'Berubah'}})
        self.assertEqual(replay_with_changes['status'], 'REJECTED')


if __name__ == '__main__':
    unittest.main()
