// Aturan izin per peran. Sama dengan aturan di server (docs/supabase.sql); di sini untuk menu dan tombol.
//
//   superadmin : pengelola sistem (satu orang). Semua wewenang admin, ditambah server, riwayat perubahan,
//                cadangan/pulihkan/hapus massal, serta mengelola akun admin.
//   admin      : pengurus Posyandu (bisa beberapa orang). Semua urusan Posyandu: identitas, kategori umur,
//                ambang batas, akun kader, impor CSV, arsip dan hapus permanen warga, hapus kegiatan.
//   kader      : pelayanan harian.
import type { Role } from './db'

export const NAMA_PERAN: Record<Role, string> = { superadmin: 'Super admin', admin: 'Admin', kader: 'Kader' }

/** Admin atau super admin: wewenang pengurus. */
export const pengurus = (r?: Role) => r === 'admin' || r === 'superadmin'
export const superAdmin = (r?: Role) => r === 'superadmin'

/**
 * Bolehkah `pelaku` mengubah, menonaktifkan, mereset sandi, atau menghapus akun `target`?
 * Super admin boleh semua akun lain; admin hanya akun kader. Akun sendiri tidak lewat jalur ini.
 */
export function bolehKelolaAkun(pelaku: Role | undefined, target: Role): boolean {
  if (superAdmin(pelaku)) return true
  return pelaku === 'admin' && target === 'kader'
}

/** Peran yang boleh diberikan `pelaku` saat membuat atau mengubah akun. Super admin tidak bisa dibuat dari aplikasi. */
export function peranBolehDiberi(pelaku: Role | undefined): Role[] {
  if (superAdmin(pelaku)) return ['kader', 'admin']
  if (pelaku === 'admin') return ['kader']
  return []
}

/**
 * Cegah sistem kehilangan super admin terakhir: menurunkan, menonaktifkan, atau menghapus
 * super admin hanya boleh bila masih ada super admin aktif lain.
 */
export function bolehLepasSuperAdmin(semua: Array<{ id: string | number; role: Role; aktif: boolean }>, targetId: string | number): boolean {
  const t = semua.find((x) => x.id === targetId)
  if (!t || t.role !== 'superadmin') return true
  return semua.some((x) => x.id !== targetId && x.role === 'superadmin' && x.aktif)
}
