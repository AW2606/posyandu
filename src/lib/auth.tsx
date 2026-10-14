import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { adaCloud, ambilProfil, emailDariUsername, getKlien, hapusProfilCache, mulaiSinkron } from './cloud'
import { db, setAuditUser, type Role } from './db'

// Dua mode:
// - Lokal (server belum diatur): akun tersimpan di browser. Hanya pembatas tampilan, bukan keamanan sungguhan.
// - Cloud (Supabase): login lewat Supabase Auth; peran dan izin ditegakkan di server (RLS).

const KUNCI = 'posyandu.sesi'

export interface Sesi {
  nama: string
  username: string
  role: Role
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

/** Akun awal supaya aplikasi bisa dibuka pertama kali. Segera ganti kata sandinya. */
export async function pastikanAdminAwal(): Promise<void> {
  if (adaCloud()) return
  if ((await db.users.count()) === 0) await buatUser('Admin Posyandu', 'admin', 'admin123', 'admin')
}

interface AuthCtx {
  user: Sesi | null
  siap: boolean
  cloud: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  isAdmin: boolean
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Sesi | null>(null)
  const [siap, setSiap] = useState(false)
  const cloud = adaCloud()

  useEffect(() => {
    ;(async () => {
      try {
        if (cloud) {
          const { data } = await getKlien().auth.getSession()
          const uid = data.session?.user.id
          const prof = uid ? await ambilProfil(uid) : null
          if (uid && prof?.aktif) {
            setUser({ nama: prof.nama, username: prof.username, role: prof.role, uid })
            setAuditUser(prof.username)
          }
        } else {
          const id = Number(localStorage.getItem(KUNCI))
          if (id) {
            const u = await db.users.get(id)
            if (u?.aktif) {
              setUser({ nama: u.nama, username: u.username, role: u.role, id: u.id })
              setAuditUser(u.username)
            }
          }
        }
      } catch {
        /* abaikan */
      }
      setSiap(true)
    })()
  }, [cloud])

  // sinkron berjalan selama ada yang login
  useEffect(() => {
    if (!cloud || !user) return
    return mulaiSinkron()
  }, [cloud, user])

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
        setAuditUser(prof.username)
        setUser({ nama: prof.nama, username: prof.username, role: prof.role, uid: data.user.id })
        return null
      }
      const u = await db.users.where('username').equals(username.trim().toLowerCase()).first()
      if (!u || !u.aktif) return 'Nama pengguna atau kata sandi salah.'
      if ((await hashPassword(password, u.salt)) !== u.hash) return 'Nama pengguna atau kata sandi salah.'
      localStorage.setItem(KUNCI, String(u.id))
      setAuditUser(u.username)
      setUser({ nama: u.nama, username: u.username, role: u.role, id: u.id })
      return null
    },
    [cloud],
  )

  const logout = useCallback(() => {
    if (cloud) {
      hapusProfilCache()
      void getKlien().auth.signOut()
    } else localStorage.removeItem(KUNCI)
    setUser(null)
  }, [cloud])

  const value = useMemo(
    () => ({ user, siap, cloud, login, logout, isAdmin: user?.role === 'admin' }),
    [user, siap, cloud, login, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
