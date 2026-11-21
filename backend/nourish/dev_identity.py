"""Local development identity. The database is separate from core user data."""
import hashlib
import hmac
import re
import secrets
import sqlite3
import time

from .common import ApiError, invalid, new_id, pending, text
from .db import Database


def unauthorized():
    return ApiError(401, 'UNAUTHORIZED', 'Email, kata sandi, atau sesi tidak valid.')


class DevIdentity:
    def __init__(self, path):
        self.db = Database(path, migrations=False)
        self.dummy_hash = self.password_hash('', secrets.token_hex(16))
        with self.db.connection(write=True) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
                salt TEXT NOT NULL, password TEXT NOT NULL
            )''')
            conn.execute('''CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
            )''')

    @staticmethod
    def password_hash(password, salt):
        return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1).hex()

    @staticmethod
    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def session(conn, profile):
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        conn.execute('DELETE FROM sessions WHERE expires_at <= ?', (now,))
        conn.execute('INSERT INTO sessions VALUES (?, ?, ?)', (DevIdentity.token_hash(token), profile['id'], now + 86400))
        return {'token': token, 'user': profile}

    @staticmethod
    def credentials(body):
        email = text(body.get('email'), 'email', maximum=254).lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            raise invalid('email', 'Masukkan alamat email yang valid.')
        password = body.get('password')
        if not isinstance(password, str) or not 1 <= len(password) <= 256:
            raise invalid('password')
        return email, password

    def register(self, body):
        email, password = self.credentials(body)
        if len(password) < 8:
            raise invalid('password', 'Gunakan minimal 8 karakter.')
        profile = {'id': new_id(), 'name': text(body.get('name'), 'name'), 'email': email}
        salt = secrets.token_hex(16)
        digest = self.password_hash(password, salt)
        try:
            with self.db.connection(write=True) as conn:
                conn.execute('INSERT INTO users VALUES (?, ?, ?, ?, ?)', (profile['id'], profile['name'], profile['email'], salt, digest))
                return self.session(conn, profile)
        except sqlite3.IntegrityError:
            raise invalid('email', 'Email ini sudah terdaftar.') from None

    def login(self, body):
        email, password = self.credentials(body)
        with self.db.connection() as conn:
            row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        digest = self.password_hash(password, row['salt'] if row else '00' * 16)
        matches = hmac.compare_digest(digest, row['password'] if row else self.dummy_hash)
        if not row or not matches:
            raise unauthorized()
        with self.db.connection(write=True) as conn:
            return self.session(conn, {key: row[key] for key in ('id', 'name', 'email')})

    def profile(self, token):
        if not token:
            raise unauthorized()
        with self.db.connection() as conn:
            result = conn.execute('''SELECT u.id, u.name, u.email FROM users u
                JOIN sessions s ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?''',
                (self.token_hash(token), int(time.time()))).fetchone()
        if not result:
            raise unauthorized()
        return dict(result)

    def update_profile(self, token, body):
        user = self.profile(token)
        name = text(body.get('name'), 'name')
        with self.db.connection(write=True) as conn:
            conn.execute('UPDATE users SET name = ? WHERE id = ?', (name, user['id']))
        return {**user, 'name': name}

    def logout(self, token):
        if token:
            with self.db.connection(write=True) as conn:
                conn.execute('DELETE FROM sessions WHERE token_hash = ?', (self.token_hash(token),))

    def request_reset(self, body):
        # to do: reset kata sandi menggunakan Identity & Access Ambatufit, termasuk pengiriman email.
        raise pending()
