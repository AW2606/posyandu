import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Ikon } from './components/ui'
import { pastikanAdminAwal, useAuth } from './lib/auth'
import { ChipSinkron } from './components/FormServer'
import { adaCloud, useStatusSinkron } from './lib/cloud'
import { inisialisasi } from './lib/db'
import { usePengaturan } from './lib/hooks'
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
  const p = usePengaturan()
  const sinkron = useStatusSinkron()
  const { pathname } = useLocation()

  useEffect(() => {
    inisialisasi({ isiBawaan: !adaCloud() })
      .then(pastikanAdminAwal)
      .finally(() => setDbSiap(true))
  }, [])

  if (!siap || !dbSiap) return null
  if (!user)
    return (
      <Routes>
        <Route path="/masuk" element={<Login />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="logo">
          <Ikon nama="logo" ukuran={22} />
        </div>
        <h1>
          {p.namaPosyandu.replace(/^POSYANDU /, 'Posyandu ').replace(/BANGAU/, 'Bangau')}
          <small>
            {user.nama} · {user.role === 'admin' ? 'Admin' : 'Kader'}
          </small>
          {sinkron && <ChipSinkron status={sinkron} />}
        </h1>
        <button onClick={logout}>Keluar</button>
      </header>
      <nav className="nav no-print" aria-label="Menu utama">
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => (isActive ? 'aktif' : '')}>
            <Ikon nama={m.ikon} />
            {m.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <div className="halaman" key={pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kegiatan" element={<KegiatanList />} />
          <Route path="/kegiatan/:id" element={<KegiatanDetail />} />
          <Route path="/warga" element={<WargaList />} />
          <Route path="/warga/baru" element={<WargaForm />} />
          <Route path="/warga/impor" element={<WargaImpor />} />
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
