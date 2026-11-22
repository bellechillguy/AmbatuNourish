// @ts-check
import { config } from './config';
import { AppError } from './errors';

/** @type {string | null} */
let authToken = null;

/** @type {(() => void) | null} */
let onUnauthorized = null;

/** @param {string | null} token */
export function setAuthToken(token) {
  authToken = token;
}

/** @param {(() => void) | null} handler */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/**
 * @typedef {Record<string, string | number | undefined>} Query
 */

/**
 * @typedef {object} RequestOptions
 * @property {'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'} [method]
 * @property {unknown} [body]
 * @property {Query} [query]
 * @property {boolean} [auth]
 */

/**
 * @param {string} path
 * @param {Query} [query]
 */
function buildUrl(path, query) {
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

/**
 * @template T
 * @param {string} path
 * @param {RequestOptions} [opts]
 * @returns {Promise<T>}
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body, query, auth = true } = opts;
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = auth ? authToken : null;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  /** @type {Response} */
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = /** @type {{ name?: string } | null} */ (e)?.name === 'AbortError';
    throw new AppError(aborted ? 'TIMEOUT' : 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return /** @type {T} */ (undefined);

  /** @type {unknown} */
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.ok) return /** @type {T} */ (json);
  if (res.status === 401 && sentToken && sentToken === authToken) onUnauthorized?.();
  throw mapError(res.status, json);
}

/**
 * @param {number} status
 * @param {unknown} json
 * @returns {AppError}
 */
function mapError(status, json) {
  const details = /** @type {{ code?: string, data?: Record<string, { message?: string }> } | null} */ (json);
  const data = details?.data;
  if (details?.code === 'CONTRACT_PENDING') return new AppError('CONTRACT_PENDING', undefined, { status });
  if (details?.code === 'OFF_RATE_LIMITED') return new AppError('RATE_LIMITED', undefined, { status });
  if (details?.code === 'OFF_TIMEOUT' || details?.code === 'PARTNER_TIMEOUT') return new AppError('TIMEOUT', undefined, { status });
  const fieldErrors = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v?.message ?? 'Tidak valid']))
    : undefined;

  if (status === 401 || status === 403) {
    return new AppError('UNAUTHORIZED', undefined, { status });
  }
  if (status === 400 || status === 422) return new AppError('VALIDATION', undefined, { status, fieldErrors });
  if (status === 404) return new AppError('NOT_FOUND', undefined, { status });
  if (status === 409) return new AppError('CONFLICT', undefined, { status });
  if (status === 429) return new AppError('RATE_LIMITED', undefined, { status });
  if (details?.code?.startsWith('OFF_') || details?.code?.startsWith('PARTNER_')) {
    return new AppError('PARTNER_UNAVAILABLE', undefined, { status });
  }
  return new AppError('SERVER', undefined, { status });
}
