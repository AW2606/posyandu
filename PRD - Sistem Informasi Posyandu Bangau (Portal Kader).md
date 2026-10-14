# PRD: Sistem Informasi Posyandu Bangau (Portal Kader)

Product Requirements Document untuk AI coding agent. Proyek: Kapita Selekta Informatika, Kelompok 5, ITERA. Mitra: Posyandu Bangau, Dusun V, Desa Way Huwi, Jati Agung, Lampung Selatan.

## 0. Instruksi Awal untuk Agent (WAJIB DIBACA PERTAMA)

1. Bersama PRD ini dilampirkan **8 template laporan manual Posyandu** dan dokumen pendukung lain. Template tersebut adalah **sumber kebenaran (source of truth)** untuk keluaran laporan. Bila PRD ini bertentangan dengan template, **template yang menang**.
2. Sebelum menulis kode, buat berkas `docs/template-inventory.md` berisi, untuk setiap template: nama laporan, tujuan, periode, judul kolom persis (urutan dan penulisan), baris/kelompok, rumus atau total, kop dan tanda tangan, orientasi dan ukuran kertas, serta field data yang dibutuhkan.
3. Dari inventaris itu, buat pemetaan field (template ke kolom database) di `docs/field-mapping.md`. Jika ada kolom template yang tidak punya sumber data di sistem, **tandai dan tanyakan ke saya**, jangan menebak.
4. Jika sebuah aturan di PRD ditandai **\[KONFIRMASI\]**, implementasikan sebagai konfigurasi yang bisa diubah, bukan angka yang ditanam di kode.
5. Tidak ada Portal Warga. Jangan membuat halaman publik atau akun warga.

## 1. Ringkasan Produk

Aplikasi web responsif (mobile-first) untuk kader Posyandu Bangau. Kader memasukkan data warga, kehadiran, dan hasil pemeriksaan sekali saja. Sistem mengelompokkan sasaran secara otomatis, merekap, dan menghasilkan **laporan bulanan dengan format yang sama persis dengan laporan manual yang selama ini dipakai**, siap diserahkan ke Puskesmas.

### 1.1 Masalah yang diselesaikan

| # | Masalah (hasil wawancara) | Solusi |
| --- | --- | --- |
| 1 | Data dicatat di kertas lalu direkap ulang ke komputer/PDF (double work) | Input digital sekali, rekap otomatis |
| 2 | Pemilahan sasaran per umur dan RT dari buku besar memakan waktu seharian | Kategori otomatis dari tanggal lahir, target pemilahan < 1 menit |
| 3 | Hasil pemeriksaan (BB, TB, LILA, lingkar perut) tidak terintegrasi, riwayat sulit ditelusuri | Riwayat per peserta, tersimpan terpusat |
| 4 | Rekap dan laporan bulanan berulang, cetak form dibiayai kader sendiri | Generator laporan PDF yang meniru template manual |

### 1.2 Tujuan

- G1: Laporan yang dihasilkan **identik secara format** dengan 8 template manual (kolom, urutan, judul, kop, tanda tangan).
- G2: Pemilahan sasaran per kategori dan RT selesai < 1 menit.
- G3: Seluruh input pemeriksaan bisa dilakukan lewat smartphone di lokasi Posyandu.
- G4: Riwayat kesehatan peserta dapat dilihat lintas bulan.
- G5: Mendukung bukti SDGs Desa: 2.2.1 (pertumbuhan balita 0-23 bulan), 3.28.1 (imunisasi dasar lengkap bayi 12-23 bulan), 3.2.1 (buku kesehatan ibu hamil digital dan data persalinan), 9.7.1 (1 inovasi berbasis web).

### 1.2.1 Bukan tujuan (Non-Goals)

- Portal Warga atau akses publik (**dihapus dari lingkup**).
- Diagnosis medis atau saran pengobatan otomatis.
- Integrasi langsung ke sistem Puskesmas/ePPGBM/SIGIZI (hanya ekspor berkas).
- Aplikasi native. Cukup web responsif (PWA bila memungkinkan).
- Klaim bahwa sistem menurunkan stunting atau menaikkan cakupan imunisasi. Sistem hanya menyediakan data pendukung pemantauan.

## 2. Pengguna dan Hak Akses

| Peran | Deskripsi | Hak |
| --- | --- | --- |
| Admin | Koordinator Posyandu / pengelola sistem | Semua fitur, kelola akun kader, kelola master data dan konfigurasi, hapus/arsip data, unduh semua laporan, lihat audit log |
| Kader | Petugas meja pelayanan | Input dan ubah data warga, kehadiran, hasil pemeriksaan; lihat riwayat; filter; unduh laporan. Tidak bisa kelola akun atau konfigurasi |

Catatan: Pengguna hanya Admin dan Kader (login wajib). Data pribadi (NIK, KK) hanya terlihat oleh pengguna yang login. Opsional (jika diminta template): kader dibatasi per meja pelayanan.

## 3. Konteks Operasional Lapangan

- Posyandu dilaksanakan **setiap tanggal 15** tiap bulan.
- Wilayah: Dusun 5, **RT 18, RT 20, RT 22, RT 24**.
- Alur layanan 4 tahap (sistem harus mendukung pencatatan tiap tahap): (1) Pendaftaran: nomor antrean dan data identitas; (2) Pengukuran: BB, TB, LILA, lingkar perut; (3) Pencatatan dan pengelompokan data; (4) Pelayanan dan penyuluhan (konsultasi bidan/Puskesmas).
- Perangkat: **smartphone kader**. UI wajib nyaman di layar 360 px. Koneksi internet bisa tidak stabil.

## 4. Kebutuhan Fungsional

Prioritas: **P0** wajib (MVP), **P1** penting, **P2** opsional.

### F1. Autentikasi dan Manajemen Pengguna (P0)

- Login username/password, sesi aman, logout, ganti kata sandi.
- Admin membuat, menonaktifkan, dan mereset akun kader.
- Kata sandi di-hash (bcrypt/argon2). Proteksi CSRF dan rate limit login.
- **Akseptansi:** kader tidak dapat membuka halaman admin (respons 403); akun nonaktif tidak bisa login.

### F2. Data Warga (P0)

Field: nama lengkap, NIK (16 digit, validasi), nomor KK (16 digit), tanggal lahir, jenis kelamin, RT (18/20/22/24, master data), dusun, alamat singkat (opsional), nama orang tua/wali (untuk balita, opsional), status aktif. Fungsi: tambah, ubah, lihat detail, arsip (soft delete), impor massal dari CSV/Excel (untuk memasukkan data kertas yang sudah ada), deteksi duplikat NIK.

- **Akseptansi:** NIK duplikat ditolak dengan pesan jelas; impor CSV menampilkan laporan baris sukses dan gagal; data tidak perlu diinput ulang tiap bulan.

### F3. Pengelompokan Sasaran Otomatis (P0)

Kategori dihitung dari tanggal lahir terhadap **tanggal kegiatan** (bukan tanggal hari ini), tidak disimpan permanen sebagai nilai statis.

Aturan default (rentang setengah terbuka agar tidak tumpang tindih) **\[KONFIRMASI dengan template\]**:

| Kategori | Aturan umur |
| --- | --- |
| Bayi/Balita/Baduta | 0 sampai < 5 tahun (ikuti rentang yang dipakai template; wawancara menyebut 0-5 tahun) |
| Anak Prasekolah | muncul pada wawancara, tetapi batasnya belum jelas **\[KONFIRMASI\]** |
| Usia Sekolah | 6 sampai 14 tahun |
| Remaja | 15 sampai 17 tahun |
| Dewasa | 18 sampai 59 tahun |
| Lansia | 60 tahun ke atas |

- Penanda khusus (flag, bisa bertumpuk dengan kategori dewasa): **Ibu Hamil**, **Ibu Menyusui**. Diset manual oleh kader pada kunjungan (dengan tanggal mulai/selesai).
- Batas umur disimpan di tabel konfigurasi, bisa diubah Admin tanpa mengubah kode.
- **Akseptansi:** warga hanya masuk satu kategori umur pada satu waktu; mengubah tanggal lahir langsung mengubah kategori; halaman "Sasaran" menampilkan daftar per kategori dan per RT dalam < 1 detik untuk 2.000 warga.

### F4. Kegiatan Posyandu dan Presensi (P0)

- Admin/Kader membuat "Kegiatan" (tanggal, lokasi, keterangan). Default jadwal tanggal 15 tiap bulan.
- Pendaftaran peserta pada kegiatan: pilih warga (cari nama/NIK), nomor antrean otomatis, status hadir.
- Pencatatan status tiap tahap layanan: terdaftar, terukur, tercatat, dilayani/penyuluhan.
- Kehadiran dapat dilihat per kegiatan, periode, RT, dan kategori; daftar **tidak hadir** (sasaran yang belum datang) tersedia.
- **Akseptansi:** satu warga tidak bisa didaftarkan dua kali pada kegiatan yang sama; rekap hadir vs tidak hadir per kategori sesuai template.

### F5. Pemeriksaan dan Riwayat Kesehatan (P0)

Input per kunjungan (terikat ke kegiatan): berat badan (kg), tinggi/panjang badan (cm), LILA (cm), lingkar perut (cm), tekanan darah (opsional, jika template meminta), catatan. Otomatis dihitung dan ditandai:

- **IMT** = BB / (TB dalam m)^2, dan **status gizi** (Sangat Kurus / Normal / Gemuk; bila template memakai kategori lain, ikuti template) **\[KONFIRMASI ambang batas\]**.
- **Lingkar perut berisiko**: laki-laki > 90 cm, perempuan > 80 cm.
- **Penanda "T"** untuk riwayat darah tinggi (hipertensi), diset kader/riwayat per warga.
- Balita: status pertumbuhan (BB/U, TB/U, BB/TB) mengikuti standar antropometri yang berlaku, tersimpan sebagai tabel acuan yang bisa diperbarui **\[KONFIRMASI apakah template memerlukan ini; jika ya, minta tabel acuan\]**.
- Validasi rentang wajar (mis. TB 30-220 cm, BB 1-250 kg) dengan peringatan, bukan blokir keras.
- Riwayat per warga: tabel kronologis dan grafik pertumbuhan (balita 0-23 bulan).
- **Akseptansi:** input BB dan TB langsung menampilkan IMT dan status; ambang lingkar perut tepat pada nilai batas (90 dan 80 tidak ditandai, di atasnya ditandai); riwayat menampilkan semua kunjungan terurut.

### F6. Imunisasi Bayi (P1, untuk SDGs 3.28.1)

- Catat jenis imunisasi, tanggal pemberian, dan status kelengkapan imunisasi dasar per bayi.
- Daftar bayi usia 12-23 bulan yang belum lengkap (untuk tindak lanjut kader).
- Daftar jenis imunisasi dasar disimpan sebagai master data **\[KONFIRMASI dengan template/buku KIA\]**.

### F7. Buku Kesehatan Ibu Hamil Digital (P1, untuk SDGs 3.2.1)

- Data kehamilan: HPHT/usia kehamilan, jadwal kunjungan, hasil pemeriksaan, pelayanan yang diterima.
- Pencatatan persalinan: tanggal, tempat, dan penanda apakah di fasilitas kesehatan.
- Riwayat kunjungan ibu hamil bisa ditelusuri tiap bulan.

### F7a. Pencarian dan Filter (P0)

- Pencarian nama atau NIK (parsial, tidak peka huruf besar-kecil).
- Filter: RT, kategori sasaran, periode/kegiatan, status kehadiran, penanda (T, lingkar perut berisiko, ibu hamil, ibu menyusui, status gizi).
- Filter bisa dikombinasikan dan hasilnya bisa diekspor.

### F8. Rekapitulasi Otomatis (P0)

- Jumlah peserta per kategori, per RT, tingkat kehadiran (hadir vs tidak), hasil pelayanan.
- Struktur rekap **mengikuti persis kebutuhan tiap template** (lihat F9). Semua angka dihitung dari data sumber lewat query/view, bukan diketik.
- **Akseptansi:** jumlah di rekap sama dengan jumlah baris saat di-drill-down; angka total tidak pernah selisih.

### F9. Generator Laporan Sesuai 8 Template (P0, FITUR INTI)

Ini fitur terpenting. Keluaran harus sama dengan laporan manual.

Ketentuan:

1. Satu template = satu "definisi laporan" (kode laporan, judul, kop, daftar kolom, sumber query, pengelompokan, baris total, tanda tangan, orientasi/ukuran kertas, font).
2. Arsitektur berbasis **definisi laporan terpisah dari mesin render**, agar menambah/mengubah template tidak menyentuh logika inti.
3. Format keluaran: **PDF (wajib)**, dan Excel/CSV bila template juga berbentuk tabel yang biasa diolah (P1). Jika template manual berbentuk dokumen Word, sediakan juga DOCX **\[KONFIRMASI\]**.
4. Parameter laporan: bulan/periode atau kegiatan, RT (semua atau satu), kategori sasaran (jika relevan).
5. Pratinjau di layar sebelum unduh.
6. Kop surat, nama Posyandu/desa/kecamatan, tanggal cetak, serta nama penandatangan (Ketua Posyandu/Kader/Bidan) **dapat diatur Admin** di Pengaturan.
7. Penanganan data kosong: tampilkan "0" atau "-" sesuai template, bukan sel kosong.
8. Penomoran, urutan baris (mis. urut RT lalu abjad), dan format tanggal/angka (desimal koma) **mengikuti template**.

- **Akseptansi per template:** (a) kolom, judul, dan urutan identik; (b) angka sama dengan hitungan manual pada data uji dari template contoh; (c) hasil cetak A4 tidak terpotong; (d) lolos review visual berdampingan dengan template asli oleh kader.

Proses kerja agent untuk fitur ini: untuk setiap template, buat satu definisi laporan, satu data uji (fixture) yang meniru isi template contoh, dan satu uji pembanding (snapshot/visual diff) terhadap hasil yang diharapkan.

### F10. Dashboard (P1)

Ringkasan untuk kegiatan terpilih: jumlah peserta, tingkat kehadiran, distribusi kategori sasaran, distribusi per RT, progres tahap pelayanan, jumlah penanda risiko (T, lingkar perut, status gizi), serta status kelengkapan data kegiatan.

### F11. Mode Offline dan Sinkronisasi (P2, opsional)

PWA dengan penyimpanan lokal (IndexedDB) untuk input kehadiran dan pemeriksaan, antrean sinkronisasi saat online, penanganan konflik (last-write-wins dengan penanda konflik pada audit log). Hanya dikerjakan setelah seluruh P0 dan P1 selesai.

### F12. Pengaturan dan Audit (P1)

- Master data: RT, kategori dan batas umur, ambang IMT/lingkar perut, daftar imunisasi, kop dan penandatangan laporan.
- Audit log: siapa mengubah apa dan kapan pada data warga dan pemeriksaan.
- Cadangan (backup) basis data dan ekspor seluruh data.

## 5. Kebutuhan Non-Fungsional

- **Responsif mobile-first**, tombol dan input besar, formulir cepat diisi satu tangan. Diuji di lebar 360 px dan 1366 px.
- **Performa:** halaman daftar < 2 dtk untuk 2.000 warga; pembuatan satu laporan PDF < 10 dtk.
- **Keamanan:** HTTPS, hash kata sandi, validasi input sisi server, perlindungan SQL injection/XSS/CSRF, hak akses di sisi server, NIK tidak muncul di URL dan log, minimal data yang ditampilkan di layar daftar.
- **Privasi:** data hanya untuk keperluan Posyandu; tidak ada halaman publik.
- **Bahasa:** seluruh antarmuka Bahasa Indonesia; istilah mengikuti istilah lapangan (Bumil, Busui, LILA, IMT, dsb.).
- **Ketahanan:** konfirmasi sebelum menghapus; soft delete; ekspor cadangan.
- **Kemudahan pakai:** kader non-teknis bisa menyelesaikan pendaftaran dan input pemeriksaan satu warga dalam < 1 menit setelah pelatihan singkat.

## 6. Usulan Arsitektur (boleh disesuaikan agent, jelaskan alasannya)

- **Frontend:** framework web modern dengan UI responsif (mis. React/Next.js atau Laravel Blade + Tailwind), komponen formulir mobile-friendly.
- **Backend:** REST atau server-rendered (Laravel, Django, atau Node/Express) dengan ORM.
- **Database:** PostgreSQL atau MySQL, relasional.
- **PDF:** pustaka render HTML-ke-PDF atau generator PDF yang memberi kendali penuh atas tata letak tabel (agar sama dengan template).
- **Deploy:** satu server sederhana (VPS/PaaS) dengan HTTPS, backup harian.
- Pilih satu stack yang konsisten dan dokumentasikan di `README.md`. Utamakan sederhana dan mudah dirawat mahasiswa.

## 7. Model Data (draf, sesuaikan setelah pemetaan template)

- `users` (id, nama, username, password\_hash, role, aktif)
- `rt` (id, kode, nama, dusun)
- `warga` (id, nik, no\_kk, nama, tanggal\_lahir, jenis\_kelamin, rt\_id, dusun, nama\_ortu, hipertensi\_flag, aktif, timestamps)
- `kategori_config` (kode, nama, umur\_min, umur\_max, urutan)
- `kegiatan` (id, tanggal, lokasi, keterangan, status)
- `kunjungan` (id, kegiatan\_id, warga\_id, no\_antrean, hadir, tahap\_status, timestamps) dengan unik (kegiatan\_id, warga\_id)
- `pemeriksaan` (id, kunjungan\_id, bb, tb, lila, lingkar\_perut, imt, status\_gizi, tekanan\_darah, catatan)
- `status_khusus` (id, warga\_id, jenis \[hamil/menyusui\], tanggal\_mulai, tanggal\_selesai)
- `imunisasi_master` dan `imunisasi_catatan` (warga\_id, jenis\_id, tanggal)
- `kehamilan` dan `persalinan` (data buku ibu hamil)
- `laporan_definisi` (kode, nama, konfigurasi kolom/query, versi)
- `pengaturan` (kop, nama penandatangan, dll.)
- `audit_log` (user\_id, aksi, entitas, sebelum, sesudah, waktu)

Indeks: nik, rt\_id, tanggal\_lahir, kegiatan\_id. Tambahkan kolom lain sesuai hasil `field-mapping.md`.

## 8. Alur Pengguna Utama

1. **Hari Posyandu:** kader login lewat HP, buka kegiatan hari ini, cari/daftarkan warga, isi nomor antrean, input BB/TB/LILA/lingkar perut, sistem menampilkan IMT dan penanda, tandai layanan/penyuluhan selesai.
2. **Setelah kegiatan:** admin/kader membuka Rekap, memeriksa angka, memilih laporan, pratinjau, unduh PDF, serahkan ke Puskesmas.
3. **Pendataan awal:** impor data warga dari CSV, rapikan duplikat, periksa kategori dan RT.
4. **Tindak lanjut:** kader membuka daftar tidak hadir, balita berisiko, atau bayi belum imunisasi lengkap.

## 9. Rencana Pengujian

- **Unit test:** perhitungan umur dan kategori (termasuk batas 5/6, 14/15, 17/18, 59/60 tahun), IMT dan status gizi, ambang lingkar perut (tepat 80 dan 90).
- **Uji laporan:** per template, bandingkan hasil dengan data contoh manual (angka dan tata letak).
- **Black-box:** seluruh fitur P0/P1 termasuk skenario gagal (input salah, NIK ganda, akses tanpa hak).
- **UAT:** bersama kader Posyandu Bangau memakai data nyata/uji; kriteria lulus: laporan bisa diserahkan ke Puskesmas tanpa disunting ulang.
- **Uji perangkat:** Android Chrome, iOS Safari, desktop.

## 10. Kriteria Keberhasilan (untuk bukti laporan SDGs)

- Delapan laporan dapat dihasilkan dan diverifikasi kader identik dengan template manual.
- Waktu pemilahan sasaran tercatat dari log: dari sekitar 1 hari menjadi < 1 menit.
- Kader mampu input satu peserta < 1 menit.
- Bukti: URL aplikasi, tangkapan layar tiap fitur, data uji, hasil Black-box dan UAT, dokumentasi pelatihan kader.

## 11. Fase Pengerjaan yang Disarankan

| Fase | Isi | Hasil |
| --- | --- | --- |
| 0 | Baca template, buat template-inventory dan field-mapping, tanyakan hal yang **\[KONFIRMASI\]** | Dokumen pemetaan |
| 1 | Skema database, autentikasi, master data, data warga + impor | Pendataan berjalan |
| 2 | Kategori otomatis, kegiatan, presensi, filter dan pencarian | Hari Posyandu bisa dijalankan |
| 3 | Pemeriksaan, IMT, penanda, riwayat dan grafik | Rekam kesehatan |
| 4 | Rekap dan generator 8 laporan + uji kesamaan format | **MVP siap UAT** |
| 5 | Dashboard, imunisasi, buku ibu hamil, audit, pengaturan | Fitur pendukung SDGs |
| 6 | Mode offline (opsional), polesan UI, dokumentasi dan buku panduan | Rilis |

Setiap fase diakhiri demo singkat dan daftar centang akseptansi.

## 12. Pertanyaan Terbuka (agent wajib menanyakan, bukan menebak)

1. Daftar 8 laporan, kolom dan rumus persisnya (dari template terlampir).
2. Apakah "Anak Prasekolah" kategori terpisah, dan berapa batas umurnya?
3. Ambang IMT dewasa dan kategori status gizi yang dipakai template (Sangat Kurus/Kurus/Normal/Gemuk/Obesitas).
4. Apakah laporan balita memerlukan status BB/U, TB/U, BB/TB (z-score)? Jika ya, minta tabel acuan.
5. Format TPK/ELSIMIL: apakah termasuk salah satu dari 8 template?
6. Format keluaran tambahan selain PDF (Excel, Word)?
7. Siapa penandatangan tiap laporan dan apa isi kop?
8. Apakah data historis dari buku besar perlu diimpor, dan dalam bentuk apa?
9. Apakah tekanan darah, imunisasi, dan data ibu hamil dicatat pada laporan manual yang ada?
10. Tempat hosting dan siapa yang merawat sistem setelah projek selesai.

## 13. Definisi Selesai (Definition of Done)

- Semua fitur P0 dan P1 lulus kriteria akseptansi.
- Delapan laporan lolos uji kesamaan format dan angka.
- Tidak ada Portal Warga atau halaman publik.
- README berisi cara instalasi, konfigurasi, dan menjalankan; buku panduan kader tersedia.
- Seed data contoh dan skrip cadangan tersedia.
