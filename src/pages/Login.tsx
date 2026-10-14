import { useState, type FormEvent } from 'react'
import { Field, Ikon } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login, cloud } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [proses, setProses] = useState(false)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setProses(true)
    setGalat(await login(username, password))
    setProses(false)
  }

  return (
    <div className="login">
      <form className="kartu" onSubmit={kirim}>
        <div className="logo-besar" style={{ color: '#fff' }}>
          <Ikon nama="logo" ukuran={32} />
        </div>
        <h1>Posyandu Bangau</h1>
        <p className="redup">Portal Kader · Dusun 5, Way Huwi</p>
        <Field label="Nama pengguna">
          <input className="input" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </Field>
        <Field label="Kata sandi" galat={galat}>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn utama penuh" disabled={proses || !username || !password}>
          Masuk
        </button>
        {cloud ? (
          <p className="petunjuk" style={{ marginTop: 14 }}>Masuk dengan akun yang dibuat admin Posyandu.</p>
        ) : (
          <p className="petunjuk" style={{ marginTop: 14 }}>
            Perangkat ini belum terhubung ke server bersama. Jika admin mengirim tautan, buka tautan itu lebih dulu.
            Untuk memakai sendiri, masuk dengan <b>admin</b> / <b>admin123</b>, lalu segera ganti kata sandi di menu Lainnya.
          </p>
        )}
      </form>
    </div>
  )
}
