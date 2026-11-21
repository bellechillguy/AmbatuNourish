/**
 * Meal Planning (core) — hidangan favorit + penemuan restoran via Ambatueat.
 * Rencana makan sendiri dikelola offline-first lewat OfflineDataProvider + sync.
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import { request } from '../shared/api/http';
import type { FavoriteMeal, MealPlanEntry, Restaurant } from '../shared/domain/types';
import { computeTotals, demoFavorites, demoRestaurants } from './fixtures';
import { readJson, userKey, writeJson } from '../shared/state/storage';
import { delay, ensureOnline } from './network';

export interface LocationQuery {
  kind: 'GPS' | 'MANUAL';
  latitude?: number;
  longitude?: number;
  text?: string;
}

export interface MealPlanningService {
  listFavorites(userId?: string): Promise<FavoriteMeal[]>;
  getFavorite(id: string, userId?: string): Promise<FavoriteMeal>;
  saveFavorite(fav: Omit<FavoriteMeal, 'id' | 'totals' | 'completeness' | 'outcome'> & { id?: string }): Promise<FavoriteMeal>;
  deleteFavorite(id: string): Promise<void>;
  /** Ambatueat lewat backend/ACL — kontrak lokasi & hasil PENDING. */
  findRestaurants(entry: MealPlanEntry, location: LocationQuery): Promise<Restaurant[]>;
  suggestLocations(text: string): Promise<{ title: string; kind: string }[]>;
}

class HttpMealPlanningService implements MealPlanningService {
  private async cachedFavorites(userId?: string): Promise<FavoriteMeal[] | null> {
    return userId ? readJson<FavoriteMeal[] | null>(userKey(userId, 'favorite-list'), null) : null;
  }

  async listFavorites(userId?: string): Promise<FavoriteMeal[]> {
    try {
      const favorites: FavoriteMeal[] = [];
      for (let page = 1; ; page += 1) {
        const batch = await request<FavoriteMeal[]>('/favorites', { query: { page } });
        favorites.push(...batch);
        if (batch.length < 50) break;
      }
      if (userId) await writeJson(userKey(userId, 'favorite-list'), favorites);
      return favorites;
    } catch (error) {
      if (error instanceof AppError && ['OFFLINE', 'TIMEOUT', 'SERVER'].includes(error.kind)) {
        const cached = await this.cachedFavorites(userId);
        if (cached) return cached;
      }
      throw error;
    }
  }

  async getFavorite(id: string, userId?: string): Promise<FavoriteMeal> {
    try {
      return await request(`/favorites/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof AppError && ['OFFLINE', 'TIMEOUT', 'SERVER'].includes(error.kind)) {
        const cached = (await this.cachedFavorites(userId))?.find((favorite) => favorite.id === id);
        if (cached) return cached;
      }
      throw error;
    }
  }

  saveFavorite(fav: Parameters<MealPlanningService['saveFavorite']>[0]): Promise<FavoriteMeal> {
    const { id, ...body } = fav;
    return id
      ? request(`/favorites/${encodeURIComponent(id)}`, { method: 'PUT', body })
      : request('/favorites', { method: 'POST', body });
  }

  deleteFavorite(id: string): Promise<void> {
    return request(`/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  findRestaurants(entry: MealPlanEntry, location: LocationQuery): Promise<Restaurant[]> {
    return request('/restaurants/search', { method: 'POST', body: { planId: entry.id, location } });
  }

  suggestLocations(text: string): Promise<{ title: string; kind: string }[]> {
    if (!text.trim()) return Promise.resolve([]);
    return request('/restaurants/locations', { query: { q: text.trim() } });
  }
}

/** Mode demo: setel ke true untuk mencoba state M5 (mitra tidak tersedia). */
export const demoFlags = { partnerDown: false, emptyRestaurants: false };

class MockMealPlanningService implements MealPlanningService {
  private favorites: FavoriteMeal[] = demoFavorites.map((f) => ({ ...f, items: f.items.slice() }));

  async listFavorites(): Promise<FavoriteMeal[]> {
    await delay(250);
    return this.favorites.map((f) => ({ ...f }));
  }

  async getFavorite(id: string): Promise<FavoriteMeal> {
    await delay(150);
    const f = this.favorites.find((x) => x.id === id);
    if (!f) throw new AppError('NOT_FOUND');
    return { ...f };
  }

  async saveFavorite(input: Omit<FavoriteMeal, 'id' | 'totals' | 'completeness' | 'outcome'> & { id?: string }): Promise<FavoriteMeal> {
    await delay();
    ensureOnline();
    const totals = computeTotals(input.items);
    const incomplete = Object.values(totals).some((v) => v === null);
    const existing = input.id ? this.favorites.find((f) => f.id === input.id) : undefined;
    const fav: FavoriteMeal = {
      ...input,
      id: input.id ?? `fav-${Date.now()}`,
      totals,
      completeness: incomplete ? 'INCOMPLETE' : 'COMPLETE',
      // Penilaian dikembalikan service; mock mempertahankan hasil lama bila ada.
      outcome: existing?.outcome,
    };
    if (existing) this.favorites = this.favorites.map((f) => (f.id === fav.id ? fav : f));
    else this.favorites.unshift(fav);
    return fav;
  }

  async deleteFavorite(id: string): Promise<void> {
    await delay();
    ensureOnline();
    this.favorites = this.favorites.filter((f) => f.id !== id);
  }

  async findRestaurants(_entry: MealPlanEntry, _location: LocationQuery): Promise<Restaurant[]> {
    await delay(800);
    ensureOnline();
    if (demoFlags.partnerDown) throw new AppError('PARTNER_UNAVAILABLE');
    if (demoFlags.emptyRestaurants) return [];
    return demoRestaurants;
  }

  async suggestLocations(text: string): Promise<{ title: string; kind: string }[]> {
    await delay(200);
    if (!text.trim()) return [];
    return [
      { title: 'Coblong, Kota Bandung', kind: 'Kecamatan' },
      { title: 'Jl. Ganesa, Coblong, Bandung', kind: 'Jalan' },
    ];
  }
}

export const mealPlanningService: MealPlanningService = config.useMock ? new MockMealPlanningService() : new HttpMealPlanningService();
