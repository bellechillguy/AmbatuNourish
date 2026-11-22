# AmbatuNourish Mobile

Aplikasi React Native + Expo SDK 58 untuk iOS dan Android. Gunakan Expo Go yang kompatibel dengan SDK 58 di ponsel. Ikuti [petunjuk root](../README.md) untuk menjalankan backend, mendaftarkan akun uji, dan mengatur alamat gateway.

Jalankan perintah berikut dari direktori `frontend` dengan Node.js 24 LTS (24.3 atau lebih baru) dan npm. Metro berjalan di port 8082.

```sh
npm install
test -f .env || cp .env.example .env
npm start
```

`EXPO_PUBLIC_USE_MOCK=false` memakai backend AmbatuNourish. Kamera dipakai saat pemindaian barcode. Akses lokasi diminta ketika pengguna memilih GPS pada fitur restoran.

## Akun demo

Setel `EXPO_PUBLIC_USE_MOCK=true` di `frontend/.env`, mulai ulang Metro, lalu pilih **Masuk** di Expo Go. Gunakan email `rani.pratiwi@email.com` dan kata sandi `demo12345`. Akun ini memakai fixture lokal di perangkat. Untuk menguji login dengan backend lokal, setel kembali `EXPO_PUBLIC_USE_MOCK=false` dan buat akun lewat **Daftar** sesuai [panduan backend lokal](../README.md#jalankan-backend-dan-frontend).

## Layanan API

Modul fitur memakai [ApiService.js](src/shared/api/ApiService.js) untuk mengirim request ke gateway AmbatuNourish. Login dan Nutrition Plan Ambatufit serta pencarian restoran Ambatueat melewati backend AmbatuNourish. Implementasi panggilan dari backend ke mitra menunggu kontrak dan ditandai `# to do` di [adapter backend](../backend/nourish/partners.py).

Rencana Makan dan Catatan Konsumsi disimpan di perangkat dengan antrean per akun. Aplikasi mengirim operasi saat koneksi pulih dan memuat data server saat login atau kembali aktif. Produk yang telah dibuka dan favorit yang telah dimuat dapat dipakai dari cache pada perangkat. Lihat [kontrak backend](../backend/API.md) untuk format sync dan respons konflik.

```sh
npm run typecheck
npm test -- --runInBand
```
