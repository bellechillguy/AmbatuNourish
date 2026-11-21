# AmbatuNourish — Mobile Frontend (React Native + Expo)

Frontend aplikasi **AmbatuNourish** (iOS & Android) yang diimplementasikan dari Figma
[AmbatuNourish → halaman Hi-Fi](https://www.figma.com/design/119c2gcUvMpK61X6yGU5KD/AmbatuNourish?node-id=66-101)
dan `requirements.md`. Folder ini dirancang untuk diletakkan sebagai `frontend/` di root repo
`AmbatuNourish`, berdampingan dengan backend (PocketBase + gateway Nginx) tanpa menyentuhnya.

> Status: semua frame Hi-Fi `A1`–`O3` sudah diimplementasikan. Aplikasi berjalan penuh dalam
> **mode demo** (fixture di perangkat). Kontrak API AmbatuNourish, Ambatufit, dan Ambatueat
> masih **PENDING**, jadi sebagian besar endpoint sengaja belum dibuat (lihat bagian *Dependensi*).

---

## 1. Menjalankan

```bash
cd frontend
npm install
npx expo install --fix        # menyelaraskan versi paket dengan SDK Expo yang terpasang
cp .env.example .env          # atur EXPO_PUBLIC_API_URL / EXPO_PUBLIC_USE_MOCK
npx expo start                # tekan a (Android) / i (iOS), atau scan QR di Expo Go
```

- Kamera (pindai barcode) dan lokasi memakai modul Expo; untuk build native gunakan
  `npx expo run:android` / `npx expo run:ios` atau EAS Build.
- `npm run typecheck` dan `npm test` (jest-expo) tersedia.

### Mode demo (default, `EXPO_PUBLIC_USE_MOCK=true`)

| Kebutuhan | Nilai |
|---|---|
| Akun demo | `rani.pratiwi@email.com` / `demo12345` (atau daftar akun baru) |
| Barcode ditemukan | `8990001112223` (Susu UHT Cokelat Rendah Gula) |
| Barcode tidak ditemukan (C6) | `8991234567890` |
| Produk tidak lengkap + cache (D5/F4) | cari "biskuit gandum utuh" |
| Kurang Cocok (F3) | cari "teh melati manis", porsi 350 ml |
| Satuan berbeda (G3) | bandingkan biskuit + "teh melati tanpa gula" |

Di **Profil → Tentang AmbatuNourish → Mode demo** ada sakelar untuk mencoba state lain:
simulasi offline (B3, D6, sinkronisasi tertunda), Ambatueat tidak tersedia (M5), tidak ada
restoran (M4), konflik sinkronisasi (O2), gagal sinkronisasi (O1), dan tanpa target harian (L2).
Semua data demo ditandai sebagai contoh dan tidak dipakai saat `USE_MOCK=false`.

### Terhubung ke backend (`EXPO_PUBLIC_USE_MOCK=false`)

`EXPO_PUBLIC_API_URL` diarahkan ke gateway (mis. `http://IP_SERVER:8081/api` atau URL
Cloudflare Tunnel). Konvensi klien HTTP (`src/shared/api/http.ts`) mengikuti gateway yang sudah
ada di repo: list `{ items, page, totalItems }`, login `POST /auth/auth-with-password →
{ token, record }`, header `Authorization: Bearer`, error PocketBase `{ data: { field: { message } } }`.

| Area | Status HTTP |
|---|---|
| Registrasi, login, reset kata sandi, ubah nama | ✅ `/api/auth/...` (gateway yang ada) |
| Baca produk / cari / barcode | ✅ `/api/products` — mengharapkan DTO kanonik (lihat `src/shared/domain/types.ts`) |
| Produk manual, penilaian, preferensi, Nutrition Plan, favorit, sinkronisasi, restoran | ⏳ melempar `CONTRACT_PENDING` sampai kontrak tersedia |

Tidak ada API key mitra di bundle mobile. Token sesi disimpan di SecureStore.

---

## 2. Struktur

```
frontend/
├── index.ts, app.json, package.json, tsconfig.json, babel.config.js, .env.example
└── src/
    ├── app/                      # App root, navigasi (RootNavigator, TabBar, tipe rute)
    ├── shared/
    │   ├── theme/                # token Figma: warna, tipografi Public Sans, spacing, radius
    │   ├── components/           # komponen 00. Components (Button, Status Chip, Text Field, ...)
    │   ├── api/                  # config, klien HTTP terpusat, error aplikasi
    │   ├── domain/               # DTO kanonik, aturan unknown≠0, ringkasan harian
    │   ├── state/                # sesi, konektivitas, cache katalog lokal, preferensi UI
    │   ├── sync/                 # antrean offline idempoten + OfflineDataProvider
    │   └── utils/                # format angka & tanggal Bahasa Indonesia
    ├── services/                 # satu file per bounded context: interface + HTTP + Mock
    │   ├── identity.ts  catalog.ts  assessment.ts  mealPlanning.ts  consumption.ts  sync.ts
    │   └── fixtures.ts           # DATA CONTOH (hanya mode demo)
    ├── features/                 # layar per bounded context
    │   ├── identity/  home/  scanner/  food-catalog/  nutritional-assessment/
    │   ├── meal-planning/  consumption-history/  restaurant/  profile/  sync/
    └── __tests__/                # unit test (format, unknown vs nol, ringkasan, antrean sinkron)
```

Pemisahan mengikuti 4 bounded context requirements: **Food Catalog** (`food-catalog`, `scanner`,
`services/catalog`), **Nutritional Assessment** (`nutritional-assessment`, `services/assessment`),
**Meal Planning** (`meal-planning`, `restaurant`, `services/mealPlanning`), **Consumption History**
(`consumption-history`, `services/consumption`). UI tidak memanggil Open Food Facts atau mitra
secara langsung, dan tidak menghitung penilaian kesesuaian sendiri.

Library: React Navigation 7 (native-stack + bottom-tabs), react-native-svg, expo-camera,
expo-location, expo-secure-store, AsyncStorage, NetInfo, @react-native-community/datetimepicker,
@expo-google-fonts/public-sans. Tanpa state library global — Context per domain.

---

## 3. Pemetaan Figma → kode

| Section Figma | Frame | Implementasi |
|---|---|---|
| 00. Components | Icons (45), Button, Status Chip, Text Field, Nutrient Row, Banner, Tab Bar, Segmented Control | `shared/components/*` (`iconPaths.ts` = path SVG yang diekspor langsung dari Figma), `app/navigation/TabBar.tsx` |
| 01. Onboarding & Akun | A1–A6 | `features/identity/screens.tsx` |
| 02. Beranda | B1 terisi · B2 hari pertama · B3 offline | `features/home/HomeScreen.tsx` |
| 03. Pindai Barcode | C1–C6 | `features/scanner/screens.tsx` |
| 04. Produk Pangan | D1 · D2/D3/D6 · D4/D5 | `ProductSearchScreen`, `SearchResultsScreen`, `ProductDetailScreen` |
| 05. Produk Manual | E1/E2 · E3 · E4 | `ManualProductScreens.tsx`, E4 = `ProductDetailScreen` (sumber `USER_ENTERED`) |
| 06. Penilaian Kesesuaian | F1 sheet · F2/F3/F4 | `PortionSheet.tsx`, `AssessmentResultScreen.tsx` |
| 07. Bandingkan Produk | G1/G3 · G2 | `CompareScreen.tsx`, `CompareLimitSheet.tsx` |
| 08. Preferensi & Nutrition Plan | H1–H4 | `PreferenceScreens.tsx` |
| 09. Makanan Favorit | I1/I2 · I3 · I4/I5 | `PlanHomeScreen.tsx` (sub-tab Favorit), `FavoriteScreens.tsx` |
| 10. Rencana Makan | J1/J2 · J3 · J4/J5 | `PlanHomeScreen.tsx`, `AddToSlotSheet.tsx`, `PlanDetailScreen.tsx` |
| 11. Catatan Konsumsi | K0 · K1/K2/K4/K5 · K3 | `LogScreens.tsx`, K3 = `SummaryHomeScreen` (sub-tab Riwayat) |
| 12. Ringkasan Gizi | L1–L3 | `SummaryHomeScreen.tsx` |
| 13. Restoran Terdekat | M1–M5 | `features/restaurant/screens.tsx` |
| 14. Profil & Pengaturan | N1–N4 | `features/profile/screens.tsx` |
| 15. Sinkronisasi & Offline | O1–O3 | `features/sync/SyncStatusScreen.tsx` |
| 16. Handoff | IA 5 tab, stack per tab, scanner/editor modal | `app/navigation/RootNavigator.tsx` |

System Status Bar & Home Indicator di Figma hanya referensi; di perangkat dirender sistem dan
ditangani lewat safe area (tidak meng-hard-code 62/34).

---

## 4. Aturan domain yang dijaga di UI

- **Unknown ≠ 0**: `null` = "Tidak tersedia" (ikon minus-circle, italic), `0` = "0 g". Input
  kosong pada produk manual disimpan sebagai unknown.
- **Tanpa skor**: hanya Cocok / Kurang Cocok / Belum Dapat Dinilai + bukti per aturan + sumbernya.
- **Status tidak pernah warna saja**: ikon + teks + permukaan/bentuk (rencana putus-putus vs konsumsi terisi).
- **Rencana ≠ catatan**: rencana baru menjadi Catatan Konsumsi lewat konfirmasi J5; snapshot gizi disimpan.
- **Preferensi ≠ Nutrition Plan**: plan selalu hanya baca dan tidak pernah ditimpa; konflik ditampilkan (H4).
- **Offline** hanya untuk Rencana Makan & Catatan Konsumsi: antrean lokal dengan kunci
  idempotensi, backoff terbatas, status *Tersimpan di perangkat / Menunggu / Sedang / Tersinkron / Gagal*,
  dan konflik diselesaikan pengguna (tidak ada last-write-wins diam-diam).
- **Aksesibilitas**: label VoiceOver/TalkBack, target sentuh ≥44pt, teks mengikuti ukuran perangkat
  (≥130%: baris gizi bertumpuk, tabel perbandingan jadi kartu, matriks mingguan jadi daftar),
  kurangi gerakan mematikan animasi garis pindai.

---

## 5. Keputusan & deviasi dari dokumen (perlu dicek tim)

1. **Font Public Sans**, bukan Baskerville/Helvetica Neue seperti di `requirements.md` §8.3 —
   mengikuti Figma Handoff "FONT (v2)" yang menggantinya karena kedua font itu tidak bisa dibundel di Android.
2. **Label tombol Primary berwarna ink (#0E1712)** di atas Brand/Green. Frame Figma memakai teks putih,
   tetapi deskripsi komponen Button dan catatan aksesibilitas Handoff menyatakan putih gagal AA dan tidak dipakai.
   Ubah `colors.onBrand` bila tim memilih sebaliknya.
3. **Penilaian mengevaluasi semua aturan aktif** (termasuk batas natrium dari Preferensi *dan* Nutrition Plan),
   sesuai rekomendasi §5.3.1 — sehingga ringkasan bisa berbunyi "1 dari 4 batasan" (Figma: "1 dari 3").
4. **H2 satu preferensi per layar** (sesuai anotasi), sehingga daftar "Bahan yang dihindari" punya layar sendiri.
5. **J3 menampilkan chip slot** agar slot bisa diganti (anotasi: "slot editable via title tap", PROPOSED).
6. **Navigasi minggu** di J1 dilakukan lewat tampilan Mingguan (J2 punya panah); J1 memilih hari di minggu aktif.
7. **K1 untuk favorit/hidangan** memakai pengali porsi (½, 1, 1½, 2 porsi) karena item hidangan punya satuan berbeda.
8. **Hapus produk manual** ditaruh di layar ubah produk (anotasi E4: "Delete lives in edit screen").
9. **"Lihat bukti penilaian" di J4** hanya muncul untuk rencana satu produk; penilaian untuk hidangan utuh menunggu API `assessMeal`.
10. Layar **Tentang AmbatuNourish** (dirujuk N1) ditambahkan dengan disclaimer, sumber data, privasi, dan panel mode demo.

---

## 6. Dependensi yang masih terbuka (jangan dikarang)

- Kontrak API AmbatuNourish: produk manual pribadi, penilaian produk/hidangan, preferensi,
  favorit, rencana & catatan (sinkronisasi batch + versi + konflik), target harian.
- Ambatufit: Identity & Access final (field profil, aturan kata sandi), skema Nutrition Plan,
  pengiriman Consumption History, event ajakan booking. **CTA booking belum dibuat** karena tidak ada
  frame Figma dan kontraknya belum ada.
- Ambatueat: kontrak lokasi (GPS/manual), bentuk hasil restoran, deep link membuka restoran.
- Formula & ambang penilaian (domain team). Mock di `services/assessment.ts` hanya contoh untuk demo.
- Lisensi/atribusi Open Food Facts untuk rilis.

---

## 7. Pengujian

- `src/__tests__`: format angka Indonesia, unknown vs nol, normalisasi porsi, agregasi ringkasan,
  antrean sinkronisasi (idempotensi, backoff, konflik).
- Belum ada: component test & E2E (Detox/Maestro) serta verifikasi visual di perangkat iOS/Android —
  wajib dilakukan sebelum rilis (requirements §8.10, §8.12).
