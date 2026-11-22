import { request } from '../shared/api/ApiService';

export interface RegionalFoodSummary {
  id: string;
  name: string;
  region: string;
}

interface RegionalFoodVariant {
  id: string;
  name: string;
  portionQuantity: number;
  portionUnit: string;
  nutrition: Record<string, number> | null;
  source: string;
}

export interface RegionalFood extends RegionalFoodSummary {
  story: string;
  variants: RegionalFoodVariant[];
}

export const regionalFoodsService = {
  search(query: string): Promise<RegionalFoodSummary[]> {
    return request('/regional-foods', { query: { q: query } });
  },
  detail(id: string): Promise<RegionalFood> {
    return request(`/regional-foods/${encodeURIComponent(id)}`);
  },
};
