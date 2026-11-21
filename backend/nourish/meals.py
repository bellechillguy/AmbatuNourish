import json

from .common import (SLOTS, array, choice, date_key, encode, identifier, iso, missing, new_id,
                     obj, optional_fields, portion, text)


def items_input(payload):
    items = []
    for raw in array(payload, 'items', 1, 30):
        item = obj(raw, 'items')
        items.append({
            **portion(item),
            'productId': identifier(item.get('productId'), 'productId'),
            'productName': text(item.get('productName'), 'productName', maximum=300),
            'source': choice(item.get('source'), 'source', ('OPEN_FOOD_FACTS', 'USER_ENTERED')),
        })
    return items


class Meals:
    def __init__(self, db, assessment):
        self.db = db
        self.assessment = assessment

    def favored(self, conn, owner, favorite_id):
        row = conn.execute('SELECT body FROM favorites WHERE owner = ? AND id = ?', (owner, favorite_id)).fetchone()
        if not row:
            raise missing()
        return json.loads(row['body'])

    def favorite_result(self, conn, owner, value, prefs, plan, *, strict=False):
        totals, assessment = self.assessment.meal_assessment(conn, owner, value['items'], prefs, plan, strict=strict)
        return {**value, 'totals': totals, 'completeness': assessment['completeness'], 'outcome': assessment['outcome']}

    def list_favorites(self, owner, page):
        plan = self.assessment.plan(owner)
        with self.db.connection(read_transaction=True) as conn:
            prefs = self.assessment.preferences(owner, conn)
            rows = conn.execute('SELECT body FROM favorites WHERE owner = ? ORDER BY updated_at DESC, id LIMIT 50 OFFSET ?',
                                (owner, (page - 1) * 50)).fetchall()
            return [self.favorite_result(conn, owner, json.loads(row['body']), prefs, plan) for row in rows]

    def get_favorite(self, owner, favorite_id):
        plan = self.assessment.plan(owner)
        with self.db.connection(read_transaction=True) as conn:
            return self.favorite_result(conn, owner, self.favored(conn, owner, favorite_id),
                                        self.assessment.preferences(owner, conn), plan)

    def save_favorite(self, owner, data, favorite_id=None):
        value = {'id': favorite_id or new_id(), 'name': text(data.get('name'), 'name'), 'items': items_input(data.get('items'))}
        if data.get('slotHint') is not None:
            value['slotHint'] = choice(data['slotHint'], 'slotHint', SLOTS)
        value.update(optional_fields(note=text(data.get('note'), 'note', maximum=1000, optional=True)))
        plan = self.assessment.plan(owner)
        with self.db.connection(write=True) as conn:
            old = self.favored(conn, owner, favorite_id) if favorite_id else None
            result = self.favorite_result(conn, owner, value, self.assessment.preferences(owner, conn), plan,
                                          strict=not old or old['items'] != value['items'])
            conn.execute('''INSERT INTO favorites VALUES (?, ?, ?, ?)
                ON CONFLICT(owner,id) DO UPDATE SET updated_at=excluded.updated_at, body=excluded.body''',
                (owner, value['id'], iso(), encode(value)))
            return result

    def delete_favorite(self, owner, favorite_id):
        with self.db.connection(write=True) as conn:
            if not conn.execute('DELETE FROM favorites WHERE owner = ? AND id = ?', (owner, favorite_id)).rowcount:
                raise missing()

    @staticmethod
    def stored_plan(conn, owner, plan_id):
        return conn.execute('SELECT * FROM meal_plans WHERE owner = ? AND id = ?', (owner, plan_id)).fetchone()

    def active_plan(self, conn, owner, plan_id):
        row = self.stored_plan(conn, owner, plan_id)
        if not row or row['deleted']:
            raise missing()
        return json.loads(row['body'])

    @staticmethod
    def save_plan(conn, owner, entry, deleted):
        conn.execute('''INSERT INTO meal_plans (owner,id,date,slot,version,deleted,updated_at,body)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET date=excluded.date,slot=excluded.slot,
            version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at,body=excluded.body''',
            (owner, entry['id'], entry['date'], entry['slot'], entry['version'], deleted, iso(), encode(entry)))

    def plan_payload(self, conn, owner, entry_id, data, version, previous):
        favorite_id = data.get('favoriteId')
        if favorite_id is not None:
            identifier(favorite_id, 'favoriteId')
            if not previous or previous.get('favoriteId') != favorite_id:
                self.favored(conn, owner, favorite_id)
        items = items_input(data.get('items'))
        if not previous or previous['items'] != items:
            self.assessment.meal_assessment(conn, owner, items, (), None, strict=True)
        return {
            'id': entry_id, 'date': date_key(data.get('date')), 'slot': choice(data.get('slot'), 'slot', SLOTS),
            'title': text(data.get('title'), 'title', maximum=300), 'items': items, 'status': 'PLANNED',
            'version': version, 'syncStatus': 'SYNCED', **optional_fields(favoriteId=favorite_id),
        }

    def read_plans(self, conn, owner, prefs, plan, consumed, *, start=None, end=None):
        sql = 'SELECT body FROM meal_plans WHERE owner = ? AND deleted = 0'
        params = [owner]
        if start is not None:
            sql += ' AND date >= ?'
            params.append(start)
        if end is not None:
            sql += ' AND date <= ?'
            params.append(end)
        sql += ' ORDER BY date, slot, id'
        result = []
        for row in conn.execute(sql, params):
            entry = json.loads(row['body'])
            _, details = self.assessment.meal_assessment(conn, owner, entry['items'], prefs, plan)
            projected = {**entry, 'outcome': details['outcome']}
            if entry['id'] in consumed:
                projected.update(status='CONSUMED', consumedAt=consumed[entry['id']])
            result.append(projected)
        return result
