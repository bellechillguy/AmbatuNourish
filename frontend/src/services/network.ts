/**
 * Status jaringan yang dapat dibaca service (diisi oleh ConnectivityProvider).
 * Dipakai agar repository mengembalikan error OFFLINE sebelum memanggil jaringan.
 */
import { AppError } from '../shared/api/errors';

let online = true;

export function setOnline(value: boolean) {
  online = value;
}

export function isOnline() {
  return online;
}

export function ensureOnline() {
  if (!online) throw new AppError('OFFLINE');
}

/** Latensi buatan untuk mode demo agar state loading terlihat. */
export function delay(ms = 350) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
