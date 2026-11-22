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
EXPO_PUBLIC_API_URL=http://IP-LAN-KOMPUTER:8081/api/v1
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

### Publikasikan API dari STB

HTTPS publik memakai `stb.stei.fun`. Gateway API mendengarkan HTTP pada port `80` di jaringan Docker. aaPanel dikelola melalui port `1122` pada jaringan admin. Port host `8081` dipakai untuk pemeriksaan gateway dari STB dan terikat ke `127.0.0.1` secara default.

Di sesi SSH STB, cek ruang disk dan port sebelum menjalankan Compose. Jika `8081` sudah dipakai, setel `NOURISH_GATEWAY_PORT` ke port host lain yang kosong di `.env`. Publikasi Tunnel tetap memakai port `80` milik kontainer.

```sh
df -h /
ss -ltnp '( sport = :80 or sport = :8081 or sport = :1122 )'
mkdir -p /www/apps
cd /www/apps
git clone --branch backend --single-branch https://github.com/bellechillguy/AmbatuNourish.git ambatunourish
cd ambatunourish
test -f .env || (umask 077; cp .env.example .env)
```

Jika repo sudah di-clone di lokasi tersebut, masuk ke foldernya dan jalankan `git pull --ff-only origin backend` untuk mengambil commit yang sudah dipush. Di Cloudflare Zero Trust, buat Tunnel dan tambahkan **Published application** untuk `stb.stei.fun` dengan tipe `HTTP` dan origin `gateway:80`. Isi `TUNNEL_TOKEN` serta `OFF_USER_AGENT` dengan token Tunnel dan kontak tim di `.env` pada STB. Gunakan Compose dasar agar mode autentikasi development tetap mati. Simpan `.env` hanya di server. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)

```sh
docker compose --profile tunnel up -d --build --wait
docker compose --profile tunnel ps
curl -fsS http://127.0.0.1:8081/health
curl -fsS https://stb.stei.fun/health
```

Jika Tunnel yang sudah ada berjalan **di host STB** dan diarahkan lewat aaPanel, buat Proxy Project untuk `stb.stei.fun` dengan target `http://127.0.0.1:8081` dan pertahankan path. Route Tunnel kemudian menuju HTTP port `80` milik website tersebut. Gunakan salah satu jalur publik per hostname. [aaPanel Proxy Project](https://www.aapanel.com/docs/Function/proxy.html)

| Hasil deployment | URL |
| --- | --- |
| Base URL | `https://stb.stei.fun/api/v1` |
| Swagger UI | `https://stb.stei.fun/docs` |
| Spesifikasi OpenAPI | `https://stb.stei.fun/openapi.json` |
| Health check | `https://stb.stei.fun/health` |
| Repo dan dokumentasi | [AmbatuNourish, branch backend](https://github.com/bellechillguy/AmbatuNourish/tree/backend) |

Setelah URL publik merespons, gunakan `EXPO_PUBLIC_API_URL=https://stb.stei.fun/api/v1` di `frontend/.env` dan mulai ulang Metro. `/api` lama tetap bisa dipakai klien yang sudah terpasang. Login dan fitur akun publik menunggu kontrak Identity & Access Ambatufit. Pengujian akun lokal memakai override development dan volume sendiri.

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
- API mitra milik AmbatuNourish di `/api/v1/partner` dapat diaktifkan dengan `NOURISH_PARTNER_API_KEY` di server. Endpoint hanya membaca katalog Open Food Facts dan aturan yang dikirim pemanggil untuk permintaannya sendiri.

## Verifikasi

```sh
PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v
cd frontend
npm run typecheck
npm test -- --runInBand
```
