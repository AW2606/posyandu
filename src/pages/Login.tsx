import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import fotoPanel from '../assets/foto/ibu-bayi-1.jpg'
import { Bangau, Chip, Ikon, Logo, Merek } from '../components/ui'
import { useAuth } from '../lib/auth'
import { bacaAlasanKeluar, hapusAlasanKeluar } from '../lib/sesi'
import '../landing.css'

export default function Login() {
  const { login, cloud } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lihat, setLihat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [proses, setProses] = useState(false)
  const [info] = useState(bacaAlasanKeluar)

  useEffect(() => {
    hapusAlasanKeluar()
  }, [])

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setProses(true)
    setGalat(await login(username, password))
    setProses(false)
  }

  return (
    <div className="lg">
      <aside className="lg-panel" aria-hidden>
        <img src={fotoPanel} alt="" />
        <Merek />
        <Bangau className="lg-bangau" />
        <div>
          <h2>Catat sekali, <span className="miring">rekap otomatis.</span></h2>
          <ul>
            <li><Ikon nama="centang" tebal={3} /> Pemeriksaan tercatat rapi per warga</li>
            <li><Ikon nama="centang" tebal={3} /> Laporan bulanan siap cetak</li>
            <li><Ikon nama="centang" tebal={3} /> Tetap bisa dipakai tanpa internet</li>
          </ul>
        </div>
      </aside>

      <div className="lg-kanan">
        <Link className="lg-kembali" to="/"><Ikon nama="kiri" ukuran={18} /> Beranda</Link>
        <div className="lg-isi">
          <form className="lg-card" onSubmit={kirim}>
            <span className="lg-titik" aria-hidden />
            <div className="atas">
              <Logo ukuran={60} />
              <Chip warna="mint" titik>Portal Kader</Chip>
            </div>
            <div>
              <h1>Selamat datang kembali, Bu Kader</h1>
            </div>
            <p className="lg-sub">Masuk untuk mulai mencatat kegiatan Posyandu Bangau.</p>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lg-user">Nama pengguna</label>
              <div className="lg-ikon-isian">
                <Ikon nama="orang" ukuran={20} />
                <input id="lg-user" className="input" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lg-pw">Kata sandi</label>
              <div className="lg-ikon-isian lg-pw">
                <Ikon nama="kunci" ukuran={20} />
                <input id="lg-pw" className="input" type={lihat ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setLihat(!lihat)} aria-pressed={lihat}>
                  <Ikon nama="mata" ukuran={16} /> {lihat ? 'Sembunyi' : 'Lihat'}
                </button>
              </div>
            </div>

            {galat ? (
              <div className="lg-err" role="alert"><Ikon nama="peringatan" ukuran={20} /> {galat}</div>
            ) : (
              info && <div className="lg-err" role="status"><Ikon nama="info" ukuran={20} /> {info}</div>
            )}

            <button className="btn utama besar penuh" disabled={proses || !username || !password}>
              {proses ? 'Memeriksa…' : <>Masuk <Ikon nama="kanan" ukuran={20} /></>}
            </button>

            <div className="lg-note">
              <Ikon nama="info" ukuran={20} />
              <span>
                {cloud ? (
                  'Lupa kata sandi? Hubungi admin Posyandu untuk mengatur ulang.'
                ) : (
                  <>
                    Perangkat ini belum terhubung ke server bersama. Jika admin mengirim tautan, buka tautan itu lebih dulu.
                    Untuk memakai sendiri, masuk dengan <b>admin</b> / <b>admin123</b>, lalu segera ganti kata sandi di menu Lainnya.
                  </>
                )}
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
