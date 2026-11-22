# Kontrak API AmbatuNourish v1

Mobile memakai `http://localhost:8081/api` lewat Nginx pada lingkungan lokal. Pada STB/VM, pakai `https://<hostname-gateway>/api`. Jalur server-to-server memiliki versi eksplisit `/api/partner/v1`.

Kirim `Content-Type: application/json` untuk body JSON. Endpoint personal memakai `Authorization: Bearer <token>`. Identitas pemilik selalu berasal dari sesi. Endpoint lintas kelompok memakai `X-API-Key` yang dikirim server mitra melalui HTTPS. API key hanya mengizinkan dua rute publik dan bersifat opsional sampai distribusi kunci disepakati.

## Sesi dan profil

| Request | Body | Respons |
| --- | --- | --- |
| `GET /health` | | `200 {status, service, apiVersion}` |
| `POST /auth/register` | `{name, email, password}` | `201 Session` |
| `POST /auth/login` | `{email, password}` | `200 Session` |
| `GET /auth/me` | | `200 UserProfile` |
| `PATCH /auth/me` | `{name}` | `200 UserProfile` |
| `POST /auth/logout` | | `204` |
| `POST /auth/reset-password` | `{email}` | `503 CONTRACT_PENDING` |

`Session = {token: string, user: UserProfile}`. `UserProfile = {id: string, name: string, email: string}`. Register dan login tersedia dalam mode development. Password development membutuhkan minimal delapan karakter. Email dinormalisasi menjadi lowercase dan unik untuk akun uji. Rute yang membutuhkan identitas bersama mengembalikan `503 CONTRACT_PENDING` pada Compose dasar sampai kontrak Ambatufit tersedia.

## Food Catalog

| Request | Input | Respons |
| --- | --- | --- |
| `GET /products/barcode/{barcode}` | Barcode numerik 4–24 digit | `200 Product`, `404` jika tidak ditemukan |
| `GET /products` | Query opsional `q`, `source=ALL\|OPEN_FOOD_FACTS\|USER_ENTERED`, `discover=0\|1`, `page` | `200 Product[]`, 30 per halaman |
| `GET /products/{id}` | | `200 Product` |
| `POST /products/{id}/refresh` | | `200 Product` |
| `GET /manual-products` | Query `page` opsional | `200 Product[]`, 30 per halaman |
| `POST /manual-products` | `ManualProductInput` | `201 Product` |
| `PUT /manual-products/{id}` | `ManualProductInput` | `200 Product` |
| `DELETE /manual-products/{id}` | | `204` |

`ManualProductInput` berisi string `name` dan `basis: MASS | VOLUME`. Field opsional adalah string `brand`, `barcode`, `ingredientsText`, array string `allergens`, `serving: {quantity, unit, sourceText?}`, dan objek parsial `nutrientsPer100`. `quantity` harus positif dan `unit` mengikuti basis (`g` atau `ml`). `Product` menambahkan `id`, `basisKnown`, `source`, `verification`, `completeness`, `displayNutrients`, `missingFields` dan timestamp `createdAt`, `updatedAt` atau `fetchedAt` sesuai sumber. Produk Open Food Facts menyertakan `isStale` dan `provenance: {externalId, sourceUrl, sourceVersion?, sourceUpdatedAt?, sourceBasis?}`. Jika `basisKnown=false`, UI dan klien lain menyembunyikan satuan, dan semua nilai gizi tetap kosong.

`NutrientFacts` memiliki nilai `number | null` untuk `energy` (kkal), `sodium` (mg), serta `protein`, `carbohydrate`, `fat`, `sugar`, `transFat`, dan `fiber` (g). `null` berarti tidak diketahui. `0` berarti nol eksplisit. `Completeness` memakai `COMPLETE | INCOMPLETE | INSUFFICIENT`. `source` memakai `OPEN_FOOD_FACTS | USER_ENTERED` dan `verification` memakai `VERIFIED | UNVERIFIED`. Data masukan pribadi dan data pihak ketiga diberi label `UNVERIFIED` sementara verifikasi produk belum tersedia.

Katalog menyamakan UPC-A 12 digit dengan EAN-13 berawalan nol. Barcode katalog publik unik, ID internal tetap terpisah. Produk manual dapat memakai barcode sama seperti produk publik, tetapi unik per pemilik dan tidak dipublikasikan. Lookup oleh pemilik mendahulukan katalog publik yang sudah ada, lalu entri pribadi, lalu Open Food Facts. API mitra hanya memakai jalur katalog publik. Cari nama atau merek dari katalog internal dan gunakan `discover=1` untuk pencarian eksplisit ke Open Food Facts saat belum ada kecocokan publik pada halaman pertama. Halaman dimulai dari 1. Panjang halaman yang lebih kecil dari limit menunjukkan akhir. Hasil penemuan mendapat validasi ulang pada pembacaan detail/barcode.

## Preferensi dan assessment

| Request | Body | Respons |
| --- | --- | --- |
| `GET /preferences` | | `200 Preference[]` |
| `PUT /preferences/{id}` | `{value: number\|null}` atau `{ingredients: string[]}` | `200 Preference` |
| `DELETE /preferences/{id}` | | `204` |
| `POST /assessment/product` | `{productId, portion: {quantity, unit}}` | `200 Assessment` |
| `POST /assessment/meal` | `{items: MealItem[]}` | `200 {outcome, summary, completeness, evidence, missingFields, values}` |
| `POST /assessment/compare` | `{productIds: string[], portion?: {quantity, unit}}` | `200 ComparisonColumn[]` |
| `GET /nutrition-plan` | | `200 NutritionPlan\|null` |
| `GET /nutrition-plan/conflicts` | | `200 RuleConflict[]` |
| `GET /nutrition-plan/booking-offer` | | `200 null` selama menunggu kontrak trigger |

ID preferensi adalah `sugar` (`SUGAR_MAX_PER_PORTION`, g), `sodium` (`SODIUM_MAX_PER_PORTION`, mg), dan `ingredients` (`AVOID_INGREDIENTS`). `Preference` menyertakan `id`, `type`, `label`, `value`, dan `unit` atau `ingredients`. Penghapusan mengembalikan preferensi ke kondisi belum diatur. Daftar bahan memakai pencocokan frasa literal pada komposisi yang tersedia. Ambang berasal dari input pengguna.

`Assessment` memuat `id`, `assessedAt`, `productSource`, `provenance?`, `portion`, `values: NutrientFacts`, `completeness`, `missingFields`, `summary`, `outcome`, dan `evidence`. Outcome adalah `COCOK | KURANG_COCOK | BELUM_DAPAT_DINILAI`. `evidence[]` berisi `rule`, `source: PREFERENCE | NUTRITION_PLAN`, `observed: string|null`, `nutrientLabel`, `result: MET | VIOLATED | UNKNOWN`, dan `resultLabel`. Jika satu aturan dilanggar, hasilnya kurang cocok. Tanpa pelanggaran, semua aturan aktif harus terpenuhi agar cocok.

`ComparisonColumn` memuat `productId, name, brand?, basis, basisKnown, source, completeness, verification, values, outcome?`. Default memakai per 100 g atau per 100 ml. Basis berbeda ditampilkan dalam unit masing-masing dan ditandai oleh frontend. Saat `portion` disertakan, seluruh produk harus memiliki basis yang sesuai satuan tersebut. Maksimal tiga ID berbeda.

`NutritionPlan` dan `RuleConflict` adalah model read-only milik mobile di `frontend/src/shared/domain/types.ts`. Saat ini respons `null` dan `[]` menyatakan data mitra belum tersedia. Model internal belum menentukan payload atau jalur pemanggilan mitra.

## Favorit, jadwal, riwayat, dan restoran

| Request | Input | Respons |
| --- | --- | --- |
| `GET /favorites` | Query `page` opsional | `200 FavoriteMeal[]`, 50 per halaman |
| `POST /favorites` | `{name, items, slotHint?, note?}` | `201 FavoriteMeal` |
| `GET /favorites/{id}` | | `200 FavoriteMeal` |
| `PUT /favorites/{id}` | Sama seperti POST | `200 FavoriteMeal` |
| `DELETE /favorites/{id}` | | `204` |
| `GET /meal-plans` | Query `from/to` opsional, tanggal ISO inklusif | `200 MealPlanEntry[]` |
| `GET /consumption/daily-summary` | Query wajib `date=YYYY-MM-DD&timezone=Asia%2FJakarta` | `200 DailySummary` |
| `GET /consumption/daily-targets` | | `200 {}` atau target gizi yang tersedia |
| `POST /restaurants/search` | `{planId, location: {kind, latitude?, longitude?, text?}}` | `503 CONTRACT_PENDING` |
| `GET /restaurants/locations` | Query `q` | `503 CONTRACT_PENDING` untuk pencarian berisi teks |

`MealItem = {productId, productName, quantity, unit, source}`. Favorit menerima 1–30 item dan menambahkan `id`, `totals: NutrientFacts`, `completeness` dan `outcome`. Slot adalah `SARAPAN | MAKAN_SIANG | MAKAN_MALAM | CAMILAN`. Penghapusan favorit mempertahankan jadwal dan catatan lama.

`DailySummary = {date, recordCount, incompleteCount, totals, missingCount, targets}`. Agregasi dihitung dari catatan konsumsi aktif antara tengah malam lokal tanggal tersebut dan tengah malam berikutnya dalam zona waktu IANA yang dikirim klien. `totals` menjumlahkan nilai yang diketahui untuk enam nutrien inti. `missingCount` menyatakan jumlah catatan yang kehilangan nilai per nutrien. `targets` adalah map nutrien ke `{value, source}` bila target tersedia.

## Sinkronisasi

`GET /sync` mengembalikan snapshot akun `{plans: MealPlanEntry[], records: ConsumptionRecord[]}` berisi entitas aktif. `POST /sync` menerima `{operations: Operation[]}` dengan 1–50 operasi, diproses berurutan. Gunakan operasi ini untuk membuat, mengubah, melakukan undo, atau menghapus rencana dan riwayat.

- `Operation = {opId, entityType: MEAL_PLAN | CONSUMPTION, entityId, op: CREATE | UPDATE | DELETE, baseVersion, payload}`. `payload` memuat entitas penuh untuk CREATE/UPDATE dan `null` untuk DELETE. ID op dan entitas berupa 1–96 karakter alfanumerik, garis bawah, atau tanda hubung.
- `MealPlanEntry = {id, date, slot, title, favoriteId?, items, version, syncStatus, status, consumedAt?, outcome?}`. Backend mengisi status `PLANNED | CONSUMED`, `consumedAt` dan hasil penilaian pada pembacaan. Satu rencana ditandai sudah dikonsumsi dengan membuat catatan bersumber `PLAN` dan menautkan `planEntryId`. Jadwal itu sendiri tidak dihitung ke ringkasan.
- `ConsumptionRecord = {id, consumedAt, title, productId?, favoriteId?, planEntryId?, source, quantity, unit, itemsCount, snapshot, version, syncStatus}`. `source` adalah `SCAN | SEARCH | MANUAL | FAVORITE | PLAN`. Catatan aktual menerima ISO 8601 dengan offset dan disimpan dalam UTC. Input bertanggal masa depan ditolak. UI mengirim snapshot gizi yang dibangun saat pencatatan, termasuk saat offline. Backend memvalidasi tipe, rentang, kepemilikan referensi, dan menyimpan snapshot pada entitas konsumsi. Penyegaran katalog tidak menghitung ulang snapshot. `quantity` mewakili gram/ml untuk satu produk, atau pengali porsi untuk hidangan favorit dan rencana multi-item.
- Respons adalah array dengan satu hasil per `opId`. Bentuknya `{status: ACCEPTED, version}`, `{status: CONFLICT, server, deleted}`, `{status: REJECTED, reason}`, atau `{status: RETRYABLE, reason}`.
- Entitas baru mulai dari `baseVersion=0`. Setiap operasi diterima menaikkan versi. Operasi lama dengan versi berbeda menghasilkan konflik. Server menyimpan tombstone agar penghapusan tetap terlihat saat konflik. Untuk memilih versi lokal, kirim operasi baru berdasarkan versi server. Pengiriman ulang `opId` dengan payload identik mengembalikan hasil sebelumnya. ID yang sama dengan payload berbeda ditolak. Klien boleh mencoba ulang kegagalan jaringan memakai ID yang sama dan backoff.
- Maksimum satu catatan konsumsi aktif untuk tiap rencana. Menghapus catatan mengembalikan proyeksi rencana menjadi `PLANNED`; menghapus rencana mempertahankan riwayat.

## Rute server-to-server

- `GET /partner/v1/products/barcode/{barcode}` menghasilkan `Product` dari katalog bersama.
- `POST /partner/v1/assessment/product` menerima `{barcode, portion, preferences?: [{id, value?, ingredients?}]}` dan menghasilkan `Assessment`. Pemanggil memberikan aturan penilaiannya sendiri.
- Pengiriman data ke Ambatufit dan Ambatueat akan mengikuti kontrak kelompok masing-masing. Titik integrasi ditandai `# to do`.

## Error, batas, dan pengulangan

Body error JSON standar berbentuk `{status, code, message, data?: {[field]: {message}}}`. Status yang digunakan mencakup `401` untuk autentikasi yang gagal, `404` untuk sumber daya tidak ditemukan dalam cakupan pemilik, `405` untuk metode salah, `413` di atas 1 MiB, `415` untuk format body yang salah, dan `422` untuk validasi. Semua respons core membawa `X-Request-ID`. Nginx memberi `429` setelah batas lokal auth atau mitra terlampaui.

Open Food Facts membedakan `404` produk tidak ditemukan, `502 OFF_INVALID_RESPONSE/OFF_UNAVAILABLE`, `503 OFF_RATE_LIMITED`, dan `504 OFF_TIMEOUT`. Bila tersedia, backend mengembalikan katalog cache dengan `isStale: true` saat penyegaran gagal. Timeout provider diatur dengan `OFF_TIMEOUT_SECONDS`, default 4 detik. ACL membatasi 15 lookup dan 10 search per menit untuk satu proses. Klien HTTP Expo memakai timeout 10 detik. Retry idempotent tersedia untuk mutasi sync. [Dokumentasi API Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
