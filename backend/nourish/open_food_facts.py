import json
import math
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .common import ApiError, NUTRIENTS, completeness, invalid, iso, optional_fields


FIELDS = 'code,product_name,product_name_id,brands,quantity,serving_size,serving_quantity,serving_quantity_unit,ingredients_text,ingredients_text_id,allergens,additives_tags,last_modified_t,rev'
KEYS = {'energy': 'energy-kcal', 'protein': 'proteins', 'carbohydrate': 'carbohydrates', 'fat': 'fat',
        'sugar': 'sugars', 'sodium': 'sodium', 'transFat': 'trans-fat', 'fiber': 'fiber'}


def barcode_value(value):
    if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4,24}', value):
        raise invalid('barcode', 'Gunakan barcode numerik.')
    # UPC-A dan EAN-13 dengan awalan nol menunjuk kode yang sama.
    return value.zfill(13) if len(value) == 12 else value


def provider_error(code):
    return ApiError(503 if code == 'OFF_RATE_LIMITED' else 504 if code == 'OFF_TIMEOUT' else 502,
                    code, 'Data Open Food Facts sedang tidak dapat diambil.')


def source_string(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def quantity(value):
    if type(value) not in (float, int, str):
        return None
    try:
        result = float(value)
    except (ValueError, OverflowError):
        return None
    return result if math.isfinite(result) and 0 <= result <= 1e12 else None


def normalized_size(value):
    if not isinstance(value, str):
        return None, None
    # Hanya kuantitas eksplisit. Jangan ubah cup, potong, dll.
    match = re.search(r'(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kg|mg|g|ml|cl|dl|l)\b', value, re.I)
    if not match:
        return None, None
    amount = quantity(match[1].replace(',', '.'))
    multiplier, unit = {
        'kg': (1000, 'g'), 'mg': (0.001, 'g'), 'g': (1, 'g'),
        'ml': (1, 'ml'), 'cl': (10, 'ml'), 'dl': (100, 'ml'), 'l': (1000, 'ml'),
    }[match[2].lower()]
    return (amount * multiplier, unit) if amount else (None, None)


def map_product(raw):
    if not isinstance(raw, dict):
        raise provider_error('OFF_INVALID_RESPONSE')
    try:
        barcode = barcode_value(raw.get('code'))
    except ApiError:
        raise provider_error('OFF_INVALID_RESPONSE') from None
    name = source_string(raw.get('product_name_id')) or source_string(raw.get('product_name'))
    if not name:
        raise provider_error('OFF_INVALID_RESPONSE')

    nutrition = raw.get('nutrition')
    aggregate = nutrition.get('aggregated_set') if isinstance(nutrition, dict) else None
    aggregate = aggregate if isinstance(aggregate, dict) else {}
    serving_text = source_string(raw.get('serving_size'))
    serving_quantity, serving_unit = normalized_size(serving_text)
    declared_unit = raw.get('serving_quantity_unit')
    declared_quantity = quantity(raw.get('serving_quantity'))
    if declared_unit in ('g', 'ml') and declared_quantity:
        serving_quantity, serving_unit = declared_quantity, declared_unit

    _, packaging_unit = normalized_size(raw.get('quantity'))
    nutrition_per = aggregate.get('per')
    basis_unit = {'100g': 'g', '100ml': 'ml'}.get(nutrition_per) if isinstance(nutrition_per, str) else None
    reference_unit = basis_unit or packaging_unit or serving_unit
    vals = dict.fromkeys(NUTRIENTS)
    source_basis = None
    if aggregate:
        if basis_unit and aggregate.get('preparation') == 'as_sold' and isinstance(aggregate.get('nutrients'), dict):
            source_basis = nutrition_per
            vals = from_aggregate(aggregate['nutrients'])
    elif reference_unit and isinstance(raw.get('nutriments'), dict):
        vals = from_legacy(raw['nutriments'], raw.get('nutrition_data_per'), serving_quantity,
                           serving_unit == reference_unit)
        source_basis = 'serving' if raw.get('nutrition_data_per') == 'serving' else '100' + reference_unit

    serving = None
    if serving_quantity and serving_unit == reference_unit:
        serving = {'quantity': serving_quantity, 'unit': serving_unit, **optional_fields(sourceText=serving_text)}
    completeness_state, missing = completeness(vals)
    allergens = source_string(raw.get('allergens'))
    additives = raw.get('additives_tags')
    version = raw.get('rev')
    modified = quantity(raw.get('last_modified_t'))
    fetched = iso()
    provenance = {
        'externalId': raw['code'],
        'sourceUrl': 'https://world.openfoodfacts.org/product/' + barcode,
        **optional_fields(
            sourceVersion=str(version) if type(version) in (int, str) else None,
            sourceUpdatedAt=iso(datetime.fromtimestamp(modified, timezone.utc)) if modified and modified < 253402300799 else None,
            sourceBasis=source_basis,
        ),
    }
    return {
        'name': name, 'barcode': barcode, 'basis': 'VOLUME' if reference_unit == 'ml' else 'MASS',
        'basisKnown': reference_unit is not None, 'nutrientsPer100': vals, 'displayNutrients': list(NUTRIENTS),
        'source': 'OPEN_FOOD_FACTS', 'verification': 'UNVERIFIED', 'completeness': completeness_state,
        'missingFields': missing, 'fetchedAt': fetched, 'provenance': provenance,
        **optional_fields(brand=source_string(raw.get('brands')), serving=serving,
                          ingredientsText=source_string(raw.get('ingredients_text_id')) or source_string(raw.get('ingredients_text')),
                          allergens=[part.strip() for part in allergens.split(',') if part.strip()] if allergens else None,
                          additives=[tag for tag in additives if isinstance(tag, str)] if isinstance(additives, list) else None),
    }


def from_aggregate(nutrients):
    def read(key, units):
        item = nutrients.get(key)
        if not isinstance(item, dict) or item.get('modifier') not in (None, '', '='):
            return None
        unit = item.get('unit')
        factor = units.get(unit) if isinstance(unit, str) else None
        value = quantity(item.get('value'))
        return value * factor if value is not None and factor is not None else None

    vals = {key: read(off_key, {'g': 1, 'mg': 0.001, 'µg': 0.000001, 'μg': 0.000001}) for key, off_key in KEYS.items()}
    if vals['sodium'] is not None:
        vals['sodium'] *= 1000
    vals['energy'] = read('energy-kcal', {'kcal': 1})
    if vals['energy'] is None:
        vals['energy'] = read('energy-kj', {'kJ': 1 / 4.184, 'kj': 1 / 4.184})
    if vals['energy'] is None:
        vals['energy'] = read('energy', {'kJ': 1 / 4.184, 'kj': 1 / 4.184, 'kcal': 1})
    return vals


def from_legacy(nutrients, reference, serving_quantity, matching_units):
    def read(key):
        if nutrients.get(key + '_modifier') not in (None, '', '='):
            return None
        if reference == 'serving':
            value = quantity(nutrients.get(key + '_serving'))
            return value * 100 / serving_quantity if value is not None and serving_quantity and matching_units else None
        return quantity(nutrients.get(key + '_100g'))

    vals = {key: read(off_key) for key, off_key in KEYS.items()}
    if vals['sodium'] is not None:
        vals['sodium'] *= 1000
    if vals['energy'] is None:
        kj = read('energy-kj')
        if kj is None:
            kj = read('energy')
        vals['energy'] = kj / 4.184 if kj is not None else None
    return vals


class OpenFoodFacts:
    def __init__(self, origin, user_agent, timeout=4):
        self.origin = origin.rstrip('/')
        self.user_agent = user_agent
        self.timeout = timeout
        self.windows = {'product': deque(), 'search': deque()}
        self.lock = threading.Lock()

    def fetch(self, route, params, kind):
        with self.lock:
            now = time.monotonic()
            window = self.windows[kind]
            while window and window[0] <= now - 60:
                window.popleft()
            if len(window) >= (15 if kind == 'product' else 10):
                raise provider_error('OFF_RATE_LIMITED')
            window.append(now)
        req = Request(self.origin + route + '?' + urlencode(params),
                      headers={'User-Agent': self.user_agent, 'Accept': 'application/json'})
        try:
            with urlopen(req, timeout=self.timeout) as response:
                payload = response.read(2_000_001)
                if len(payload) > 2_000_000:
                    raise provider_error('OFF_INVALID_RESPONSE')
                parsed = json.loads(payload)
        except HTTPError as error:
            if error.code == 404 and kind == 'product':
                return None
            raise provider_error('OFF_RATE_LIMITED' if error.code == 429 else 'OFF_UNAVAILABLE') from None
        except (TimeoutError, URLError) as error:
            timeout = isinstance(error, TimeoutError) or isinstance(getattr(error, 'reason', None), TimeoutError)
            raise provider_error('OFF_TIMEOUT' if timeout else 'OFF_UNAVAILABLE') from None
        except (OSError, HTTPException):
            raise provider_error('OFF_UNAVAILABLE') from None
        except (ValueError, RecursionError):
            raise provider_error('OFF_INVALID_RESPONSE') from None
        if not isinstance(parsed, dict):
            raise provider_error('OFF_INVALID_RESPONSE')
        return parsed

    def lookup(self, barcode):
        data = self.fetch('/api/v3.6/product/' + barcode, {'fields': FIELDS + ',nutrition', 'lc': 'id'}, 'product')
        if data is None:
            return None
        raw = data.get('product')
        if not isinstance(raw, dict):
            raise provider_error('OFF_INVALID_RESPONSE')
        product = map_product(raw)
        # OFF also accepts equivalent leading-zero GTIN representations.
        if product['barcode'].lstrip('0') != barcode.lstrip('0'):
            raise provider_error('OFF_INVALID_RESPONSE')
        return {**product, 'barcode': barcode}

    def search(self, query):
        params = {'search_terms': query, 'search_simple': 1, 'action': 'process', 'json': 1, 'page_size': 20,
                  'fields': FIELDS + ',nutrition_data_per,nutriments'}
        results = self.fetch('/cgi/search.pl', params, 'search').get('products')
        if not isinstance(results, list):
            raise provider_error('OFF_INVALID_RESPONSE')
        products = []
        for raw in results:
            try:
                products.append(map_product(raw))
            except ApiError:
                # Rekaman hasil pencarian eksternal mungkin tanpa nama atau barcode yang valid.
                continue
        return products
