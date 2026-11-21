/**
 * Meal Planning (core) — hidangan favorit + penemuan restoran via Ambatueat.
 * Rencana makan sendiri dikelola offline-first lewat OfflineDataProvider + sync.
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import type { FavoriteMeal, MealPlanEntry, Restaurant } from '../shared/domain/types';
import { computeTotals, demoFavorites, demoRestaurants } from './fixtures';
import { delay, ensureOnline } from './network';

export interface LocationQuery {
  kind: 'GPS' | 'MANUAL';
  latitude?: number;
  longitude?: number;
  text?: string;
}

export interface MealPlanningService {
  listFavorites(): Promise<FavoriteMeal[]>;
  getFavorite(id: string): Promise<FavoriteMeal>;
  saveFavorite(fav: Omit<FavoriteMeal, 'id' | 'totals' | 'completeness' | 'outcome'> & { id?: string }): Promise<FavoriteMeal>;
  deleteFavorite(id: string): Promise<void>;
  /** Ambatueat lewat backend/ACL — kontrak lokasi & hasil PENDING. */
  findRestaurants(entry: MealPlanEntry, location: LocationQuery): Promise<Restaurant[]>;
  suggestLocations(text: string): Promise<{ title: string; kind: string }[]>;
}

class HttpMealPlanningService implements MealPlanningService {
  private pending(): never {
    throw new AppError('CONTRACT_PENDING');
  }
  async listFavorites(): Promise<FavoriteMeal[]> {
    return this.pending();
  }
  async getFavorite(): Promise<FavoriteMeal> {
    return this.pending();
  }
  async saveFavorite(): Promise<FavoriteMeal> {
    return this.pending();
  }
  async deleteFavorite(): Promise<void> {
    return this.pending();
  }
  async findRestaurants(): Promise<Restaurant[]> {
    return this.pending();
  }
  async suggestLocations(): Promise<{ title: string; kind: string }[]> {
    return this.pending();
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
