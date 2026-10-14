import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../landing.css'

const I = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

const SASARAN = [
  {
    judul: 'Bayi & Balita',
    teks: 'Timbang, ukur panjang/tinggi badan, dan pantau pertumbuhan 0–23 bulan dari bulan ke bulan.',
    ikon: (
      <I>
        <circle cx="24" cy="18" r="8" />
        <path d="M10 42c0-8 6-13 14-13s14 5 14 13" />
        <path d="M20 18h.01M28 18h.01M21 22c1.5 1.4 4.5 1.4 6 0" />
      </I>
    ),
  },
  {
    judul: 'Ibu Hamil & Menyusui',
    teks: 'Buku kesehatan ibu digital: HPHT, perkiraan lahir, kunjungan, dan catatan persalinan.',
    ikon: (
      <I>
        <path d="M24 41S7 31 7 19a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 12-17 22-17 22z" />
        <path d="M13 24h6l3-6 4 10 3-4h6" />
      </I>
    ),
  },
  {
    judul: 'Remaja, Dewasa & Lansia',
    teks: 'Pemeriksaan IMT, lingkar perut, dan riwayat tekanan darah tinggi untuk semua kelompok umur.',
    ikon: (
      <I>
        <circle cx="16" cy="14" r="5" />
        <circle cx="33" cy="17" r="4" />
        <path d="M6 40c0-7 4-11 10-11s10 4 10 11M28 40c0-5 2-8 6-8s7 3 7 8" />
      </I>
    ),
  },
]

const FITUR = [
  { judul: 'Pengelompokan Sasaran Otomatis', teks: 'Kategori umur dihitung dari tanggal lahir terhadap tanggal kegiatan, lalu dipilah per RT.', warna: 'a' },
  { judul: 'Pemeriksaan & Status Gizi', teks: 'Isi BB, TB, LILA, dan lingkar perut. IMT dan penanda risiko langsung terhitung.', warna: 'b' },
  { judul: 'Imunisasi & Tindak Lanjut', teks: 'Daftar bayi 12–23 bulan yang imunisasinya belum lengkap dan warga yang sering absen.', warna: 'c' },
  { judul: 'Laporan Siap Cetak', teks: 'Rekap bulanan mengikuti format laporan manual Posyandu, simpan sebagai PDF dari browser.', warna: 'd' },
  { judul: 'Bisa Dipakai Offline', teks: 'Data tersimpan di HP dan bisa dipasang ke layar utama. Sinkron ke server bersama bersifat opsional.', warna: 'a' },
  { judul: 'Akses Kader & Admin', teks: 'Data pribadi hanya terlihat setelah masuk. Admin mengelola akun kader dan pengaturan.', warna: 'b' },
]

const ALUR = [
  ['Pendaftaran', 'Nomor antrean dan data identitas'],
  ['Pengukuran', 'BB, TB, LILA, lingkar perut'],
  ['Pencatatan', 'Data tersimpan dan dikelompokkan'],
  ['Penyuluhan', 'Konsultasi bidan / Puskesmas'],
]

export default function Landing() {
  return (
    <div className="lp">
      <div className="lp-frame">
        <section className="lp-hero" id="beranda">
          <nav className="lp-nav" aria-label="Navigasi">
            <a className="lp-brand" href="#beranda">
              <span className="lp-mark">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span>POSYANDU<br />BANGAU</span>
            </a>
            <div className="lp-links">
              <a href="#sasaran">Sasaran</a>
              <a href="#fitur">Fitur</a>
              <a href="#alur">Alur</a>
              <a href="#kontak">Kontak</a>
            </div>
            <Link className="lp-btn" to="/masuk">Masuk Kader</Link>
          </nav>

          <div className="lp-hero-body">
            <div className="lp-copy">
              <h1>Posyandu Lebih Mudah,<br />Kesehatan Warga Terpantau</h1>
              <p>Portal digital untuk kader Posyandu Bangau: catat sekali, rekap otomatis, laporan bulanan siap diserahkan ke Puskesmas.</p>
            </div>
            <div className="lp-art" aria-hidden>
              <div className="lp-phone">
                <div className="lp-phone-head">Ringkasan kegiatan (contoh)</div>
                <div className="lp-stat"><b>128</b><span>Peserta hadir</span></div>
                <div className="lp-stat"><b>86%</b><span>Kehadiran</span></div>
                <div className="lp-bar"><i style={{ width: '86%' }} /></div>
                <div className="lp-pills"><span>RT 18</span><span>RT 20</span><span>RT 22</span><span>RT 24</span></div>
              </div>
              <div className="lp-float">IMT Normal ✓</div>
            </div>
          </div>

          <div className="lp-info">
            <div><small>Jadwal</small><b>Setiap tanggal 15</b></div>
            <div><small>Wilayah</small><b>RT 18, 20, 22, 24</b></div>
            <div><small>Lokasi</small><b>Dusun 5, Way Huwi</b></div>
            <Link className="lp-btn" to="/masuk">Mulai Catat</Link>
          </div>
        </section>

        <section className="lp-sec" id="sasaran">
          <h2>Sasaran Layanan</h2>
          <div className="lp-grid3">
            {SASARAN.map((s) => (
              <article className="lp-card lp-center" key={s.judul}>
                <div className="lp-ico">{s.ikon}</div>
                <h3>{s.judul}</h3>
                <p>{s.teks}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-sec lp-tint" id="fitur">
          <h2>Fitur Unggulan</h2>
          <div className="lp-grid3">
            {FITUR.map((f) => (
              <article className="lp-card" key={f.judul}>
                <div className={`lp-thumb t${f.warna}`} aria-hidden />
                <h3>{f.judul}</h3>
                <p>{f.teks}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-sec" id="alur">
          <h2>Alur Pelayanan</h2>
          <ol className="lp-steps">
            {ALUR.map(([j, t], i) => (
              <li className="lp-card" key={j}>
                <span className="lp-num">{i + 1}</span>
                <h3>{j}</h3>
                <p>{t}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-cta" id="kontak">
          <h2>Siap membantu kader bekerja lebih ringan</h2>
          <p>Posyandu Bangau, Dusun V, Desa Way Huwi, Jati Agung, Lampung Selatan.</p>
          <Link className="lp-btn lp-btn-light" to="/masuk">Masuk Portal Kader</Link>
        </section>

        <footer className="lp-foot">
          Kapita Selekta Informatika, Kelompok 5, ITERA · Mitra: Posyandu Bangau. Sistem ini alat bantu pencatatan, bukan alat diagnosis medis.
        </footer>
      </div>
    </div>
  )
}
