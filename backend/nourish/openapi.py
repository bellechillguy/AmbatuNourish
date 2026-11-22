from .api_schemas import BARCODE, DATE, EMAIL, ID_SCHEMA, SCHEMAS, STRING, enum, fields, many, ref


API_BASE = '/api/v1'
DISCOVERY = {
    'service': 'ambatunourish', 'apiVersion': '1', 'baseUrl': API_BASE,
    'docs': '/docs', 'openapi': '/openapi.json', 'health': '/health',
}

SWAGGER_HTML = b'''<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AmbatuNourish API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1/swagger-ui.css"
        integrity="sha384-4c3vsE5f+trhFyHrFrLM1fFGUn531NIaC7dcqEWIJdoRQJ5CkJbSuSCwXLpaS1KF" crossorigin="anonymous">
</head>
<body>
  <div id="swagger-ui"></div>
  <noscript><a href="/openapi.json">Buka spesifikasi OpenAPI AmbatuNourish</a></noscript>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1/swagger-ui-bundle.js"
          integrity="sha384-XFYN47VzPiDY6qPtxYKg0nqUeW/upo20xf1j2SUE7gT/i35FJB4cuS/71Iegzk8Z" crossorigin="anonymous"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json', dom_id: '#swagger-ui', deepLinking: true,
      validatorUrl: null, persistAuthorization: false
    });
  </script>
</body>
</html>'''


def public_path(path):
    if path.startswith('/partner/v1/'):
        return path.replace('/partner/v1/', '/partner/', 1)
    return path


def parameter(name, schema, *, location='query', required=False, description=None):
    value = {'name': name, 'in': location, 'required': required, 'schema': schema}
    if description:
        value['description'] = description
    return value


PAGE = parameter('page', {'type': 'integer', 'minimum': 1, 'maximum': 100_000, 'default': 1})
Q = parameter('q', {'type': 'string', 'maxLength': 120})
PRODUCTS = many(ref('Product'))
FAVORITES = many(ref('Favorite'))
ITEMS = fields({'items': many(ref('MealItem'), minItems=1, maxItems=30)}, 'items')
PLAN_PENDING = 'Kontrak Ambatufit masih ditunggu.'
IDENTITY_PENDING = 'Login dan registrasi tersedia pada mode development. Identity & Access Ambatufit masih ditunggu.'
RESTAURANT_PENDING = 'Kontrak lokasi dan menu Ambatueat masih ditunggu.'
CATALOG_ERRORS = (404, 429, 502, 503, 504)
JSON = 'application/json'
ERROR_MESSAGES = {
    401: 'Bearer token atau API key diperlukan dan harus valid.',
    404: 'Data tidak ditemukan dalam cakupan pemanggil.',
    405: 'Metode HTTP tidak tersedia.',
    413: 'Ukuran permintaan melebihi 1 MiB.',
    415: 'Body harus menggunakan application/json.',
    422: 'Nilai permintaan tidak valid.',
    429: 'Batas permintaan terlampaui.',
    502: 'Open Food Facts tidak dapat digunakan atau mengembalikan data tidak valid.',
    503: 'Kontrak mitra belum tersedia atau Open Food Facts membatasi permintaan.',
    504: 'Permintaan ke Open Food Facts melewati batas waktu.',
}


def json_body(schema, example=None):
    content = {'schema': schema}
    if example is not None:
        content['example'] = example
    return {JSON: content}


def error_response(status):
    response = {'description': ERROR_MESSAGES[status], 'content': json_body(ref('Error'))}
    if status in (413, 429):
        response['content']['text/html'] = {'schema': STRING}
    return response


def operation(summary, schema=None, *, status=200, body=None, example=None, query=(), errors=(), description=None):
    responses = {str(status): {'description': 'Berhasil' if status != 204 else 'Berhasil tanpa body.'}}
    if schema is not None:
        responses[str(status)]['content'] = json_body(schema)
    responses.update({str(code): error_response(code) for code in errors})
    spec = {'summary': summary, 'responses': responses}
    if query:
        spec['parameters'] = list(query)
    if body is not None:
        spec['requestBody'] = {'required': True, 'content': json_body(body, example)}
    if description:
        spec['description'] = description
    return spec


OPERATIONS = {
    ('GET', '/health'): operation('Periksa kesiapan API dan SQLite', ref('Health')),
    ('POST', '/auth/register'): operation('Buat akun', ref('Session'), status=201, body=ref('Register'),
                                         errors=(429, 503), description=IDENTITY_PENDING),
    ('POST', '/auth/login'): operation('Masuk dan ambil token sesi', ref('Session'), body=ref('Login'),
                                      errors=(401, 429, 503), description=IDENTITY_PENDING),
    ('POST', '/auth/reset-password'): operation('Minta reset kata sandi', body=fields({'email': EMAIL}, 'email'),
                                               status=503, errors=(429, 503), description=PLAN_PENDING),
    ('POST', '/auth/logout'): operation('Akhiri sesi', status=204),
    ('GET', '/auth/me'): operation('Ambil profil pengguna', ref('Profile')),
    ('PATCH', '/auth/me'): operation('Ubah nama pengguna', ref('Profile'), body=fields({'name': STRING}, 'name')),
    ('GET', '/products'): operation('Cari produk pangan', PRODUCTS, query=(
        Q, PAGE, parameter('source', enum('ALL', 'OPEN_FOOD_FACTS', 'USER_ENTERED')),
        parameter('discover', enum('0', '1'), description='Kirim 1 untuk mencari ke Open Food Facts bila katalog lokal kosong.'),
    ), errors=(422, *CATALOG_ERRORS[1:]), description='Mengembalikan sampai 30 produk per halaman.'),
    ('GET', '/products/barcode/{barcode}'): operation('Cari produk dari barcode', ref('Product'), errors=CATALOG_ERRORS),
    ('GET', '/products/{id}'): operation('Ambil detail produk', ref('Product'), errors=CATALOG_ERRORS),
    ('POST', '/products/{id}/refresh'): operation('Segarkan detail produk', ref('Product'), errors=CATALOG_ERRORS),
    ('GET', '/manual-products'): operation('Daftar produk pribadi', PRODUCTS, query=(PAGE,), errors=(422,),
                                           description='Mengembalikan sampai 30 produk per halaman.'),
    ('POST', '/manual-products'): operation('Simpan produk pribadi', ref('Product'), status=201, body=ref('ManualProductInput'),
                                            example={'name': 'Oat', 'basis': 'MASS', 'nutrientsPer100': {'energy': 100, 'sodium': 0}}),
    ('PUT', '/manual-products/{id}'): operation('Ubah produk pribadi', ref('Product'), body=ref('ManualProductInput'), errors=(404,)),
    ('DELETE', '/manual-products/{id}'): operation('Hapus produk pribadi', status=204, errors=(404,)),
    ('GET', '/preferences'): operation('Ambil preferensi gizi pengguna', many(ref('Preference'))),
    ('PUT', '/preferences/{id}'): operation('Atur preferensi gizi', ref('Preference'), body=ref('PreferenceUpdate'), errors=(404,)),
    ('DELETE', '/preferences/{id}'): operation('Kosongkan preferensi gizi', status=204, errors=(404,)),
    ('POST', '/assessment/product'): operation('Nilai produk untuk satu porsi', ref('ProductAssessment'),
        body=fields({'productId': ID_SCHEMA, 'portion': ref('Portion')}, 'productId', 'portion'), errors=(404,)),
    ('POST', '/assessment/meal'): operation('Nilai hidangan', ref('MealAssessment'), body=ITEMS, errors=(404,)),
    ('POST', '/assessment/compare'): operation('Bandingkan maksimal tiga produk', many(ref('ComparisonColumn')),
        body=fields({'productIds': many(ID_SCHEMA, minItems=1, maxItems=3, uniqueItems=True), 'portion': ref('Portion')}, 'productIds'),
        errors=(404,)),
    ('GET', '/nutrition-plan'): operation('Ambil Nutrition Plan', {'type': 'null'}, description=PLAN_PENDING),
    ('GET', '/nutrition-plan/conflicts'): operation('Periksa konflik Nutrition Plan', many({'type': 'object'}, maxItems=0),
                                                    description=PLAN_PENDING),
    ('GET', '/nutrition-plan/booking-offer'): operation('Periksa penawaran konsultasi', {'type': 'null'}, description=PLAN_PENDING),
    ('GET', '/favorites'): operation('Daftar hidangan favorit', FAVORITES, query=(PAGE,), errors=(422,),
                                     description='Mengembalikan sampai 50 hidangan per halaman.'),
    ('POST', '/favorites'): operation('Simpan hidangan favorit', ref('Favorite'), status=201, body=ref('FavoriteInput'), errors=(404,)),
    ('GET', '/favorites/{id}'): operation('Ambil hidangan favorit', ref('Favorite'), errors=(404,)),
    ('PUT', '/favorites/{id}'): operation('Ubah hidangan favorit', ref('Favorite'), body=ref('FavoriteInput'), errors=(404,)),
    ('DELETE', '/favorites/{id}'): operation('Hapus hidangan favorit', status=204, errors=(404,)),
    ('GET', '/meal-plans'): operation('Daftar jadwal makan', many(ref('MealPlan')),
                                     query=(parameter('from', DATE), parameter('to', DATE)), errors=(422,)),
    ('GET', '/consumption/daily-targets'): operation('Ambil target gizi harian', ref('DailyTargets'), description=PLAN_PENDING),
    ('GET', '/consumption/daily-summary'): operation('Hitung ringkasan gizi harian', ref('DailySummary'), query=(
        parameter('date', DATE, required=True),
        parameter('timezone', {'type': 'string', 'maxLength': 100, 'example': 'Asia/Jakarta'}, required=True),
    ), errors=(422,)),
    ('POST', '/restaurants/search'): operation('Cari restoran dari rencana makan', status=503, description=RESTAURANT_PENDING,
        body=fields({'planId': ID_SCHEMA, 'location': {'type': 'object'}}, 'planId', 'location'), errors=(404, 503)),
    ('GET', '/restaurants/locations'): operation('Cari saran lokasi restoran', many({'type': 'object'}, maxItems=0),
        query=(parameter('q', {'type': 'string', 'maxLength': 160}),), errors=(422, 503), description=RESTAURANT_PENDING),
    ('GET', '/sync'): operation('Ambil snapshot sinkronisasi', ref('SyncSnapshot')),
    ('POST', '/sync'): operation('Kirim antrean operasi offline', many(ref('SyncResult')),
        body=fields({'operations': many(ref('SyncOperation'), minItems=1, maxItems=50)}, 'operations'),
        description='Gunakan opId yang sama untuk pengiriman ulang operasi yang identik.'),
    ('GET', '/partner/products/barcode/{barcode}'): operation('Cari produk katalog bersama', ref('Product'), errors=CATALOG_ERRORS),
    ('POST', '/partner/assessment/product'): operation('Nilai produk untuk mitra', ref('ProductAssessment'), body=fields({
        'barcode': BARCODE, 'portion': ref('Portion'),
        'preferences': many(fields({'id': enum('sugar', 'sodium', 'ingredients'), 'value': SCHEMAS['Preference']['properties']['value'],
                                    'ingredients': many(STRING, maxItems=50)}, 'id'), maxItems=3),
    }, 'barcode', 'portion'), example={'barcode': '3017620422003', 'portion': {'quantity': 30, 'unit': 'g'}}, errors=CATALOG_ERRORS),
}


def build_openapi(routes, id_pattern):
    paths = {}
    for method, route, auth, _ in routes:
        name = 'barcode' if '/barcode/' in route else 'id'
        path = public_path(route).replace(id_pattern, '{' + name + '}')
        spec = OPERATIONS[(method, path)]
        responses = {**spec['responses']}
        if auth != 'none':
            responses.setdefault('401', error_response(401))
        if auth in ('user', 'token'):
            responses.setdefault('503', error_response(503))
        if 'requestBody' in spec:
            for code in (413, 415, 422):
                responses.setdefault(str(code), error_response(code))
        responses['default'] = {'description': 'Error API', 'content': json_body(ref('Error'))}
        params = list(spec.get('parameters', ()))
        if id_pattern in route:
            schema = BARCODE if name == 'barcode' else ID_SCHEMA
            if route.startswith('/preferences/'):
                schema = enum('sugar', 'sodium', 'ingredients')
            params.insert(0, parameter(name, schema, location='path', required=True))
        tag = 'API mitra' if auth == 'partner' else path.split('/')[1]
        doc = {**spec, 'responses': responses, 'tags': [tag]}
        if params:
            doc['parameters'] = params
        if auth != 'none':
            doc['security'] = [{'PartnerKey' if auth == 'partner' else 'BearerAuth': []}]
        paths.setdefault(path, {})[method.lower()] = doc

    return {
        'openapi': '3.1.0',
        'info': {'title': 'AmbatuNourish API', 'version': '1.0.0',
                 'description': 'Katalog pangan, penilaian gizi, perencanaan makan, dan sinkronisasi offline.'},
        'servers': [{'url': API_BASE}],
        'externalDocs': {'description': 'Kontrak dan dokumentasi GitHub',
                         'url': 'https://github.com/bellechillguy/AmbatuNourish/blob/backend/backend/API.md'},
        'paths': paths,
        'components': {
            'schemas': SCHEMAS,
            'securitySchemes': {
                'BearerAuth': {'type': 'http', 'scheme': 'bearer'},
                'PartnerKey': {'type': 'apiKey', 'in': 'header', 'name': 'X-API-Key'},
            },
        },
    }
