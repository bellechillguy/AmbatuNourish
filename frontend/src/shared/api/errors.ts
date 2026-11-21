/**
 * Error tingkat aplikasi (requirements §8.6). Pesan mentah server / stack trace
 * tidak pernah ditampilkan ke pengguna; UI memetakan `kind` ke salinan Bahasa Indonesia.
 */
export type AppErrorKind =
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PARTNER_UNAVAILABLE'
  | 'SERVER'
  | 'CONTRACT_PENDING'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Error per field dari server (mis. { email: '...' }). */
  readonly fieldErrors?: Record<string, string>;
  readonly status?: number;

  constructor(kind: AppErrorKind, message?: string, opts?: { fieldErrors?: Record<string, string>; status?: number }) {
    super(message ?? kind);
    this.kind = kind;
    this.fieldErrors = opts?.fieldErrors;
    this.status = opts?.status;
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  return new AppError('UNKNOWN');
}

/** Salinan pengguna untuk setiap jenis error. */
export function errorMessage(e: unknown): string {
  const err = toAppError(e);
  switch (err.kind) {
    case 'OFFLINE':
      return 'Tidak dapat terhubung. Periksa koneksi Anda.';
    case 'TIMEOUT':
      return 'Server terlalu lama merespons. Coba lagi.';
    case 'UNAUTHORIZED':
      return 'Sesi Anda berakhir. Silakan masuk lagi.';
    case 'VALIDATION':
      return 'Ada isian yang perlu diperbaiki.';
    case 'NOT_FOUND':
      return 'Data tidak ditemukan.';
    case 'CONFLICT':
      return 'Data ini diubah di tempat lain.';
    case 'RATE_LIMITED':
      return 'Terlalu banyak permintaan. Coba beberapa saat lagi.';
    case 'PARTNER_UNAVAILABLE':
      return 'Layanan mitra sedang tidak tersedia.';
    case 'CONTRACT_PENDING':
      return 'Fitur ini menunggu integrasi dengan layanan mitra.';
    case 'SERVER':
      return 'Terjadi gangguan di server. Coba lagi.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}
