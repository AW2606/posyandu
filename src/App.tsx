import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Bangau, Ikon, Merek, inisial } from './components/ui'
import { pastikanAdminAwal, useAuth } from './lib/auth'
import { adaCloud, useStatusSinkron } from './lib/cloud'
import { inisialisasi } from './lib/db'
import { salam, teksSinkron } from './lib/tampilan'
import Dashboard from './pages/Dashboard'
import KegiatanDetail from './pages/KegiatanDetail'
import KegiatanList from './pages/KegiatanList'
import Laporan from './pages/Laporan'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Pengaturan from './pages/Pengaturan'
import TindakLanjut from './pages/TindakLanjut'
import WargaDetail from './pages/WargaDetail'
import WargaForm from './pages/WargaForm'
import WargaImpor from './pages/WargaImpor'
import WargaList from './pages/WargaList'

const MENU = [
  { to: '/', label: 'Beranda', ikon: 'beranda', end: true },
  { to: '/kegiatan', label: 'Layanan', ikon: 'layanan' },
  { to: '/warga', label: 'Warga', ikon: 'warga' },
  { to: '/laporan', label: 'Laporan', ikon: 'laporan' },
  { to: '/pengaturan', label: 'Lainnya', ikon: 'lainnya' },
]

export default function App() {
  const { user, siap, logout } = useAuth()
  const [dbSiap, setDbSiap] = useState(false)
  const sinkron = useStatusSinkron()
  const { pathname } = useLocation()

  useEffect(() => {
    inisialisasi({ isiBawaan: !adaCloud() })
      .then(pastikanAdminAwal)
      .finally(() => setDbSiap(true))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (!siap || !dbSiap) return null
  if (!user)
    return (
      <Routes>
        <Route path="/masuk" element={<Login />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )

  const st = teksSinkron(sinkron)
  const peran = user.role === 'admin' ? 'Admin' : 'Kader'
  const warnaTitik = st.warna === 'hijau' ? '#2E8B6A' : st.warna === 'kuning' ? '#E09A1B' : '#E46F4C'

  return (
    <div className="app">
      <header className="topbar no-print">
        <span className="avatar-pengguna" aria-hidden>{inisial(user.nama)}</span>
        <div className="sapa">
          <small>{salam()},</small>
          <b>{user.nama}</b>
        </div>
        <span className="tombol-bulat" title={`${st.judul} · ${st.sub}`} aria-label={st.judul} role="img">
          <Ikon nama="awan" ukuran={20} />
          <i className="titik-sinkron" style={{ background: warnaTitik }} />
        </span>
        <button className="tombol-bulat" onClick={logout} aria-label="Keluar" title="Keluar">
          <Ikon nama="keluar" ukuran={20} />
        </button>
      </header>

      <nav className="nav no-print" aria-label="Menu utama">
        <Merek />
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive || (m.to === '/' && pathname === '/tindak-lanjut') ? 'aktif' : '')}>
            <Ikon nama={m.ikon} tebal={2.1} />
            {m.label}
          </NavLink>
        ))}
        <span className="nav-ruang" />
        <span className="nav-hias" aria-hidden />
        <Bangau className="nav-bangau" kaki="#F2B33D66" />
        <div className="nav-bawah">
          <div className={`kotak-sinkron ${st.warna}`} title={st.sub}>
            <span className="bulat"><Ikon nama="awan" ukuran={18} /></span>
            <div style={{ minWidth: 0 }}>
              <b>{st.judul}</b>
              <small style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.sub}</small>
            </div>
          </div>
          <div className="kotak-pengguna">
            <div className="baris-p">
              <span className="avatar-pengguna">{inisial(user.nama)}</span>
              <div>
                <b>{user.nama}</b>
                <small>{peran} · @{user.username}</small>
              </div>
            </div>
            <button className="btn kecil penuh" onClick={logout}>
              <Ikon nama="keluar" ukuran={18} /> Keluar
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        <div className="halaman" key={pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kegiatan" element={<KegiatanList />} />
            <Route path="/kegiatan/:id" element={<KegiatanDetail />} />
            <Route path="/warga" element={<WargaList />} />
            <Route path="/warga/baru" element={<WargaForm />} />
            {/* Impor massal khusus admin, sama seperti menu di Lainnya. Kader yang membuka URL-nya dialihkan. */}
            <Route path="/warga/impor" element={user.role === 'admin' ? <WargaImpor /> : <Navigate to="/warga" replace />} />
            <Route path="/warga/:id" element={<WargaDetail />} />
            <Route path="/warga/:id/ubah" element={<WargaForm />} />
            <Route path="/tindak-lanjut" element={<TindakLanjut />} />
            <Route path="/laporan" element={<Laporan />} />
            <Route path="/pengaturan" element={<Pengaturan />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
