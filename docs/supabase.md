# Menghubungkan ke Supabase (server bersama, gratis)

Dilakukan sekali oleh Admin. Tanpa ini, aplikasi tetap jalan penuh secara lokal di satu perangkat.

## 1. Buat proyek
1. Daftar di supabase.com, pilih **New project**. Wilayah: Singapore. Simpan kata sandi database.
2. Tunggu proyek selesai dibuat. Jangan menambahkan kartu pembayaran.

## 2. Pasang skema
1. Buka **SQL Editor > New query**, tempel seluruh isi `docs/supabase.sql`, tekan **Run**.
2. Pesan "Success" berarti tabel, aturan akses (RLS), dan pemicu terpasang. Skrip aman dijalankan ulang.
3. Jika ada galat, kirim pesannya ke pengembang. Skrip ini belum diuji pada proyek Supabase sungguhan.

## 3. Atur login
1. **Authentication > Sign In / Providers > Email**: matikan **Confirm email**. Biarkan **Allow new users to sign up** menyala (dipakai aplikasi untuk membuat akun kader).
2. **Authentication > Users > Add user > Create new user**: buat akun Admin pertama dengan email `namaanda@posyandu.local`, kata sandi, dan centang **Auto Confirm User**. Akun **pertama** otomatis menjadi Admin.
3. Akun kader dibuat dari aplikasi oleh Admin (Lainnya > Akun kader > Buat akun kader). Kader masuk cukup dengan nama penggunanya.

Keamanan pendaftaran terbuka: siapa pun yang tahu alamat proyek bisa mencoba mendaftar, tetapi akun baru **nonaktif** dari server dan tidak bisa membaca atau menulis data apa pun sampai Admin mengaktifkannya. Aplikasi mengaktifkannya otomatis hanya untuk akun yang dibuat Admin.

## 4. Hubungkan aplikasi
1. **Project Settings > API**: salin **Project URL** dan kunci **anon public**. Jangan memakai `service_role`.
2. Halaman login tidak punya form server. Admin menghubungkan perangkatnya lewat salah satu jalur ini:
   - **Disarankan, sekali build:** salin `.env.example` menjadi `.env`, isi dua nilai tadi, lalu `npm run build` dan taruh hasilnya di hosting statis (Netlify, GitHub Pages, dan sejenisnya). Semua HP yang membuka alamat itu otomatis terhubung ke server yang sama; kader cukup membuka alamatnya dan masuk. Tautan di langkah 4 tidak diperlukan.
   - **Tanpa build ulang:** buka aplikasi, masuk dengan akun lokal `admin` / `admin123`, buka Lainnya > Server bersama, tempel kedua nilai, **Simpan dan hubungkan**. Setelah itu masuk dengan akun Admin Supabase.
3. Masuk sebagai Admin. Buat akun kader di Lainnya > Akun kader > **Buat akun kader**.
4. Jika Anda tidak memakai jalur `.env`: Lainnya > Server bersama > **Salin tautan untuk HP kader**, kirim lewat WhatsApp. Kader membuka tautan, menyetujui, lalu masuk dengan akunnya tanpa mengetik alamat server.
5. Di **satu** perangkat yang sudah berisi data lama: Lainnya > Server bersama > **Unggah semua data perangkat ini** (sekali saja). Perangkat lain mulai kosong dan menarik data otomatis.

Catatan: HP yang membuka aplikasi tanpa tautan dan tanpa `.env` tidak terhubung ke server dan akan menampilkan login lokal. Itu sebabnya jalur `.env` lebih aman dari salah langkah.

Lupa kata sandi kader: kader bisa menggantinya sendiri di Lainnya selama masih masuk. Jika sudah lupa, Admin tidak bisa mereset dari aplikasi (itu butuh kunci rahasia server). Cara termudah: buat akun baru dengan nama pengguna lain dan nonaktifkan yang lama, atau reset lewat Supabase Authentication > Users.

## Batas paket gratis
Angka di bawah dari pengetahuan umum dan **bisa berubah**; periksa supabase.com/pricing sebelum bergantung padanya.

| Hal | Batas gratis (umumnya) | Perkiraan pemakaian Posyandu |
|---|---|---|
| Ukuran database | 500 MB | Ratusan warga + satu tahun kegiatan sekitar beberapa MB. Butuh puluhan tahun untuk mendekati batas. |
| Trafik keluar | 5 GB per bulan | Sinkron hanya menarik perubahan baru. Beberapa HP aktif sepanjang hari sekitar ratusan MB per bulan. |
| Jumlah pengguna | puluhan ribu | Belasan kader. |
| Pembayaran | Tidak ada kartu, tidak ada tagihan otomatis | Proyek gratis dibatasi, bukan ditagih, bila melewati batas. |

**Risiko terbesar bukan ukuran, melainkan proyek dijeda otomatis bila tidak ada aktivitas sekitar satu minggu.** Posyandu berjalan sebulan sekali, jadi ini pasti terjadi. Proyek yang terjeda bisa dipulihkan dari dashboard dalam jangka tertentu, tetapi aplikasi tidak bisa sinkron selama terjeda. Cara mencegahnya:

1. Pasang pemanggil mingguan gratis lewat GitHub Actions: salin `docs/keepalive.yml` ke `.github/workflows/keepalive.yml` di repositori GitHub Anda. Isi dua Secret repositori: `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Ia memanggil fungsi `ping()` yang sudah dibuat skrip SQL. Belum pasti pemanggilan ini selalu dihitung sebagai aktivitas oleh Supabase; cek dashboard setelah dua minggu.
2. Alternatif manual: Admin membuka aplikasi dan menekan "Sinkron sekarang" paling tidak seminggu sekali.

## Perlindungan data
- Paket gratis **tidak** punya cadangan otomatis dari Supabase.
- Setiap HP menyimpan salinan lengkap data. Admin cukup menekan **Unduh cadangan (JSON)** di Lainnya sebulan sekali dan menyimpannya di Google Drive atau komputer.
- Penyimpanan data di aplikasi tidak terkunci ke Supabase. Jika kelak berpindah penyedia, hanya bagian `Remote` di `src/lib/cloud.ts` yang diganti.

## Cara kerjanya dan batasannya
- Setiap HP menyimpan salinan lengkap dan tetap bisa dipakai tanpa internet. Perubahan dikirim saat ada koneksi, dan perubahan orang lain diambil tiap 30 detik selama aplikasi terbuka dan terlihat, serta saat kembali online.
- Konflik: bila dua orang mengubah baris yang sama, yang **terakhir tiba di server menang**. Ini sengaja sederhana untuk jumlah kader yang sedikit.
- Dua kader yang mendaftarkan orang yang sama pada kegiatan yang sama sambil offline akan menghasilkan satu kunjungan yang dipakai; yang bentrok dilewati dan dihitung di status sinkron.
- Aturan di sisi server (tidak bisa dilewati lewat aplikasi): hanya akun aktif yang bisa membaca atau menulis; hanya Admin yang boleh mengubah pengaturan dan kategori serta menghapus warga dan kegiatan.
- Saat terhubung, fitur pulihkan cadangan, data contoh, dan hapus massal dimatikan agar tidak menimpa data bersama.
- Data yang tertinggal di HP kader setelah akunnya dinonaktifkan tetap ada di HP itu. Hapus data browser jika HP berpindah tangan.
