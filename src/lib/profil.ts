// Profil akun sendiri: nama, nama pengguna, foto, dan kata sandi.
// Mode lokal menulis ke tabel `users`; mode server memakai Supabase (aturan dijaga di docs/supabase.sql).
import { createClient } from '@supabase/supabase-js'
import { hashPassword, gantiPassword, gantiPasswordCloud } from './auth'
import { ambilProfil, getKlien, getKonfig, pesanServer, POLA_USERNAME } from './cloud'
import { catat, db, setAuditUser } from './db'
import { MAKS_DATA_URL } from './foto'

export interface IsiProfil {
  nama: string
  username: string
  /** data URL foto; null = hapus foto */
  foto: string | null
}

export function validasiProfil(x: { nama: string; username: string }): Partial<Record<'nama' | 'username', string>> {
  const g: Partial<Record<'nama' | 'username', string>> = {}
  if (!x.nama.trim()) g.nama = 'Nama wajib diisi.'
  else if (x.nama.trim().length > 60) g.nama = 'Nama maksimal 60 karakter.'
  if (!POLA_USERNAME.test(x.username.trim().toLowerCase()))
    g.username = 'Nama pengguna 3-30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.'
  return g
}

export function validasiSandi(baru: string, ulang: string): string | null {
  if (baru.length < 6) return 'Kata sandi baru minimal 6 karakter.'
  if (baru !== ulang) return 'Kata sandi baru dan ulangannya tidak sama.'
  return null
}

/** Simpan profil sendiri. Mengembalikan pesan galat, atau null bila berhasil. */
export async function simpanProfil(
  akun: { cloud: boolean; id?: number; username: string },
  isi: IsiProfil,
): Promise<string | null> {
  const nama = isi.nama.trim()
  const username = isi.username.trim().toLowerCase()
  if (isi.foto && isi.foto.length >= MAKS_DATA_URL) return 'Foto terlalu besar.'
  const gantiNamaPengguna = username !== akun.username

  if (!akun.cloud) {
    if (!akun.id) return 'Akun tidak ditemukan.'
    if (gantiNamaPengguna && (await db.users.where('username').equals(username).first())) return 'Nama pengguna sudah dipakai.'
    await db.users.update(akun.id, { nama, username, foto: isi.foto ?? undefined })
  } else {
    const c = getKlien()
    const uid = (await c.auth.getUser()).data.user?.id
    if (!uid) return 'Sesi berakhir. Silakan masuk lagi.'
    // nama pengguna lewat fungsi server karena email login ikut diganti
    if (gantiNamaPengguna) {
      const { error } = await c.rpc('ganti_username', { baru: username })
      if (error) {
        if (error.code === 'PGRST202' || /could not find the function/i.test(error.message))
          return 'Server belum mendukung ganti nama pengguna. Jalankan ulang docs/supabase.sql di Supabase > SQL Editor.'
        return pesanServer(error.message)
      }
    }
    const { error } = await c.from('profiles').update({ nama, foto: isi.foto }).eq('id', uid)
    if (error) return pesanServer(error.message)
    await ambilProfil(uid) // perbarui salinan profil untuk dipakai saat offline
  }
  if (gantiNamaPengguna) setAuditUser(username)
  await catat('ubah', 'profil', gantiNamaPengguna ? `@${akun.username} menjadi @${username}` : `Profil @${username}`)
  return null
}

/** Cek kata sandi lama sebelum mengganti. */
async function sandiLamaBenar(akun: { cloud: boolean; id?: number }, lama: string): Promise<boolean> {
  if (!akun.cloud) {
    const u = akun.id ? await db.users.get(akun.id) : undefined
    return !!u && (await hashPassword(lama, u.salt)) === u.hash
  }
  const k = getKonfig()
  const email = (await getKlien().auth.getUser()).data.user?.email
  if (!k || !email) return false
  // klien sementara supaya sesi yang sedang berjalan tidak tergeser
  const sementara = createClient(k.url, k.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'posyandu.cek-sandi' },
  })
  const { error } = await sementara.auth.signInWithPassword({ email, password: lama })
  return !error
}

/** Ganti kata sandi sendiri setelah memeriksa kata sandi lama. */
export async function gantiSandiSendiri(akun: { cloud: boolean; id?: number; username: string }, lama: string, baru: string): Promise<string | null> {
  if (!(await sandiLamaBenar(akun, lama))) return 'Kata sandi lama salah.'
  if (akun.cloud) {
    const g = await gantiPasswordCloud(baru)
    if (g) return g
  } else await gantiPassword(akun.id!, baru)
  await catat('ubah', 'profil', `Kata sandi @${akun.username} diganti`)
  return null
}
