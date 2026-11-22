import json
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .common import ApiError, encode, invalid, missing, pending


MAX_RESPONSE_BYTES = 2 * 1024 * 1024


def unavailable():
    return ApiError(502, 'PARTNER_UNAVAILABLE', 'Layanan mitra sedang tidak tersedia.')


def invalid_response():
    return ApiError(502, 'PARTNER_INVALID_RESPONSE', 'Respons dari layanan mitra tidak valid.')


def timed_out():
    return ApiError(504, 'PARTNER_TIMEOUT', 'Layanan mitra terlalu lama merespons.')


def unauthorized():
    return ApiError(401, 'UNAUTHORIZED', 'Email, kata sandi, atau sesi tidak valid.')


def partner_error(status, *, forwards_identity=False, forwards_missing=False):
    if status == 401 and forwards_identity:
        return unauthorized()
    if status == 404 and forwards_missing:
        return missing()
    if status == 422 and forwards_identity:
        return invalid('email', 'Periksa email dan kata sandi.')
    if status == 429:
        return ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan ke layanan mitra.')
    if status == 504:
        return timed_out()
    return unavailable()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Jangan teruskan JWT atau API key ke origin tujuan redirect.
        return None


class JsonPartnerHttp:
    def __init__(self, base_url, headers=None, *, timeout=4):
        parts = urlsplit(base_url)
        local_http = parts.scheme == 'http' and parts.hostname in ('127.0.0.1', '::1', 'localhost')
        if (not parts.hostname or not (parts.scheme == 'https' or local_http)
                or parts.username is not None or parts.password is not None
                or parts.query or parts.fragment):
            raise ValueError('URL layanan mitra harus HTTPS atau HTTP loopback untuk pengujian lokal.')
        self.base_url = base_url.rstrip('/')
        self.headers = headers or {}
        self.timeout = timeout
        self.opener = build_opener(NoRedirect())

    def request(self, path, *, method='GET', body=None, query=None, token=None):
        headers = {'Accept': 'application/json', **self.headers}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if token is not None:
            headers['Authorization'] = 'Bearer ' + token
        url = self.base_url + path + ('?' + urlencode(query) if query else '')
        req = Request(url, data=encode(body).encode() if body is not None else None,
                      headers=headers, method=method)
        try:
            try:
                response = self.opener.open(req, timeout=self.timeout)
            except HTTPError as error:
                response = error
            with response:
                status = response.code
                payload = response.read(MAX_RESPONSE_BYTES + 1)
        except TimeoutError:
            raise timed_out() from None
        except URLError as error:
            raise (timed_out() if isinstance(error.reason, TimeoutError) else unavailable()) from None
        except (OSError, HTTPException, ValueError):
            raise unavailable() from None
        if len(payload) > MAX_RESPONSE_BYTES:
            raise invalid_response()
        try:
            return status, json.loads(payload)
        except (ValueError, UnicodeError, RecursionError):
            if not 200 <= status < 300:
                return status, None
            raise invalid_response() from None


class IntegrationClient:
    def __init__(self, url, key):
        self.http = JsonPartnerHttp(url, {'X-Integration-Key': key}, timeout=5)

    def request(self, path, *, identity=False, detail=False, **options):
        status, data = self.http.request(path, **options)
        if status == 200:
            return data
        code = data.get('code') if isinstance(data, dict) else None
        if status == 503 and code == 'CONTRACT_PENDING':
            raise pending()
        if status == 502 and code == 'PARTNER_INVALID_RESPONSE':
            raise invalid_response()
        raise partner_error(status, forwards_identity=identity, forwards_missing=detail)
