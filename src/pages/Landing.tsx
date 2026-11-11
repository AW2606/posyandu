import { Link } from 'react-router-dom'
import fotoLansia from '../assets/foto/ibu-bayi-1.jpg'
import fotoIbu from '../assets/foto/ibu-bayi-2.jpg'
import fotoBalita from '../assets/foto/kader-lokal.jpg'
import fotoSuasana from '../assets/foto/timbang-balita.jpg'
import fotoHero from '../assets/foto/timbang-bayi.jpg'
import { Bangau, Daun, Ikon, Merek } from '../components/ui'
import { parseISO, tglPanjang, todayISO } from '../lib/age'
import { tanggalRutin, usePengaturan } from '../lib/hooks'
import '../landing.css'

const SASARAN = [
  { judul: 'Bayi & Balita', label: 'Bayi & Balita', ikon: 'bayi', warna: 'kuning', foto: fotoBalita, teks: 'Timbang, ukur panjang/tinggi badan, dan pantau pertumbuhan dari bulan ke bulan.' },
  { judul: 'Ibu Hamil & Menyusui', label: 'Ibu Hamil & Menyusui', ikon: 'hati', warna: 'koral', foto: fotoIbu, teks: 'Buku kesehatan ibu digital: HPHT, perkiraan lahir, kunjungan, dan catatan persalinan.' },
  { judul: 'Remaja, Dewasa & Lansia', label: 'Remaja, Dewasa & Lansia', ikon: 'warga', warna: 'biru', foto: fotoLansia, teks: 'Pemeriksaan IMT, lingkar perut, dan tekanan darah untuk semua kelompok umur.' },
]

const FITUR = [
  { judul: 'Sasaran terkelompok otomatis', teks: 'Kategori umur dihitung dari tanggal lahir, lalu dipilah per RT.', ikon: 'warga', warna: '#F2B33D' },
  { judul: 'Pemeriksaan & status gizi', teks: 'Isi BB, TB, LILA, lingkar perut. IMT dan penanda risiko langsung terhitung.', ikon: 'timbangan', warna: '#2E8B6A' },
  { judul: 'Imunisasi & tindak lanjut', teks: 'Daftar bayi yang imunisasinya belum lengkap dan warga yang sering absen.', ikon: 'suntik', warna: '#E46F4C' },
  { judul: 'Laporan siap cetak', teks: 'Rekap bulanan sesuai format manual Posyandu, simpan sebagai PDF.', ikon: 'cetak', warna: '#3B82A8' },
  { judul: 'Tetap jalan tanpa sinyal', teks: 'Data tersimpan di HP dan bisa dipasang ke layar utama.', ikon: 'awan', warna: '#8C6BC2' },
  { judul: 'Aman untuk data warga', teks: 'Data pribadi hanya terlihat setelah masuk. Admin mengatur akun kader.', ikon: 'kunci', warna: '#F2B33D' },
]

const ALUR: Array<[string, string, string]> = [
  ['Pendaftaran', 'Nomor antrean dan data identitas', '#F2B33D'],
  ['Pengukuran', 'BB, TB, LILA, lingkar perut', '#2E8B6A'],
  ['Pencatatan', 'Data tersimpan dan dikelompokkan', '#E46F4C'],
  ['Penyuluhan', 'Konsultasi bidan / Puskesmas', '#3B82A8'],
]

function tanggalBerikut(hari: number): string {
  const t = todayISO()
  const { y, m } = parseISO(t)
  const ini = tanggalRutin(y, m, hari)
  if (ini >= t) return ini
  return m === 12 ? tanggalRutin(y + 1, 1, hari) : tanggalRutin(y, m + 1, hari)
}

export default function Landing() {
  const p = usePengaturan()
  const dusun = p.dusun.replace(/^dusun\s*/i, 'Dusun ').replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())
  const desa = p.desa.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())
  const berikut = tglPanjang(tanggalBerikut(p.tanggalKegiatan)).replace(/^\w+,\s*/, '')

  return (
    <div className="lp">
      <section className="lp-hero" id="beranda">
        <img className="lp-hero-foto" src={fotoHero} alt="" />
        <nav className="lp-nav" aria-label="Navigasi">
          <a href="#beranda" aria-label="Posyandu Bangau"><Merek /></a>
          <div className="lp-links">
            <a className="aktif" href="#beranda">Beranda</a>
            <a href="#sasaran">Sasaran</a>
            <a href="#fitur">Fitur</a>
            <a href="#alur">Alur</a>
            <a href="#kontak">Kontak</a>
          </div>
          <Link className="btn ajakan kecil" to="/masuk">Masuk Kader <Ikon nama="kanan" ukuran={18} /></Link>
        </nav>

        <div className="lp-hero-isi">
          <div className="lp-copy">
            <span className="lp-chip"><i /> Portal kader · {dusun}, {desa}</span>
            <h1>Posyandu lebih mudah, <span className="miring">warga</span> terpantau.</h1>
            <p>Catat timbang, ukur, dan imunisasi sekali saja. Rekap otomatis, laporan bulanan siap diserahkan ke Puskesmas.</p>
            <div className="lp-aksi">
              <Link className="btn ajakan besar" to="/masuk">Mulai catat sekarang <Ikon nama="kanan" ukuran={20} /></Link>
              <a className="btn besar lp-ghost" href="#alur"><Ikon nama="saring" ukuran={20} /> Lihat alur layanan</a>
            </div>
          </div>
          <div className="lp-hias" aria-hidden>
            <div className="lp-kartu-apung atas">
              <span className="petak"><Ikon nama="kalender" ukuran={18} /></span>
              <div><small>Posyandu berikutnya</small><b>{berikut}</b></div>
            </div>
            <div className="lp-kartu-apung tengah">
              <span className="petak hijau"><Ikon nama="timbangan" ukuran={18} /></span>
              <div><small>Hasil timbang (contoh)</small><b>11,2 kg</b><em><Ikon nama="serong" ukuran={12} tebal={2.6} /> Naik 0,4 kg</em></div>
            </div>
            <Bangau className="lp-bangau" />
          </div>
        </div>
        <svg className="lp-gelombang" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden><path d="M0 20C240-6 480 46 720 20s480-26 720 0v20H0z" /></svg>
      </section>

      <div className="lp-info">
        <div><span className="petak kuning"><Ikon nama="kalender" ukuran={20} /></span><span><small>Jadwal</small><b>Setiap tanggal {p.tanggalKegiatan}</b></span></div>
        <div><span className="petak hijau"><Ikon nama="warga" ukuran={20} /></span><span><small>Wilayah</small><b>RT {p.rtDaftar.join(', ')}</b></span></div>
        <div><span className="petak koral"><Ikon nama="lokasi" ukuran={20} /></span><span><small>Lokasi</small><b>{dusun}, {desa}</b></span></div>
        <Link className="btn utama" to="/masuk">Masuk Portal <Ikon nama="kanan" ukuran={18} /></Link>
      </div>

      <section className="lp-sec" id="sasaran">
        <span className="lp-tag"><Daun className="lp-tag-daun" /> SASARAN LAYANAN</span>
        <h2>Satu portal untuk semua kelompok umur</h2>
        <p className="lp-lead">Dari bayi baru lahir sampai lansia, semua tercatat rapi per warga.</p>
        <div className="lp-grid3">
          {SASARAN.map((s) => (
            <article className="lp-kartu-foto" key={s.judul}>
              <div className="lp-foto">
                <img src={s.foto} alt="" loading="lazy" />
                <span className={`lp-label ${s.warna}`}><Ikon nama={s.ikon} ukuran={14} /> {s.label}</span>
              </div>
              <div className="lp-kartu-isi">
                <h3>{s.judul}</h3>
                <p>{s.teks}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-fitur" id="fitur">
        <Bangau className="lp-fitur-bangau" kaki="#F2B33D80" />
        <span className="lp-tag gelap"><Daun className="lp-tag-daun" /> FITUR UNGGULAN</span>
        <h2>Dibuat supaya kerja kader lebih ringan</h2>
        <p className="lp-lead">Semua yang dulu ditulis di buku besar, sekarang cukup beberapa ketukan.</p>
        <div className="lp-grid3">
          {FITUR.map((f, i) => (
            <article className="lp-kartu-kaca" key={f.judul}>
              <span className="petak" style={{ background: f.warna }}><Ikon nama={f.ikon} ukuran={20} /></span>
              <em>{String(i + 1).padStart(2, '0')}</em>
              <h3>{f.judul}</h3>
              <p>{f.teks}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-sec" id="alur">
        <span className="lp-tag"><Daun className="lp-tag-daun" /> ALUR PELAYANAN</span>
        <h2>Empat langkah di hari Posyandu</h2>
        <div className="lp-alur">
          <div className="lp-alur-foto">
            <img src={fotoSuasana} alt="Suasana kegiatan Posyandu" loading="lazy" />
            <span className="lp-chip terang"><i /> Suasana Posyandu</span>
          </div>
          <ol className="lp-langkah">
            {ALUR.map(([j, t, w], i) => (
              <li key={j}>
                <span className="lp-num" style={{ background: w }}>{i + 1}</span>
                <h3>{j}</h3>
                <p>{t}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-cta" id="kontak">
        <div>
          <h2>Siap membantu kader bekerja lebih ringan</h2>
          <p>Posyandu Bangau, {dusun}, Desa {desa}, Jati Agung, Lampung Selatan.</p>
          <Link className="btn gelap" to="/masuk">Masuk Portal Kader <Ikon nama="kanan" ukuran={18} /></Link>
        </div>
        <Bangau className="lp-cta-bangau" kaki="#16302A" />
      </section>

      <footer className="lp-kaki">
        <div className="lp-kaki-atas">
          <Merek />
          <p>Sistem ini alat bantu pencatatan, bukan alat diagnosis medis.</p>
        </div>
        <p>Kapita Selekta Informatika, Kelompok 5, ITERA · Mitra: Posyandu Bangau.</p>
        <p className="lp-atribusi">Foto: Wikimedia Commons: USAID Indonesia (domain publik); Lefaan, Yansen Ricco, Focusfeel (CC BY-SA 4.0).</p>
      </footer>
    </div>
  )
}
