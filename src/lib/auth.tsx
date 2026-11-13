import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { adaCloud, ambilProfil, emailDariUsername, getKlien, hapusProfilCache, mulaiSinkron } from './cloud'
import { db, setAuditUser, type Role } from './db'
import { pengurus, superAdmin } from './peran'
import { bacaAktivitas, catatAktivitas, hapusAktivitas, sesiKedaluwarsa, setAlasanKeluar } from './sesi'

const PESAN_IDLE = 'Sesi berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk lagi.'
const CEK_IDLE_MS = 30 * 1000
const JEDA_CATAT_MS = 15 * 1000

// Dua mode:
// - Lokal (server belum diatur): akun tersimpan di browser. Hanya pembatas tampilan, bukan keamanan sungguhan.
// - Cloud (Supabase): login lewat Supabase Auth; peran dan izin ditegakkan di server (RLS).

const KUNCI = 'posyandu.sesi'

export interface Sesi {
  nama: string
  username: string
  role: Role
  /** foto profil (data URL), bila ada */
  foto?: string | null
  /** id akun lokal */
  id?: number
  /** id akun Supabase */
  uid?: string
}

function acak(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('')
}

export async function buatUser(nama: string, username: string, password: string, role: Role): Promise<number> {
  const salt = acak()
  return db.users.add({
    nama,
    username: username.trim().toLowerCase(),
    salt,
    hash: await hashPassword(password, salt),
    role,
    aktif: true,
  })
}

export async function gantiPassword(id: number, password: string): Promise<void> {
  const salt = acak()
  await db.users.update(id, { salt, hash: await hashPassword(password, salt) })
}

/** Ganti kata sandi akun yang sedang login (mode cloud). */
export async function gantiPasswordCloud(password: string): Promise<string | null> {
  const { error } = await getKlien().auth.updateUser({ password })
  return error ? error.message : null
}

/**
 * Akun awal supaya aplikasi bisa dibuka pertama kali (super admin). Segera ganti kata sandinya.
 * Perangkat lama yang belum punya super admin: admin pertama (akun awal) dinaikkan jadi super admin.
 */
export async function pastikanAdminAwal(): Promise<void> {
  if (adaCloud()) return
  if ((await db.users.count()) === 0) {
    await buatUser('Admin Posyandu', 'admin', 'admin123', 'superadmin')
    return
  }
  if (await db.users.filter((u) => u.role === 'superadmin').first()) return
  const pertama = (await db.users.filter((u) => u.role === 'admin').toArray()).sort((a, b) => a.id! - b.id!)[0]
  if (pertama) await db.users.update(pertama.id!, { role: 'superadmin', aktif: true })
}

interface AuthCtx {
  user: Sesi | null
  siap: boolean
  cloud: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  /** admin atau super admin */
  isAdmin: boolean
  /** khusus super admin (pemilik sistem) */
  isSuper: boolean
  /** perbarui data sesi setelah profil sendiri diubah (nama, nama pengguna, foto) */
  perbaruiSesi: (patch: Partial<Pick<Sesi, 'nama' | 'username' | 'foto'>>) => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Sesi | null>(null)
  const [siap, setSiap] = useState(false)
  const cloud = adaCloud()
  const nav = useNavigate()

  /** Hapus sesi tersimpan (lokal atau Supabase) tanpa menyentuh data. */
  const akhiriSesi = useCallback(() => {
    hapusAktivitas()
    if (cloud) {
      hapusProfilCache()
      void getKlien().auth.signOut()
    } else localStorage.removeItem(KUNCI)
  }, [cloud])

  useEffect(() => {
    ;(async () => {
      try {
        if (cloud) {
          const { data } = await getKlien().auth.getSession()
          const uid = data.session?.user.id
          if (uid && sesiKedaluwarsa(bacaAktivitas(), Date.now())) {
            akhiriSesi()
            setAlasanKeluar(PESAN_IDLE)
            nav('/masuk', { replace: true })
          } else {
            const prof = uid ? await ambilProfil(uid) : null
            if (uid && prof?.aktif) {
              setUser({ nama: prof.nama, username: prof.username, role: prof.role, foto: prof.foto, uid })
              setAuditUser(prof.username)
            }
          }
        } else {
          const id = Number(localStorage.getItem(KUNCI))
          if (id && sesiKedaluwarsa(bacaAktivitas(), Date.now())) {
            akhiriSesi()
            setAlasanKeluar(PESAN_IDLE)
            nav('/masuk', { replace: true })
          } else if (id) {
            const u = await db.users.get(id)
            if (u?.aktif) {
              setUser({ nama: u.nama, username: u.username, role: u.role, foto: u.foto, id: u.id })
              setAuditUser(u.username)
            }
          }
        }
      } catch {
        /* abaikan */
      }
      setSiap(true)
    })()
    // Hanya saat mulai. `nav` sengaja tidak masuk dependensi: di react-router v6 fungsinya berganti
    // tiap pindah halaman, dan sesi tidak boleh dipulihkan ulang setiap navigasi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud])

  // sinkron berjalan selama ada yang login
  useEffect(() => {
    if (!cloud || !user) return
    return mulaiSinkron()
  }, [cloud, user])

  // Keluar otomatis setelah BATAS_IDLE_MS tanpa aktivitas (di semua tab).
  useEffect(() => {
    if (!user) return
    catatAktivitas()
    let terakhirDicatat = Date.now()

    const aktif = () => {
      const t = Date.now()
      // jangan sampai aktivitas setelah batas "menghidupkan" kembali sesi yang sudah habis
      if (sesiKedaluwarsa(bacaAktivitas(), t)) return cek()
      if (t - terakhirDicatat < JEDA_CATAT_MS) return
      terakhirDicatat = t
      catatAktivitas(t)
    }
    const cek = () => {
      if (!sesiKedaluwarsa(bacaAktivitas(), Date.now())) return
      akhiriSesi()
      setAlasanKeluar(PESAN_IDLE)
      setUser(null)
      nav('/masuk', { replace: true })
    }
    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') cek()
    }

    const peristiwa = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    peristiwa.forEach((e) => window.addEventListener(e, aktif, { passive: true }))
    document.addEventListener('visibilitychange', saatTerlihat)
    const timer = window.setInterval(cek, CEK_IDLE_MS)
    return () => {
      peristiwa.forEach((e) => window.removeEventListener(e, aktif))
      document.removeEventListener('visibilitychange', saatTerlihat)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, akhiriSesi])

  const login = useCallback(
    async (username: string, password: string) => {
      if (cloud) {
        const c = getKlien()
        const { data, error } = await c.auth.signInWithPassword({ email: emailDariUsername(username), password })
        if (error) {
          return /fetch|network/i.test(error.message)
            ? 'Tidak bisa terhubung ke server. Periksa internet.'
            : 'Nama pengguna atau kata sandi salah.'
        }
        const prof = await ambilProfil(data.user.id)
        if (!prof?.aktif) {
          await c.auth.signOut()
          return 'Akun belum aktif. Hubungi admin Posyandu.'
        }
        catatAktivitas()
        setAuditUser(prof.username)
        setUser({ nama: prof.nama, username: prof.username, role: prof.role, foto: prof.foto, uid: data.user.id })
        return null
      }
      const u = await db.users.where('username').equals(username.trim().toLowerCase()).first()
      if (!u || !u.aktif) return 'Nama pengguna atau kata sandi salah.'
      if ((await hashPassword(password, u.salt)) !== u.hash) return 'Nama pengguna atau kata sandi salah.'
      localStorage.setItem(KUNCI, String(u.id))
      catatAktivitas()
      setAuditUser(u.username)
      setUser({ nama: u.nama, username: u.username, role: u.role, foto: u.foto, id: u.id })
      return null
    },
    [cloud],
  )

  const logout = useCallback(() => {
    akhiriSesi()
    setUser(null)
  }, [akhiriSesi])

  const perbaruiSesi = useCallback((patch: Partial<Pick<Sesi, 'nama' | 'username' | 'foto'>>) => {
    setUser((u) => (u ? { ...u, ...patch } : u))
  }, [])

  const value = useMemo(
    () => ({ user, siap, cloud, login, logout, perbaruiSesi, isAdmin: pengurus(user?.role), isSuper: superAdmin(user?.role) }),
    [user, siap, cloud, login, logout, perbaruiSesi],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
