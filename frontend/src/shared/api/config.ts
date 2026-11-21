/**
 * Konfigurasi lingkungan. Nilai EXPO_PUBLIC_* dibaca saat build (lihat .env.example).
 * Tidak ada API key mitra di bundle mobile (FR-AUTH-08, NFR-12).
 */
import { Platform } from 'react-native';

const localHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const rawUrl = process.env.EXPO_PUBLIC_API_URL || `http://${localHost}:8081/api`;

export const config = {
  /** Base URL gateway Nginx / Cloudflare Tunnel, mis. https://xxx.trycloudflare.com/api */
  apiBaseUrl: rawUrl.replace(/\/+$/, ''),
  /** Mode demo: repository memakai fixture di perangkat. Aktifkan secara eksplisit untuk menggunakan fixture. */
  useMock: process.env.EXPO_PUBLIC_USE_MOCK === 'true',
  requestTimeoutMs: 10_000,
} as const;
