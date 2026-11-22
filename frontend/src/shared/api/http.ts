import { config } from './config';
import { AppError } from './errors';

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
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
  const { method = 'GET', body, query, auth = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const sentToken = auth ? authToken : null;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

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
  if (res.status === 401 && sentToken && sentToken === authToken) onUnauthorized?.();
  throw mapError(res.status, json);
}

function mapError(status: number, json: unknown): AppError {
  const details = json as { code?: string; data?: Record<string, { message?: string }> } | null;
  const data = details?.data;
  if (details?.code === 'CONTRACT_PENDING') return new AppError('CONTRACT_PENDING', undefined, { status });
  if (details?.code === 'OFF_RATE_LIMITED') return new AppError('RATE_LIMITED', undefined, { status });
  if (details?.code === 'OFF_TIMEOUT') return new AppError('TIMEOUT', undefined, { status });
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
  if (details?.code?.startsWith('OFF_')) return new AppError('PARTNER_UNAVAILABLE', undefined, { status });
  return new AppError('SERVER', undefined, { status });
}
