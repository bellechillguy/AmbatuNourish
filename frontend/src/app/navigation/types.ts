import type { NavigatorScreenParams } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ManualProductInput, MealSlot, QuantityUnit } from '../../shared/domain/types';

/** IA dari Figma `16. Handoff`: 5 tab, tiap tab punya stack sendiri; scanner/editor = modal. */

export type HomeStackParamList = {
  Home: undefined;
};

export type ProductStackParamList = {
  ProductSearch: undefined;
  SearchResults: { query: string; filter?: 'ALL' | 'OPEN_FOOD_FACTS' | 'USER_ENTERED' };
  RegionalFoods: undefined;
  RegionalFoodDetail: { id: string };
  Compare: undefined;
};

export type PlanStackParamList = {
  PlanHome:
    | {
        view?: 'calendar' | 'favorites';
        date?: string;
        addSlot?: MealSlot;
        /** Prefill J3 dengan produk (dari hasil penilaian F2). */
        addProduct?: { id: string; name: string; quantity: number; unit: QuantityUnit; source: 'OPEN_FOOD_FACTS' | 'USER_ENTERED' };
        /** Prefill J3 dengan favorit (dari I3 "Tambahkan ke rencana"). */
        addFavoriteId?: string;
        /** Penanda unik agar param baru selalu memicu sheet. */
        nonce?: number;
      }
    | undefined;
};

export type SummaryStackParamList = {
  SummaryHome: { view?: 'summary' | 'history'; date?: string } | undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Preferences: undefined;
};

export type TabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  ProductTab: NavigatorScreenParams<ProductStackParamList>;
  PlanTab: NavigatorScreenParams<PlanStackParamList>;
  SummaryTab: NavigatorScreenParams<SummaryStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type LogFormParams = {
  source: 'SCAN' | 'SEARCH' | 'MANUAL' | 'FAVORITE' | 'PLAN';
  productId?: string;
  favoriteId?: string;
  /** Mode ubah (K4). */
  recordId?: string;
  /** Tanggal preset (L3 "Catat untuk 16 Nov"). */
  date?: string;
  quantity?: number;
};

export type RootStackParamList = {
  // Signed-out
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetLinkSent: { email: string };
  // Signed-in
  RegisterSuccess: undefined;
  Main: NavigatorScreenParams<TabParamList>;
  // Pindai (modal)
  CameraPermission: undefined;
  Scanner: undefined;
  CameraDenied: undefined;
  Lookup: { barcode: string };
  ProductNotFound: { barcode: string };
  // Produk & penilaian
  ProductDetail: { productId: string };
  AssessmentResult: { productId: string; quantity: number; unit: QuantityUnit };
  ManualProductForm: { barcode?: string; name?: string; productId?: string } | undefined;
  ManualProductReview: { input: ManualProductInput; productId?: string };
  // Preferensi
  PreferenceEdit: { preferenceId?: string; onboarding?: boolean } | undefined;
  NutritionPlan: undefined;
  SourceConflict: { conflictId: string };
  // Favorit & rencana
  FavoriteDetail: { favoriteId: string };
  FavoriteEdit: { favoriteId?: string; productId?: string } | undefined;
  PlanDetail: { planId: string; markConsumed?: boolean };
  LocationPermission: { planId: string };
  ManualLocation: { planId: string; denied?: boolean };
  RestaurantResults: { planId: string; kind: 'GPS' | 'MANUAL'; text?: string; latitude?: number; longitude?: number };
  // Catat konsumsi (modal)
  LogSource: { date?: string } | undefined;
  LogForm: LogFormParams;
  // Profil
  EditProfile: undefined;
  AccessibilitySettings: undefined;
  About: undefined;
  SyncStatus: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** Navigasi root dari layar mana pun (termasuk di dalam tab). */
export function useRootNav() {
  return useNavigation<RootNav>();
}
