import hashlib
import json
import sqlite3

from .common import ApiError, array, choice, encode, identifier, integer, invalid, iso, obj


class Sync:
    def __init__(self, db, meals, consumption):
        self.db = db
        self.meals = meals
        self.consumption = consumption

    def pull(self, owner, start=None, end=None):
        plan = self.meals.assessment.plan(owner)
        with self.db.connection(read_transaction=True) as conn:
            prefs = self.meals.assessment.preferences(owner, conn)
            consumed = self.consumption.consumed_plans(conn, owner)
            return {
                'plans': self.meals.read_plans(conn, owner, prefs, plan, consumed, start=start, end=end),
                'records': self.consumption.read_records(conn, owner),
            }

    def push(self, owner, body):
        batch = array(body.get('operations'), 'operations', 1, 50)
        # Validasi amplop sebelum menulis operasi pertama, supaya setiap hasil dapat dicocokkan klien.
        op_ids = [identifier(obj(operation).get('opId'), 'opId') for operation in batch]
        if len(set(op_ids)) != len(op_ids):
            raise invalid('opId', 'ID operasi dalam satu batch harus unik.')
        return [self.process(owner, operation) for operation in batch]

    def process(self, owner, operation):
        op_id = operation['opId']
        data = {key: operation.get(key) for key in ('entityType', 'entityId', 'op', 'baseVersion', 'payload')}
        fingerprint = hashlib.sha256(encode(data).encode()).hexdigest()
        try:
            with self.db.connection(write=True) as conn:
                previous = conn.execute('SELECT fingerprint, result FROM sync_operations WHERE owner = ? AND op_id = ?',
                                        (owner, op_id)).fetchone()
                if previous:
                    if previous['fingerprint'] != fingerprint:
                        return {'opId': op_id, 'status': 'REJECTED', 'reason': 'ID operasi sudah dipakai untuk perubahan lain.'}
                    return json.loads(previous['result'])
                try:
                    result = self.apply(conn, owner, data)
                except ApiError as error:
                    result = {'status': 'REJECTED', 'reason': str(error)}
                result['opId'] = op_id
                conn.execute('INSERT INTO sync_operations VALUES (?, ?, ?, ?, ?)', (owner, op_id, fingerprint, iso(), encode(result)))
                return result
        except sqlite3.OperationalError as error:
            if 'locked' not in str(error).lower() and 'busy' not in str(error).lower():
                raise
            return {'opId': op_id, 'status': 'RETRYABLE', 'reason': 'Penyimpanan sedang sibuk.'}

    def apply(self, conn, owner, data):
        kind = choice(data['entityType'], 'entityType', ('MEAL_PLAN', 'CONSUMPTION'))
        entity_id = identifier(data['entityId'], 'entityId')
        base = integer(data['baseVersion'], 'baseVersion')
        action = choice(data['op'], 'op', ('CREATE', 'UPDATE', 'DELETE'))
        is_plan = kind == 'MEAL_PLAN'
        stored = self.meals.stored_plan(conn, owner, entity_id) if is_plan else self.consumption.stored_record(conn, owner, entity_id)
        old = json.loads(stored['body']) if stored else None
        if stored and (stored['version'] != base or (action == 'CREATE' and not stored['deleted'])):
            return {'status': 'CONFLICT', 'server': old, 'deleted': bool(stored['deleted'])}
        if not stored and (action != 'CREATE' or base != 0):
            raise invalid('baseVersion', 'Data atau versi dasar tidak ditemukan.')
        version = base + 1
        if action == 'DELETE':
            if data['payload'] is not None:
                raise invalid('payload')
            value = {**old, 'version': version}
        else:
            payload = obj(data['payload'], 'payload')
            if payload.get('id') != entity_id:
                raise invalid('id')
            if is_plan:
                value = self.meals.plan_payload(conn, owner, entity_id, payload, version, old)
            else:
                value = self.consumption.payload(conn, owner, entity_id, payload, version, old)
                if self.consumption.has_other_plan_record(conn, owner, value):
                    raise invalid('planEntryId', 'Rencana makan ini sudah dicatat.')
        if is_plan:
            self.meals.save_plan(conn, owner, value, action == 'DELETE')
        else:
            self.consumption.save_record(conn, owner, value, action == 'DELETE')
        return {'status': 'ACCEPTED', 'version': version}
