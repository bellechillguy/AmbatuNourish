from .common import NUTRIENTS, SLOTS, SUMMARY_METRICS
from .consumption import SOURCES


def ref(name):
    return {'$ref': f'#/components/schemas/{name}'}


def fields(properties, *required):
    schema = {'type': 'object', 'properties': properties}
    if required:
        schema['required'] = list(required)
    return schema


def many(items, **limits):
    return {'type': 'array', 'items': items, **limits}


def enum(*values):
    return {'type': 'string', 'enum': values}


STRING = {'type': 'string'}
ID_SCHEMA = {'type': 'string', 'pattern': '^[a-zA-Z0-9_-]{1,96}$'}
BARCODE = {'type': 'string', 'pattern': '^[0-9]{4,24}$', 'example': '3017620422003'}
DATE = {'type': 'string', 'format': 'date'}
TIMESTAMP = {'type': 'string', 'format': 'date-time'}
COUNT = {'type': 'integer', 'minimum': 0}
NUMBER = {'type': 'number', 'minimum': 0}
OPTIONAL_NUMBER = {'type': ['number', 'null'], 'minimum': 0}
EMAIL = {'type': 'string', 'format': 'email', 'maxLength': 254}
BOOL = {'type': 'boolean'}
BASIS = enum('MASS', 'VOLUME')
SOURCE = enum('USER_ENTERED', 'OPEN_FOOD_FACTS')
COMPLETENESS = enum('COMPLETE', 'INCOMPLETE', 'INSUFFICIENT')
OUTCOME = enum('COCOK', 'KURANG_COCOK', 'BELUM_DAPAT_DINILAI')
VERIFICATION = enum('VERIFIED', 'UNVERIFIED')
NUTRIENT_LIST = many(enum(*NUTRIENTS))
PORTION = {'quantity': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 1_000_000}, 'unit': enum('g', 'ml')}
INGREDIENTS = many(STRING, maxItems=50)
PREFERENCE_FIELDS = {'value': OPTIONAL_NUMBER, 'ingredients': INGREDIENTS}
MANUAL_FIELDS = {
    'name': STRING, 'brand': STRING, 'barcode': BARCODE, 'basis': BASIS,
    'serving': ref('Serving'), 'ingredientsText': STRING, 'allergens': INGREDIENTS,
    'nutrientsPer100': ref('NutrientInput'),
}
FAVORITE_FIELDS = {'name': STRING, 'items': many(ref('MealItem'), minItems=1, maxItems=30),
                   'slotHint': enum(*SLOTS), 'note': {'type': 'string', 'maxLength': 1000}}
ASSESSMENT_FIELDS = {'outcome': OUTCOME, 'summary': STRING, 'completeness': COMPLETENESS,
                     'evidence': many(ref('Evidence')), 'missingFields': NUTRIENT_LIST, 'values': ref('NutrientFacts')}
ASSESSMENT_REQUIRED = tuple(ASSESSMENT_FIELDS)
PLAN_FIELDS = {'id': ID_SCHEMA, 'date': DATE, 'slot': enum(*SLOTS), 'title': STRING,
               'items': FAVORITE_FIELDS['items'], 'favoriteId': ID_SCHEMA}
RECORD_FIELDS = {
    **PORTION, 'id': ID_SCHEMA, 'title': STRING, 'consumedAt': TIMESTAMP,
    'source': enum(*SOURCES), 'itemsCount': {'type': 'integer', 'minimum': 1, 'maximum': 30},
    'snapshot': ref('NutrientInput'), 'productId': ID_SCHEMA, 'favoriteId': ID_SCHEMA, 'planEntryId': ID_SCHEMA,
}
RECORD_REQUIRED = ('id', 'title', 'consumedAt', 'source', 'quantity', 'unit', 'itemsCount', 'snapshot')
SYNC_FIELDS = {'version': COUNT, 'syncStatus': enum('SYNCED')}
NUTRIENT_FIELDS = {
    nutrient: {**OPTIONAL_NUMBER, 'description': f'{"kkal" if nutrient == "energy" else "mg" if nutrient == "sodium" else "g"}. null berarti tidak diketahui.'}
    for nutrient in NUTRIENTS
}

SCHEMAS = {
    'Error': fields({'status': {'type': 'integer'}, 'code': STRING, 'message': STRING,
                     'data': {'type': 'object', 'additionalProperties': fields({'message': STRING}, 'message')}},
                    'status', 'code', 'message'),
    'Health': fields({'status': enum('ok'), 'service': enum('ambatunourish'), 'apiVersion': enum('1')},
                     'status', 'service', 'apiVersion'),
    'Login': fields({'email': EMAIL, 'password': {'type': 'string', 'minLength': 1, 'maxLength': 256}}, 'email', 'password'),
    'Register': fields({'name': STRING, 'email': EMAIL,
                       'password': {'type': 'string', 'minLength': 8, 'maxLength': 256}}, 'name', 'email', 'password'),
    'Profile': fields({'id': ID_SCHEMA, 'name': STRING, 'email': EMAIL}, 'id', 'name', 'email'),
    'Session': fields({'token': STRING, 'user': ref('Profile')}, 'token', 'user'),
    'NutrientInput': fields(NUTRIENT_FIELDS),
    'NutrientFacts': fields(NUTRIENT_FIELDS, *NUTRIENTS),
    'Portion': fields(PORTION, 'quantity', 'unit'),
    'Serving': fields({**PORTION, 'sourceText': STRING}, 'quantity', 'unit'),
    'ManualProductInput': fields(MANUAL_FIELDS, 'name', 'basis'),
    'Product': fields({
        **MANUAL_FIELDS, 'id': ID_SCHEMA, 'basisKnown': BOOL, 'displayNutrients': NUTRIENT_LIST,
        'missingFields': NUTRIENT_LIST, 'source': SOURCE, 'completeness': COMPLETENESS,
        'verification': VERIFICATION, 'nutrientsPer100': ref('NutrientFacts'), 'isStale': BOOL,
        'createdAt': TIMESTAMP, 'updatedAt': TIMESTAMP, 'fetchedAt': TIMESTAMP,
        'provenance': fields({'externalId': STRING, 'sourceUrl': {'type': 'string', 'format': 'uri'},
                             'sourceVersion': STRING, 'sourceUpdatedAt': TIMESTAMP, 'sourceBasis': STRING},
                            'externalId', 'sourceUrl'),
    }, 'id', 'name', 'basis', 'nutrientsPer100', 'source', 'verification', 'completeness'),
    'PreferenceUpdate': {'oneOf': [fields({'value': OPTIONAL_NUMBER}, 'value'), fields({'ingredients': INGREDIENTS}, 'ingredients')]},
    'Preference': fields({**PREFERENCE_FIELDS, 'id': enum('sugar', 'sodium', 'ingredients'),
                          'type': enum('SUGAR_MAX_PER_PORTION', 'SODIUM_MAX_PER_PORTION', 'AVOID_INGREDIENTS'),
                          'label': STRING, 'unit': enum('g', 'mg')}, 'id', 'type', 'label', 'value'),
    'Evidence': fields({'rule': STRING, 'source': enum('PREFERENCE', 'NUTRITION_PLAN'),
                        'observed': {'type': ['string', 'null']}, 'nutrientLabel': STRING,
                        'result': enum('MET', 'VIOLATED', 'UNKNOWN'), 'resultLabel': STRING},
                       'rule', 'source', 'observed', 'result', 'resultLabel'),
    'MealAssessment': fields(ASSESSMENT_FIELDS, *ASSESSMENT_REQUIRED),
    'ProductAssessment': fields({**ASSESSMENT_FIELDS, 'id': ID_SCHEMA, 'assessedAt': TIMESTAMP,
                                 'portion': ref('Portion'), 'productSource': SOURCE, 'provenance': {'type': 'object'}},
                                *ASSESSMENT_REQUIRED, 'id', 'assessedAt', 'portion', 'productSource'),
    'ComparisonColumn': fields({'productId': ID_SCHEMA, 'name': STRING, 'brand': STRING, 'basis': BASIS,
                                'basisKnown': BOOL, 'source': SOURCE, 'completeness': COMPLETENESS,
                                'verification': VERIFICATION, 'values': ref('NutrientFacts'), 'outcome': OUTCOME},
                               'productId', 'name', 'basis', 'source', 'completeness', 'verification', 'values'),
    'MealItem': fields({**PORTION, 'productId': ID_SCHEMA, 'productName': STRING, 'source': SOURCE},
                       'productId', 'productName', 'source', 'quantity', 'unit'),
    'FavoriteInput': fields(FAVORITE_FIELDS, 'name', 'items'),
    'Favorite': fields({**FAVORITE_FIELDS, 'id': ID_SCHEMA, 'totals': ref('NutrientFacts'),
                        'completeness': COMPLETENESS, 'outcome': OUTCOME},
                       'id', 'name', 'items', 'totals', 'completeness', 'outcome'),
    'MealPlan': fields({**PLAN_FIELDS, **SYNC_FIELDS, 'status': enum('PLANNED', 'CONSUMED'),
                        'consumedAt': TIMESTAMP, 'outcome': OUTCOME},
                       'id', 'date', 'slot', 'title', 'items', 'version', 'syncStatus', 'status'),
    'ConsumptionRecord': fields({**RECORD_FIELDS, **SYNC_FIELDS, 'snapshot': ref('NutrientFacts')},
                                *RECORD_REQUIRED, 'version', 'syncStatus'),
    'DailyTargets': {'type': 'object', 'additionalProperties': fields({'value': NUMBER,
                     'source': enum('NUTRITION_PLAN', 'USER')}, 'value', 'source')},
    'DailySummary': fields({'date': DATE, 'recordCount': COUNT, 'incompleteCount': COUNT,
                            'totals': fields(dict.fromkeys(SUMMARY_METRICS, NUMBER), *SUMMARY_METRICS),
                            'missingCount': fields(dict.fromkeys(SUMMARY_METRICS, COUNT), *SUMMARY_METRICS),
                            'targets': ref('DailyTargets')},
                           'date', 'recordCount', 'incompleteCount', 'totals', 'missingCount', 'targets'),
    'SyncSnapshot': fields({'plans': many(ref('MealPlan')), 'records': many(ref('ConsumptionRecord'))}, 'plans', 'records'),
    'SyncOperation': fields({
        'opId': ID_SCHEMA, 'entityId': ID_SCHEMA, 'entityType': enum('MEAL_PLAN', 'CONSUMPTION'),
        'op': enum('CREATE', 'UPDATE', 'DELETE'), 'baseVersion': COUNT,
        'payload': {'anyOf': [fields(PLAN_FIELDS, 'id', 'date', 'slot', 'title', 'items'),
                              fields(RECORD_FIELDS, *RECORD_REQUIRED), {'type': 'null'}],
                    'description': 'Cocokkan payload dengan entityType. Gunakan null untuk DELETE.'},
    }, 'opId', 'entityId', 'entityType', 'op', 'baseVersion', 'payload'),
    'SyncResult': {'oneOf': [
        fields({'opId': ID_SCHEMA, 'status': enum('ACCEPTED'), 'version': COUNT}, 'opId', 'status', 'version'),
        fields({'opId': ID_SCHEMA, 'status': enum('CONFLICT'), 'deleted': BOOL,
                'server': {'oneOf': [ref('MealPlan'), ref('ConsumptionRecord')]}}, 'opId', 'status', 'deleted', 'server'),
        fields({'opId': ID_SCHEMA, 'status': enum('REJECTED', 'RETRYABLE'), 'reason': STRING}, 'opId', 'status', 'reason'),
    ]},
}
