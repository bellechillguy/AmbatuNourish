/**
 * Konfigurasi lingkungan. Nilai EXPO_PUBLIC_* dibaca saat build (lihat .env.example).
 * Tidak ada API key mitra di bundle mobile (FR-AUTH-08, NFR-12).
 */
const rawUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8081/api';

export const config = {
  /** Base URL gateway Nginx / Cloudflare Tunnel, mis. https://xxx.trycloudflare.com/api */
  apiBaseUrl: rawUrl.replace(/\/+$/, ''),
  /** Mode demo: repository memakai fixture di perangkat. Default true sampai kontrak API tersedia. */
  useMock: (process.env.EXPO_PUBLIC_USE_MOCK ?? 'true') !== 'false',
  requestTimeoutMs: 10_000,
} as const;
