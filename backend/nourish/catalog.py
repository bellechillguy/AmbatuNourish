import json
import sqlite3
from datetime import datetime, timezone

from .common import (ApiError, NUTRIENTS, basis_unit, choice, completeness, encode, facts,
                     invalid, iso, missing, new_id, obj, optional_fields, portion, text)
from .open_food_facts import barcode_value


class Catalog:
    def __init__(self, db, provider, ttl_seconds):
        self.db = db
        self.provider = provider
        self.ttl_seconds = ttl_seconds

    def freshness(self, product):
        if product['source'] != 'OPEN_FOOD_FACTS':
            return product
        age = datetime.now(timezone.utc) - datetime.fromisoformat(product['fetchedAt'].replace('Z', '+00:00'))
        stale = self.ttl_seconds is None or age.total_seconds() >= self.ttl_seconds or product.get('lookupRequired', False)
        return {**product, 'isStale': stale}

    def cached_barcode(self, barcode):
        with self.db.connection() as conn:
            row = conn.execute('SELECT body FROM external_products WHERE barcode = ?', (barcode,)).fetchone()
        return self.freshness(json.loads(row['body'])) if row else None

    def save_external(self, conn, product, *, discovered=False):
        barcode = product['barcode']
        old = conn.execute('SELECT id, body FROM external_products WHERE barcode = ?', (barcode,)).fetchone()
        if discovered and old:
            return self.freshness(json.loads(old['body']))
        record = {**product, 'id': old['id'] if old else new_id(), 'lookupRequired': discovered}
        conn.execute('''INSERT INTO external_products (id, barcode, search_text, fetched_at, body) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(barcode) DO UPDATE SET search_text=excluded.search_text, fetched_at=excluded.fetched_at, body=excluded.body
            WHERE excluded.fetched_at >= external_products.fetched_at''',
            (record['id'], barcode, self.search_text(record), record['fetchedAt'], encode(record)))
        return {**record, 'isStale': discovered}

    @staticmethod
    def search_text(product):
        return ' '.join(product.get(key, '') for key in ('name', 'brand', 'barcode')).casefold()

    def lookup(self, barcode, *, refresh=False):
        barcode = barcode_value(barcode)
        cached = self.cached_barcode(barcode)
        refresh_due = cached and cached['isStale'] and (self.ttl_seconds is not None or cached.get('lookupRequired'))
        if cached and not refresh and not refresh_due:
            return cached
        try:
            result = self.provider.lookup(barcode)
        except ApiError:
            if cached:
                return {**cached, 'isStale': True}
            raise
        if result is None:
            if cached:
                return {**cached, 'isStale': True}
            raise missing()
        with self.db.connection(write=True) as conn:
            return self.save_external(conn, result)

    def lookup_for_user(self, owner, barcode):
        barcode = barcode_value(barcode)
        # Katalog bersama menang ketika sudah memiliki barcode; entri personal tetap tersimpan.
        if not self.cached_barcode(barcode):
            with self.db.connection() as conn:
                own = conn.execute('SELECT body FROM personal_products WHERE owner = ? AND barcode = ?', (owner, barcode)).fetchone()
            if own:
                return json.loads(own['body'])
        return self.lookup(barcode)

    def get(self, owner, product_id, conn=None):
        if conn is None:
            with self.db.connection() as connection:
                return self.get(owner, product_id, connection)
        row = conn.execute('SELECT body FROM external_products WHERE id = ?', (product_id,)).fetchone()
        if not row and owner is not None:
            row = conn.execute('SELECT body FROM personal_products WHERE owner = ? AND id = ?', (owner, product_id)).fetchone()
        if not row:
            raise missing()
        return self.freshness(json.loads(row['body']))

    def detail(self, owner, product_id, *, refresh=False):
        product = self.get(owner, product_id)
        if product['source'] == 'OPEN_FOOD_FACTS' and (refresh or product.get('lookupRequired')):
            return self.lookup(product['barcode'], refresh=True)
        return product

    def search(self, owner, query, source, page, *, discover=False):
        words = query.casefold().split()
        match = ' AND '.join('instr(search_text, ?) > 0' for _ in words) or '1'
        public_sql = 'SELECT 1 AS tier, id, search_text, body FROM external_products WHERE ' + match
        private_sql = 'SELECT 0 AS tier, id, search_text, body FROM personal_products WHERE owner = ? AND ' + match
        include_off = source != 'USER_ENTERED'
        include_manual = source != 'OPEN_FOOD_FACTS'
        with self.db.connection() as conn:
            has_external = include_off and conn.execute(public_sql + ' LIMIT 1', words).fetchone()
            has_manual = include_manual and conn.execute(private_sql + ' LIMIT 1', [owner, *words]).fetchone()
        if discover and query and page == 1 and include_off and not has_external:
            try:
                discoveries = self.provider.search(query)
                if discoveries:
                    with self.db.connection(write=True) as conn:
                        for product in discoveries:
                            self.save_external(conn, product, discovered=True)
            except ApiError:
                if not has_manual:
                    raise
        sql = ' UNION ALL '.join(part for part, use in ((private_sql, include_manual), (public_sql, include_off)) if use)
        params = ([owner, *words] if include_manual else []) + (words if include_off else [])
        with self.db.connection() as conn:
            rows = conn.execute(sql + ' ORDER BY tier, search_text, id LIMIT 30 OFFSET ?', [*params, (page - 1) * 30]).fetchall()
        return [self.freshness(json.loads(row['body'])) for row in rows]

    @staticmethod
    def manual_payload(payload):
        basis = choice(payload.get('basis'), 'basis', ('MASS', 'VOLUME'))
        serving = payload.get('serving')
        if serving is not None:
            serving = {
                **portion(serving, basis_unit(basis)),
                **optional_fields(sourceText=text(serving.get('sourceText'), 'sourceText', optional=True)),
            }
        barcode = payload.get('barcode')
        barcode = barcode_value(barcode) if barcode not in (None, '') else None
        values = facts(payload.get('nutrientsPer100', {}))
        state, missing_fields = completeness(values)
        allergens = payload.get('allergens')
        if allergens is not None:
            if not isinstance(allergens, list) or len(allergens) > 50:
                raise invalid('allergens')
            allergens = [text(item, 'allergens') for item in allergens]
        return {
            'name': text(payload.get('name'), 'name'), 'basis': basis, 'basisKnown': True,
            'nutrientsPer100': values, 'displayNutrients': list(NUTRIENTS), 'source': 'USER_ENTERED',
            'verification': 'UNVERIFIED', 'completeness': state, 'missingFields': missing_fields,
            **optional_fields(
                barcode=barcode, brand=text(payload.get('brand'), 'brand', optional=True), serving=serving,
                ingredientsText=text(payload.get('ingredientsText'), 'ingredientsText', maximum=4000, optional=True),
                allergens=allergens,
            ),
        }

    def save_manual(self, owner, payload, product_id=None):
        record = self.manual_payload(obj(payload))
        with self.db.connection(write=True) as conn:
            if product_id:
                old = conn.execute('SELECT body FROM personal_products WHERE owner = ? AND id = ?', (owner, product_id)).fetchone()
                if not old:
                    raise missing()
                created = json.loads(old['body'])['createdAt']
            else:
                product_id, created = new_id(), iso()
            record.update(id=product_id, createdAt=created, updatedAt=iso())
            try:
                conn.execute('''INSERT INTO personal_products (id, owner, barcode, search_text, updated_at, body)
                    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET barcode=excluded.barcode,
                    search_text=excluded.search_text, updated_at=excluded.updated_at, body=excluded.body
                    WHERE personal_products.owner=excluded.owner''',
                    (product_id, owner, record.get('barcode'), self.search_text(record), record['updatedAt'], encode(record)))
            except sqlite3.IntegrityError:
                raise invalid('barcode', 'Barcode sudah dipakai oleh produk pribadi Anda.') from None
        return record

    def delete_manual(self, owner, product_id):
        with self.db.connection(write=True) as conn:
            if not conn.execute('DELETE FROM personal_products WHERE owner = ? AND id = ?', (owner, product_id)).rowcount:
                raise missing()
