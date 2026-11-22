# AmbatuNourish

Aplikasi Expo untuk katalog pangan, preferensi dan penilaian gizi, perencanaan makan, serta riwayat konsumsi. Backend ada di `backend/nourish`, dengan API JSON melalui Nginx dan SQLite untuk peralatan pengembangan serta deployment STB/VM. Kontrak mobile dan server-to-server ada di [backend/API.md](backend/API.md).

## Jalankan backend dan frontend

Siapkan Docker dengan Docker Compose, Node.js 24 LTS (24.3 atau lebih baru), dan npm. Untuk tes di HP, gunakan Expo Go yang kompatibel dengan **Expo SDK 58**. Jalankan kedua tab Terminal dari folder utama `AmbatuNourish`.

### Persiapan pertama kali

```sh
test -f .env || cp .env.example .env
test -f frontend/.env || cp frontend/.env.example frontend/.env
npm --prefix frontend install
```

Untuk Expo Go di HP, sambungkan HP dan komputer ke jaringan Wi-Fi yang sama. Isi `frontend/.env` dengan IP Wi-Fi komputer. Ganti `IP-LAN-KOMPUTER` dengan IP tersebut, misalnya `192.168.1.2`.

```dotenv
EXPO_PUBLIC_API_URL=http://IP-LAN-KOMPUTER:8081/api
EXPO_PUBLIC_USE_MOCK=false
```

Untuk simulator iOS atau emulator Android, biarkan `EXPO_PUBLIC_API_URL` kosong agar aplikasi memilih alamat lokal platform.

### Tab 1 — Backend di port 8081

```sh
NOURISH_BIND_ADDRESS=0.0.0.0 docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait
curl -fsS http://127.0.0.1:8081/api/health
```

Compose menjalankan backend dengan autentikasi development dan menyiapkan lingkungan Python. Tambahkan `--build` setelah `up -d` saat perlu membangun ulang image setelah mengubah kode backend.

### Tab 2 — Frontend di port 8082

```sh
npm --prefix frontend start
```

Pindai QR Metro dengan Expo Go di Android atau aplikasi Kamera di iPhone. Kalau Metro sudah aktif pada port 8082, gunakan QR dari sesi tersebut. Setelah mengubah `frontend/.env`, mulai ulang Metro. Untuk build yang membatasi HTTP, gunakan URL gateway HTTPS.

Gunakan `npm start` jika Terminal sudah berada di dalam folder `frontend`. Opsi `--prefix frontend` dipakai saat Terminal berada di folder utama `AmbatuNourish`.

Pilih **Daftar** untuk membuat akun uji di backend lokal, lalu gunakan akun itu untuk **Masuk**. Mode development menyimpan akun pada volume terpisah dan memberi sesi 24 jam. Untuk mencoba aplikasi dengan data contoh di perangkat, setel `EXPO_PUBLIC_USE_MOCK=true`.

Gunakan [backend/api.http](backend/api.http) untuk mencoba katalog dengan barcode `3017620422003`, entri pribadi, dan penilaian.

Backend juga bisa dijalankan langsung memakai Python 3.12 dengan OpenSSL dan data zona waktu sistem.

```sh
cd backend
NOURISH_DEV_AUTH=1 python3 -m nourish
```

## Struktur deployment

Nginx menyediakan satu gateway. Empat konteks AmbatuNourish dipisahkan melalui modul dan tabel milik masing-masing konteks. Docker menjalankan keempatnya dalam satu proses backend melalui Gunicorn agar deployment STB sederhana dan pencatatan operasi sinkronisasi tetap atomik. Food Catalog memisahkan tabel produk Open Food Facts dari produk pribadi. SQLite dipilih karena stack sebelumnya memakai PocketBase dengan SQLite dan kebutuhan transaksi/indeks tetap dapat ditangani pada satu host. Skema AmbatuNourish dimulai pada volume baru karena model katalog dan kepemilikan datanya berbeda.

Untuk STB/VM gunakan Compose dasar. Setel `OFF_USER_AGENT` dengan alamat kontak tim. Profile `tunnel` memakai `TUNNEL_TOKEN` dari Cloudflare dan route HTTPS ke `http://gateway:80`. Aplikasi mengarah ke URL HTTPS dengan akhiran `/api`. Port host terbatas ke loopback secara default. Jaringan Compose menampung trafik internal gateway ke core. Untuk autentikasi produksi, hubungkan Identity & Access Ambatufit sebelum membuka alur akun. Adapter Ambatufit dan Ambatueat menunggu kontrak agar dapat dideploy sebagai integrasi di luar STB. Pengujian lokal memakai override development dan volume sendiri. [Dokumentasi Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/reference/run-parameters/#token)

```sh
docker compose up -d --build --wait
docker compose --profile tunnel up -d
docker compose logs core gateway
```

Migration SQL pada `backend/nourish/migrations` berjalan berurutan dan atomik saat startup. Sebelum upgrade, buat cadangan dengan SQLite online backup. Uji pemulihan pada volume staging. Untuk rollback skema, hentikan backend, pulihkan cadangan lengkap sebelum upgrade ke volume terpisah, lalu gunakan image versi yang sesuai.

```sh
docker compose exec core python -c 'import sqlite3; a=sqlite3.connect("/data/nourish.sqlite3"); b=sqlite3.connect("/tmp/nourish-backup.sqlite3"); a.backup(b); b.close(); a.close()'
docker compose cp core:/tmp/nourish-backup.sqlite3 ./nourish-backup.sqlite3
```

Katalog menyimpan atribusi dan provenance Open Food Facts. Isi `OFF_CACHE_TTL_SECONDS` jika tim sudah menentukan batas umur cache. Jika kosong, pembacaan cache ditandai mungkin kedaluwarsa, dan katalog dapat disegarkan dengan tombol Perbarui. Tinjau ketentuan ODbL sebelum mendistribusikan dataset resmi. [Ketentuan data Open Food Facts](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)

## Baseline dan integrasi mitra

- Penilaian memakai batas yang dimasukkan pengguna dan bahan yang dipilih pengguna. Rumus klinis, skor, dan ambang bawaan menunggu kesepakatan domain.
- Default sementara mengikuti UI yang sudah ada berupa produk manual privat, empat slot makan, maksimal tiga produk pembanding, enam metrik harian, dan penyelesaian konflik berdasarkan pilihan pengguna.
- Komentar `# to do` menandai Identity & Access dan reset, Nutrition Plan, pengiriman Consumption History, trigger booking, pencarian restoran, dan pertukaran informasi gizi menu. Saat kontrak tersedia, lengkapi adapter, skema/versi mitra, dan pengujian kontraknya. Tentukan kebijakan retensi, penghapusan, akses, dan pengelolaan data bersama sebelum rilis produksi.
- API mitra milik AmbatuNourish di `/api/partner/v1` dapat diaktifkan dengan `NOURISH_PARTNER_API_KEY` di server. Endpoint hanya membaca katalog Open Food Facts dan aturan yang dikirim pemanggil untuk permintaannya sendiri.

## Verifikasi

```sh
PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v
cd frontend
npm run typecheck
npm test -- --runInBand
```
