# AmbatuNourish Mobile

Aplikasi React Native + Expo SDK 58 untuk iOS dan Android. Gunakan Expo Go yang kompatibel dengan SDK 58 di ponsel. Ikuti [petunjuk root](../README.md) untuk menjalankan backend, mendaftarkan akun uji, dan mengatur alamat gateway.

Jalankan perintah berikut dari direktori `frontend` dengan Node.js 24 LTS (24.3 atau lebih baru) dan npm. Metro berjalan di port 8082.

```sh
npm install
cp .env.example .env
npm start
```

`EXPO_PUBLIC_USE_MOCK=false` memakai backend AmbatuNourish. Dengan `true`, aplikasi memakai fixture perangkat untuk demo. Kamera dipakai saat pemindaian barcode. Akses lokasi diminta ketika pengguna memilih GPS pada fitur restoran. Integrasi Ambatueat dan Ambatufit menunggu kontrak layanan tersebut.

Rencana Makan dan Catatan Konsumsi disimpan di perangkat dengan antrean per akun. Aplikasi mengirim operasi saat koneksi pulih dan memuat data server saat login atau kembali aktif. Produk yang telah dibuka dan favorit yang telah dimuat dapat dipakai dari cache pada perangkat. Lihat [kontrak backend](../backend/API.md) untuk format sync dan respons konflik.

```sh
npm run typecheck
npm test -- --runInBand
```
