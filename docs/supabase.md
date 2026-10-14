# Menghubungkan ke Supabase (server bersama, gratis)

Dilakukan sekali oleh Admin. Tanpa ini, aplikasi tetap jalan penuh secara lokal di satu perangkat.

## 1. Buat proyek
1. Daftar di supabase.com, pilih **New project**. Wilayah: Singapore. Simpan kata sandi database.
2. Tunggu proyek selesai dibuat.

## 2. Pasang skema
1. Buka **SQL Editor > New query**, tempel seluruh isi `docs/supabase.sql`, tekan **Run**.
2. Pesan "Success" berarti tabel, aturan akses (RLS), dan pemicu terpasang. Jika ada galat, kirim pesannya ke pengembang.

## 3. Atur login
1. **Authentication > Sign In / Providers > Email**: matikan **Confirm email** dan matikan **Allow new users to sign up**.
2. **Authentication > Users > Add user > Create new user**: isi email `namapengguna@posyandu.local` dan kata sandi, centang **Auto Confirm User**.
   - Akun **pertama** otomatis menjadi **Admin**. Akun berikutnya menjadi Kader.
   - Di aplikasi, kader masuk cukup dengan `namapengguna` (tanpa `@posyandu.local`).
3. Peran dan status aktif diatur Admin di aplikasi: menu Lainnya > Akun kader.

## 4. Hubungkan aplikasi
1. **Project Settings > API**: salin **Project URL** dan kunci **anon public**. Jangan memakai `service_role`.
2. Di aplikasi: Login > **Hubungkan ke server bersama** (atau Lainnya > Server bersama), tempel keduanya, **Simpan dan hubungkan**.
3. Masuk dengan akun Admin yang dibuat di langkah 3.
4. Di **satu** perangkat yang sudah berisi data lama: Lainnya > Server bersama > **Unggah semua data perangkat ini** (sekali saja).
5. Perangkat kader lain: lakukan langkah 2 dan 3, mulai dari data kosong. Data akan ditarik otomatis.

Alternatif tanpa mengetik di tiap HP: isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` saat `npm run build`.

## Cara kerjanya dan batasannya
- Setiap HP menyimpan salinan lengkap dan tetap bisa dipakai tanpa internet. Perubahan dikirim dan diambil otomatis tiap 20 detik, saat kembali online, dan saat aplikasi dibuka lagi.
- Konflik: bila dua orang mengubah baris yang sama, yang **terakhir tiba di server menang**. Ini sengaja sederhana untuk jumlah kader yang sedikit.
- Dua kader yang mendaftarkan orang yang sama pada kegiatan yang sama sambil offline akan menghasilkan satu kunjungan yang dipakai; yang bentrok dilewati dan dihitung di status sinkron.
- Aturan di sisi server (tidak bisa dilewati lewat aplikasi): hanya akun aktif yang bisa membaca atau menulis; hanya Admin yang boleh mengubah pengaturan dan kategori serta menghapus warga dan kegiatan.
- Saat terhubung, fitur pulihkan cadangan, data contoh, dan hapus massal dimatikan agar tidak menimpa data bersama.
- Paket gratis Supabase menjeda proyek yang tidak dipakai sekitar seminggu. Buka dashboard untuk mengaktifkan kembali. Tetap unduh cadangan JSON secara berkala.
- Data yang tertinggal di HP kader setelah akunnya dinonaktifkan tetap ada di HP itu. Hapus data browser jika HP berpindah tangan.
