# Inventaris Template Laporan (tahap front end)

Sumber: berkas PDF yang dilampirkan. Definisi kode ada di `src/reports/definisi.ts`.
Status: **8 laporan sudah punya definisi**, tetapi PRD menyebut 8 template dan belum jelas apakah daftar ini sama persis (lihat pertanyaan terbuka).

| # | Kode | Sumber | Judul/kolom persis | Orientasi |
|---|------|--------|--------------------|-----------|
| 1 | sasaran-balita | format `lansia.pdf` (dipakai ulang) | NO, NAMA, NIK, TANGGAL LAHIR, LAKI-LAKI, PEREMPUAN. Kop: POSYANDU BANGAU / SASARAN USIA BALITA / RT.. DUSUN 5 WAY HUWI / JATI AGUNG LAM – SEL | Potret |
| 2 | sasaran-ibu | `mbg.pdf` (Bumil/Busui: Nama, Nik, Tgl. Lahir) | NO, NAMA, NIK, TANGGAL LAHIR; dua bagian Bumil dan Busui | Potret |
| 3 | sasaran-sekolah-remaja | format `lansia.pdf` | sama dengan #1 | Potret |
| 4 | sasaran-lansia | `lansia.pdf` | sama dengan #1, judul "SASARAN USIA LANSIA ( >60 tahun )" | Potret |
| 5 | presensi-dewasa-lansia | `data pemeriksaan.pdf` hal. 1 kanan/kiri (B/C) dan tabel kunjungan | NO, NAMA, TGL LAHIR/UMUR, NIK, KUNJUNGAN JAN..DES; penanda T | Lanskap |
| 6 | kartu-pemeriksaan | `data pemeriksaan.pdf` hal. 2 (Kartu Bantu Dewasa Lansia 18-59) | Pemeriksaan x Januari..Desember, grup Skrining Penimbangan, Skrining TBC, Penyuluhan, Rujukan | Lanskap |
| 7 | hasil-pemeriksaan | `kartu.pdf` | Nama, Umur, Jenis Kelamin, Alamat, No. Periksa, Tanggal Pemeriksaan; tabel Pemeriksaan/Hasil/Satuan/Keterangan (Gula Darah, Kolesterol, Asam Urat, mg/dl) | Lanskap |
| 8 | pemberian-obat | `pemberian obat agust dan feb.pdf` | NAMA, L/P, KETERANGAN (Diterima langsung/Dititipkan; Vitamin A Merah/Biru) | Potret |

Catatan: #1 dan #3 belum punya template aslinya; formatnya meminjam lembar sasaran lansia.
Bagian "B. Pemeriksaan 6 bulan sekali" dan "C. Skrining PPOK PUMA" (halaman 1 `data pemeriksaan.pdf`) belum dibuat.
