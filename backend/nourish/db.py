import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, path, migrations=True):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as conn:
            conn.execute('PRAGMA journal_mode = WAL')
        if migrations:
            self.migrate()

    @contextmanager
    def connection(self, *, write=False, read_transaction=False):
        conn = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        try:
            if write or read_transaction:
                conn.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
            yield conn
            if conn.in_transaction:
                conn.commit()
        except BaseException:
            if conn.in_transaction:
                conn.rollback()
            raise
        finally:
            conn.close()

    def migrate(self):
        with self.connection(write=True) as conn:
            current = conn.execute('PRAGMA user_version').fetchone()[0]
            migrations = [(int(path.stem.split('_', 1)[0]), path)
                          for path in sorted(Path(__file__).with_name('migrations').glob('*.sql'))]
            if current > migrations[-1][0]:
                raise RuntimeError('Database lebih baru daripada versi backend.')
            for version, migration in migrations:
                if version > current:
                    for statement in migration.read_text().split(';'):
                        if statement.strip():
                            conn.execute(statement)
                    conn.execute(f'PRAGMA user_version = {version}')
