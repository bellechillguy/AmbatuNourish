import { config } from './config';
import { AppError } from './errors';

/**
 * Klien HTTP terpusat ke gateway AmbatuNourish (Nginx → service).
 * Konvensi mengikuti gateway yang sudah ada di repo (PocketBase):
 *   - list   → { items, page, perPage, totalItems, totalPages }
 *   - auth   → POST /auth/auth-with-password → { token, record }
 *   - token  → header "Authorization: Bearer <token>"
 *   - error  → { status, message, data: { field: { code, message } } }
 */

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export interface ListResponse<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
  /** Kunci idempotensi untuk operasi yang dapat diulang (sinkronisasi offline). */
  idempotencyKey?: string;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, idempotencyKey } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = (e as { name?: string })?.name === 'AbortError';
    throw new AppError(aborted ? 'TIMEOUT' : 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.ok) return json as T;
  throw mapError(res.status, json);
}

function mapError(status: number, json: unknown): AppError {
  const data = (json as { data?: Record<string, { message?: string }> } | null)?.data;
  const fieldErrors = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v?.message ?? 'Tidak valid']))
    : undefined;

  if (status === 401 || status === 403) {
    onUnauthorized?.();
    return new AppError('UNAUTHORIZED', undefined, { status });
  }
  if (status === 400 || status === 422) return new AppError('VALIDATION', undefined, { status, fieldErrors });
  if (status === 404) return new AppError('NOT_FOUND', undefined, { status });
  if (status === 409) return new AppError('CONFLICT', undefined, { status });
  if (status === 429) return new AppError('RATE_LIMITED', undefined, { status });
  if (status === 502 || status === 503 || status === 504) return new AppError('PARTNER_UNAVAILABLE', undefined, { status });
  return new AppError('SERVER', undefined, { status });
}

/** Escape nilai string untuk filter PocketBase: title~'kopi' */
export function pbString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
