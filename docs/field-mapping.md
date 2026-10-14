# Pemetaan Field Template ke Data

| Kolom template | Sumber (tabel.kolom) | Catatan |
|---|---|---|
| NAMA, NIK, TANGGAL LAHIR, L/P | warga.nama/nik/tanggalLahir/jk | |
| Kategori sasaran | dihitung dari tanggalLahir + tanggal acuan | batas di tabel kategori |
| Bumil/Busui | statusKhusus (jenis, mulai, selesai) | diset manual kader |
| KUNJUNGAN bulan, T | kunjungan.hadir + pemeriksaan.sistol/diastol | T jika >= ambang |
| BB, TB, LILA, lingkar perut, tensi, gula | pemeriksaan.* | |
| Plotting IMT | dihitung bb/tb | N/R |
| Kolesterol, asam urat | pemeriksaan.kolesterol/asamUrat | |
| No. Periksa | kunjungan.noAntrean | |
| Penyuluhan, Rujukan | kunjungan.penyuluhan/rujukan | |
| Pemberian obat/vitamin | layananObat | |
| Skrining TBC (batuk, demam, dst.) | **belum ada sumber** | dicetak kosong untuk diisi tangan |
| Riwayat keluarga/diri, perilaku berisiko, status perkawinan, pekerjaan | **belum ada sumber** | kartu identitas halaman 1 belum dibuat |
| Skor PUMA | **belum ada sumber** | |
| No. HP | **belum ada sumber** | |
