import json
import math
import re
from datetime import date, datetime, timezone
from uuid import uuid4


NUTRIENTS = ('energy', 'protein', 'carbohydrate', 'fat', 'sugar', 'sodium', 'transFat', 'fiber')
SUMMARY_METRICS = NUTRIENTS[:6]
SLOTS = ('SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM', 'CAMILAN')


class ApiError(Exception):
    def __init__(self, status, code, message, field=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.field = field


def invalid(field, message='Nilai tidak valid.'):
    return ApiError(422, 'VALIDATION', message, field)


def missing():
    return ApiError(404, 'NOT_FOUND', 'Data tidak ditemukan.')


def pending():
    return ApiError(503, 'CONTRACT_PENDING', 'Kontrak API mitra belum tersedia.')


def iso(value=None):
    return (value or datetime.now(timezone.utc)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def timestamp(value, field, *, past=False):
    if not isinstance(value, str):
        raise invalid(field)
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise invalid(field) from None
    if parsed.tzinfo is None or not re.match(r'^\d{4}-\d{2}-\d{2}T', value):
        raise invalid(field)
    try:
        parsed = parsed.astimezone(timezone.utc)
    except OverflowError:
        raise invalid(field) from None
    if past and parsed > datetime.now(timezone.utc):
        raise invalid(field, 'Waktu konsumsi belum terjadi.')
    return iso(parsed)


def date_key(value, field='date'):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise invalid(field)
    try:
        date.fromisoformat(value)
    except ValueError:
        raise invalid(field) from None
    return value


def identifier(value, field='id'):
    if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,96}', value):
        raise invalid(field)
    return value


def new_id():
    return uuid4().hex


def encode(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(',', ':'))


def obj(value, field='body'):
    if not isinstance(value, dict):
        raise invalid(field)
    return value


def array(value, field, minimum, maximum):
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise invalid(field, f'Isi antara {minimum} dan {maximum} item.')
    return value


def text(value, field, *, maximum=160, optional=False):
    if optional and (value is None or value == ''):
        return None
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum or '\x00' in value:
        raise invalid(field)
    return value.strip()


def number(value, field, *, minimum=0, maximum=1_000_000):
    if type(value) not in (int, float) or not minimum <= value <= maximum or not math.isfinite(value):
        raise invalid(field)
    return value


def integer(value, field, *, minimum=0, maximum=1_000_000_000):
    if type(value) is not int or not minimum <= value <= maximum:
        raise invalid(field)
    return value


def choice(value, field, choices):
    if value not in choices:
        raise invalid(field)
    return value


def facts(value):
    value = obj(value, 'nutrients')
    return {key: None if value.get(key) is None else number(value[key], key, maximum=1e15) for key in NUTRIENTS}


def basis_unit(basis):
    return 'g' if basis == 'MASS' else 'ml'


def portion(value, unit=None):
    value = obj(value, 'portion')
    return {
        'quantity': number(value.get('quantity'), 'quantity', minimum=0.000001),
        'unit': choice(value.get('unit'), 'unit', (unit,) if unit else ('g', 'ml')),
    }


def scale(values, quantity):
    return {key: None if values[key] is None else values[key] * quantity / 100 for key in NUTRIENTS}


def sum_facts(parts):
    return {
        key: sum(part[key] for part in parts) if parts and all(part[key] is not None for part in parts) else None
        for key in NUTRIENTS
    }


def completeness(values):
    missing_fields = [key for key in NUTRIENTS if values[key] is None]
    state = 'COMPLETE' if not missing_fields else 'INSUFFICIENT' if len(missing_fields) == len(NUTRIENTS) else 'INCOMPLETE'
    return state, missing_fields


def optional_fields(**fields):
    return {key: value for key, value in fields.items() if value is not None}
