import json
import re

from .common import (ApiError, NUTRIENTS, array, basis_unit, completeness, encode, identifier, invalid, iso,
                     missing, new_id, number, optional_fields, portion, scale, sum_facts, text)


RULES = {
    'sugar': {'type': 'SUGAR_MAX_PER_PORTION', 'label': 'Batas gula per porsi', 'unit': 'g'},
    'sodium': {'type': 'SODIUM_MAX_PER_PORTION', 'label': 'Batas natrium per porsi', 'unit': 'mg'},
    'ingredients': {'type': 'AVOID_INGREDIENTS', 'label': 'Bahan yang dihindari', 'ingredients': []},
}
LABELS = {'sugar': 'Gula', 'sodium': 'Natrium'}
RESULT_LABELS = {'MET': 'Terpenuhi', 'VIOLATED': 'Melebihi batas / mengandung bahan', 'UNKNOWN': 'Data tidak tersedia'}
SUMMARIES = {
    'COCOK': 'Semua aturan aktif yang diperiksa terpenuhi.',
    'KURANG_COCOK': 'Ada aturan aktif yang tidak terpenuhi.',
    'BELUM_DAPAT_DINILAI': 'Bukti yang tersedia belum cukup untuk menilai kesesuaian.',
}


def preference_input(rule_id, payload):
    if rule_id not in RULES:
        raise missing()
    default = RULES[rule_id]
    if payload.get('type', default['type']) != default['type']:
        raise invalid('type')
    if rule_id == 'ingredients':
        entries = array(payload.get('ingredients'), 'ingredients', 0, 50)
        ingredients = list(dict.fromkeys(text(entry, 'ingredients', maximum=100) for entry in entries))
        return {**default, 'id': rule_id, 'ingredients': ingredients, 'value': None}
    value = payload.get('value')
    return {**default, 'id': rule_id, 'value': number(value, 'value') if value is not None else None}


def format_value(value):
    return format(value, '.6g').replace('.', ',')


def evidence_for(rule, values, products, source):
    key = rule['id']
    if key == 'ingredients':
        avoided = rule.get('ingredients', [])
        if not avoided:
            return None
        available = [product.get('ingredientsText') if product else None for product in products]
        joined = ' '.join(item.casefold() for item in available if item)
        matches = [item for item in avoided if re.search(r'(?<!\w)' + re.escape(item.casefold()) + r'(?!\w)', joined)]
        known = bool(available) and all(available)
        result = 'VIOLATED' if matches else 'MET' if known else 'UNKNOWN'
        return {
            'source': source, 'rule': 'Hindari ' + ', '.join(avoided), 'nutrientLabel': 'Komposisi',
            'observed': ', '.join(matches) if matches else 'Bahan tidak tercantum pada komposisi tersedia' if known else None,
            'result': result, 'resultLabel': 'Bahan ditemukan' if matches else RESULT_LABELS[result],
        }
    limit = rule.get('value')
    if limit is None or key not in LABELS:
        return None
    actual = values[key]
    label, unit = LABELS[key], RULES[key]['unit']
    result = 'UNKNOWN' if actual is None else 'VIOLATED' if actual > limit else 'MET'
    return {
        'source': source, 'rule': f'{label} per porsi ≤ {format_value(limit)} {unit}', 'nutrientLabel': label,
        'observed': f'{label} {format_value(actual)} {unit}' if actual is not None else None,
        'result': result, 'resultLabel': 'Melebihi batas' if result == 'VIOLATED' else RESULT_LABELS[result],
    }


def evaluate(values, products, preferences, plan):
    evidence = []
    for source, rules in (('PREFERENCE', preferences), ('NUTRITION_PLAN', plan.rules if plan else ())):
        for rule in rules:
            item = evidence_for(rule, values, products, source)
            if item:
                evidence.append(item)
    if any(item['result'] == 'VIOLATED' for item in evidence):
        outcome = 'KURANG_COCOK'
    elif evidence and all(item['result'] == 'MET' for item in evidence):
        outcome = 'COCOK'
    else:
        outcome = 'BELUM_DAPAT_DINILAI'
    state, missing_fields = completeness(values)
    return {
        'outcome': outcome,
        'summary': 'Atur preferensi pangan untuk menilai kesesuaian.' if not evidence else SUMMARIES[outcome],
        'completeness': state, 'evidence': evidence, 'missingFields': missing_fields,
    }


class AssessmentService:
    def __init__(self, db, catalog, partner):
        self.db = db
        self.catalog = catalog
        self.partner = partner

    def preferences(self, owner, conn=None):
        if conn is None:
            with self.db.connection() as connection:
                return self.preferences(owner, connection)
        rows = conn.execute('SELECT id, body FROM preferences WHERE owner = ?', (owner,)).fetchall()
        saved = {row['id']: json.loads(row['body']) for row in rows}
        return [saved.get(key, {**default, 'id': key, 'value': None}) for key, default in RULES.items()]

    def save_preference(self, owner, rule_id, body):
        value = preference_input(rule_id, body)
        with self.db.connection(write=True) as conn:
            conn.execute('''INSERT INTO preferences VALUES (?, ?, ?, ?)
                ON CONFLICT(owner,id) DO UPDATE SET updated_at=excluded.updated_at, body=excluded.body''',
                (owner, rule_id, iso(), encode(value)))
        return value

    def delete_preference(self, owner, rule_id):
        if rule_id not in RULES:
            raise missing()
        with self.db.connection(write=True) as conn:
            conn.execute('DELETE FROM preferences WHERE owner = ? AND id = ?', (owner, rule_id))

    def plan(self, owner):
        return self.partner.nutrition_plan(owner)

    @staticmethod
    def product_portion(product, requested):
        if not product.get('basisKnown', True):
            raise invalid('unit', 'Basis gizi produk belum tersedia.')
        return portion(requested, basis_unit(product['basis']))

    def assess(self, owner, payload):
        product = self.catalog.get(owner, identifier(payload.get('productId'), 'productId'))
        serving = self.product_portion(product, payload.get('portion'))
        prefs, plan = self.preferences(owner), self.plan(owner)
        result = self.assess_product(product, serving, prefs, plan)
        audit = {**result, 'productId': product['id'], 'preferences': prefs,
                 'nutritionPlan': plan.display if plan else None}
        with self.db.connection(write=True) as conn:
            conn.execute('INSERT INTO assessments VALUES (?, ?, ?, ?)', (result['id'], owner, result['assessedAt'], encode(audit)))
        return result

    @staticmethod
    def assess_product(product, serving, preferences, plan=None):
        values = scale(product['nutrientsPer100'], serving['quantity'])
        result = evaluate(values, [product], preferences, plan)
        return {
            **result, 'portion': serving, 'id': new_id(), 'assessedAt': iso(), 'values': values,
            'productSource': product['source'],
            **optional_fields(provenance=product.get('provenance')),
        }

    def compare(self, owner, payload):
        ids = [identifier(item, 'productIds') for item in array(payload.get('productIds'), 'productIds', 1, 3)]
        if len(set(ids)) != len(ids):
            raise invalid('productIds', 'Pilih produk yang berbeda.')
        products = [self.catalog.get(owner, product_id) for product_id in ids]
        prefs, plan = self.preferences(owner), self.plan(owner)
        comparison_portion = payload.get('portion')
        return [self.column(product, comparison_portion, prefs, plan) for product in products]

    def column(self, product, comparison_portion, preferences, plan):
        amount = self.product_portion(product, comparison_portion)['quantity'] if comparison_portion is not None else 100
        values = scale(product['nutrientsPer100'], amount)
        known = product.get('basisKnown', True)
        result = evaluate(values, [product], preferences, plan) if known else None
        return {
            'productId': product['id'], 'name': product['name'], 'basis': product['basis'],
            'basisKnown': known, 'values': values, 'source': product['source'],
            'completeness': product['completeness'], 'verification': product['verification'],
            **optional_fields(brand=product.get('brand'), outcome=result['outcome'] if result else None),
        }

    def meal_assessment(self, conn, owner, items, preferences, plan, *, strict=False):
        values, products = [], []
        for item in items:
            try:
                product = self.catalog.get(owner, item['productId'], conn)
            except ApiError as error:
                if strict or error.status != 404:
                    raise
                product = None
            if product and (not product.get('basisKnown', True) or basis_unit(product['basis']) != item['unit']):
                if strict:
                    raise invalid('items', 'Satuan item harus sesuai basis produk.')
                product = None
            values.append(scale(product['nutrientsPer100'], item['quantity']) if product else dict.fromkeys(NUTRIENTS))
            products.append(product)
        totals = sum_facts(values)
        return totals, evaluate(totals, products, preferences, plan)
