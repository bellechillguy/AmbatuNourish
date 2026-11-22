import json
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .common import (SUMMARY_METRICS, choice, date_key, encode, facts, identifier, integer, invalid,
                     iso, optional_fields, portion, text, timestamp)


SOURCES = ('SCAN', 'SEARCH', 'MANUAL', 'FAVORITE', 'PLAN')


class Consumption:
    def __init__(self, db, meals, catalog, partner):
        self.db = db
        self.meals = meals
        self.catalog = catalog
        self.partner = partner

    def payload(self, conn, owner, record_id, data, version, previous):
        source = choice(data.get('source'), 'source', SOURCES)
        product_id, favorite_id, plan_id = (data.get(key) for key in ('productId', 'favoriteId', 'planEntryId'))
        for key, reference in (('productId', product_id), ('favoriteId', favorite_id), ('planEntryId', plan_id)):
            if reference is not None:
                identifier(reference, key)
        if (source == 'PLAN') != (plan_id is not None):
            raise invalid('planEntryId', 'Sumber rencana memerlukan satu rencana makan.')
        if previous:
            for key, value in (('source', source), ('productId', product_id), ('favoriteId', favorite_id), ('planEntryId', plan_id)):
                if previous.get(key) != value:
                    raise invalid(key, 'Sumber catatan konsumsi tidak dapat diganti.')
        if not previous:
            if plan_id:
                self.meals.active_plan(conn, owner, plan_id)
            elif favorite_id:
                self.meals.favored(conn, owner, favorite_id)
            elif product_id:
                self.catalog.get(owner, product_id, conn)
        serving = portion(data)
        snapshot = facts(data.get('snapshot'))
        return {
            **serving, 'id': record_id, 'consumedAt': timestamp(data.get('consumedAt'), 'consumedAt', past=True),
            'title': text(data.get('title'), 'title', maximum=300), 'source': source, 'snapshot': snapshot,
            'itemsCount': integer(data.get('itemsCount'), 'itemsCount', minimum=1, maximum=30),
            'version': version, 'syncStatus': 'SYNCED',
            **optional_fields(productId=product_id, favoriteId=favorite_id, planEntryId=plan_id),
        }

    @staticmethod
    def stored_record(conn, owner, record_id):
        return conn.execute('SELECT * FROM consumption_records WHERE owner = ? AND id = ?', (owner, record_id)).fetchone()

    @staticmethod
    def has_other_plan_record(conn, owner, record):
        plan_id = record.get('planEntryId')
        return plan_id and conn.execute('''SELECT 1 FROM consumption_records
            WHERE owner = ? AND plan_id = ? AND deleted = 0 AND id <> ?''', (owner, plan_id, record['id'])).fetchone()

    @staticmethod
    def save_record(conn, owner, record, deleted):
        conn.execute('''INSERT INTO consumption_records (owner,id,consumed_at,plan_id,version,deleted,updated_at,body)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET consumed_at=excluded.consumed_at,
            plan_id=excluded.plan_id,version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at,body=excluded.body''',
            (owner, record['id'], record['consumedAt'], record.get('planEntryId'), record['version'],
             deleted, iso(), encode(record)))
        # to do: setelah kontrak Ambatufit tersedia, tulis event outbox dalam transaksi ini dan kirim lewat adapter di luar STB.

    @staticmethod
    def consumed_plans(conn, owner):
        return dict(conn.execute('''SELECT plan_id, consumed_at FROM consumption_records
            WHERE owner = ? AND plan_id IS NOT NULL AND deleted = 0''', (owner,)).fetchall())

    @staticmethod
    def read_records(conn, owner, begin=None, end=None):
        sql = 'SELECT body FROM consumption_records WHERE owner = ? AND deleted = 0'
        params = [owner]
        if begin is not None and end is not None:
            sql += ' AND consumed_at >= ? AND consumed_at < ?'
            params.extend([begin, end])
        sql += ' ORDER BY consumed_at DESC, id'
        return [json.loads(row['body']) for row in conn.execute(sql, params)]

    def targets(self, owner):
        plan = self.partner.nutrition_plan(owner)
        return plan.daily_targets if plan else {}

    def summary(self, owner, day, timezone):
        day = date.fromisoformat(date_key(day))
        try:
            zone = ZoneInfo(timezone)
            start = datetime.combine(day, time.min, zone)
            end = datetime.combine(day + timedelta(days=1), time.min, zone)
            begin_utc, end_utc = timestamp(start.isoformat(), 'date'), timestamp(end.isoformat(), 'date')
        except (ZoneInfoNotFoundError, ValueError, OverflowError):
            raise invalid('timezone', 'Gunakan zona waktu IANA yang valid.') from None
        with self.db.connection() as conn:
            records = self.read_records(conn, owner, begin_utc, end_utc)
        totals, missing_count = dict.fromkeys(SUMMARY_METRICS, 0), dict.fromkeys(SUMMARY_METRICS, 0)
        for record in records:
            for key in SUMMARY_METRICS:
                value = record['snapshot'][key]
                if value is None:
                    missing_count[key] += 1
                else:
                    totals[key] += value
        return {
            'date': day.isoformat(), 'recordCount': len(records), 'totals': totals, 'missingCount': missing_count,
            'incompleteCount': sum(any(record['snapshot'][key] is None for key in SUMMARY_METRICS) for record in records),
            'targets': self.targets(owner),
        }
