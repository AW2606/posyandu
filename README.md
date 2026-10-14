# Posyandu Bangau — Portal Kader (tahap front end)

Aplikasi web mobile-first untuk kader. **Tanpa server dan tanpa biaya hosting**: data tersimpan di browser (IndexedDB), laporan dicetak lewat jendela cetak browser (Simpan sebagai PDF).

## Menjalankan
```
npm install
npm run dev        # pengembangan
npm run build      # hasil di dist/, bisa dihosting statis gratis (GitHub Pages, Netlify)
npm test           # uji umur, kategori, IMT, lingkar perut
```
Login awal: `admin` / `admin123` (segera ganti di menu Lainnya). Menu Lainnya > Data: muat data contoh fiktif.

## Fitur tambahan
- Imunisasi dasar bayi dan buku ibu hamil (HPHT, perkiraan lahir, persalinan) di halaman warga.
- Halaman Tindak lanjut: bayi 12-23 bulan belum lengkap, ibu hamil, absen 2 kegiatan, penanda risiko.
- PWA: setelah dibuka sekali (versi build, bukan `npm run dev`), bisa dipasang ke layar utama dan dibuka tanpa internet.

## Server bersama (opsional)
Agar beberapa kader memakai data yang sama dari HP masing-masing: hubungkan ke Supabase gratis. Skema dan aturan akses di `docs/supabase.sql`, langkah di `docs/supabase.md`. Aplikasi tetap local-first: bisa dipakai offline, perubahan dikirim dan ditarik otomatis. Login dan hak akses (admin/kader) ditegakkan di server. Sinkron diuji dengan tes otomatis dan server tiruan, **belum dengan proyek Supabase sungguhan**.

## Batasan penting
- Tanpa server bersama, data hanya ada di perangkat yang dipakai. **Unduh cadangan JSON secara berkala.**
- Tanpa server bersama, login hanya pembatas tampilan, bukan keamanan sungguhan. Dengan Supabase, izin ditegakkan di server.
- Angka ambang dan batas umur adalah bawaan, perlu dikonfirmasi bidan (menu Lainnya).

## Struktur
- `src/lib` logika (umur, kesehatan, database, impor CSV)
- `src/reports` definisi laporan terpisah dari renderer
- `src/pages` halaman, `docs/` inventaris template dan pemetaan field
