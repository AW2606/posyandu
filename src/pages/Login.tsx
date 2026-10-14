import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import logo from '../logo.jpeg'
import '../landing.css'

export default function Login() {
  const { login, cloud } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lihat, setLihat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [proses, setProses] = useState(false)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setProses(true)
    setGalat(await login(username, password))
    setProses(false)
  }

  return (
    <div className="lp lg">
      <div className="lg-blob a" aria-hidden />
      <div className="lg-blob b" aria-hidden />
      <Link className="lg-back" to="/">← Beranda</Link>

      <form className="lg-card" onSubmit={kirim}>
        <img className="lp-mark lg-mark" src={logo} alt="Posyandu Bangau" />
        <h1>Selamat Datang, Kader</h1>
        <p className="lg-sub">Portal Posyandu Bangau · Dusun 5, Way Huwi</p>

        <label className="lg-field">
          <span>Nama pengguna</span>
          <input autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>

        <label className="lg-field">
          <span>Kata sandi</span>
          <div className="lg-pw">
            <input type={lihat ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setLihat(!lihat)} aria-pressed={lihat}>
              {lihat ? 'Sembunyi' : 'Lihat'}
            </button>
          </div>
        </label>

        {galat && <div className="lg-err" role="alert">{galat}</div>}

        <button className="lp-btn lg-submit" disabled={proses || !username || !password}>
          {proses ? 'Memeriksa…' : 'Masuk'}
        </button>

        <p className="lg-note">
          {cloud ? (
            'Masuk dengan akun yang dibuat admin Posyandu.'
          ) : (
            <>
              Perangkat ini belum terhubung ke server bersama. Jika admin mengirim tautan, buka tautan itu lebih dulu.
              Untuk memakai sendiri, masuk dengan <b>admin</b> / <b>admin123</b>, lalu segera ganti kata sandi di menu Lainnya.
            </>
          )}
        </p>
      </form>
    </div>
  )
}
