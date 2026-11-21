import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Penyimpanan lokal:
 *  - SecureStore  → token sesi (FR-AUTH-08). Tidak ada kata sandi tersimpan.
 *  - AsyncStorage → cache produk, antrean sinkronisasi, rencana & catatan (dipisah per pengguna).
 * Catatan: Expo SQLite adalah opsi PROPOSED untuk antrean yang lebih besar; AsyncStorage dipilih
 * di sini agar sederhana. Ganti adapter di file ini bila tim memutuskan SQLite.
 */
const TOKEN_KEY = 'ambatunourish.session';

export const secureSession = {
  async load(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async save(value: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Penyimpanan penuh/gagal: data tetap ada di memori sesi ini.
  }
}

/** Hapus semua data lokal milik pengguna (logout / sesi kedaluwarsa). */
export async function clearUserData(userId: string) {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.includes(`:${userId}:`) || k.endsWith(`:${userId}`)));
}

export const userKey = (userId: string, name: string) => `ambatunourish:${userId}:${name}`;
