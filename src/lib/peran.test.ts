import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buatUser, pastikanAdminAwal } from './auth'
import { db } from './db'
import { bolehKelolaAkun, bolehLepasSuperAdmin, pengurus, peranBolehDiberi, superAdmin } from './peran'

describe('aturan peran', () => {
  it('super admin mengelola semua akun lain; admin hanya kader; kader tidak sama sekali', () => {
    expect(bolehKelolaAkun('superadmin', 'admin')).toBe(true)
    expect(bolehKelolaAkun('superadmin', 'kader')).toBe(true)
    expect(bolehKelolaAkun('admin', 'kader')).toBe(true)
    expect(bolehKelolaAkun('admin', 'admin')).toBe(false)
    expect(bolehKelolaAkun('admin', 'superadmin')).toBe(false) // inti kasus: admin tidak bisa menghapus pemilik
    expect(bolehKelolaAkun('kader', 'kader')).toBe(false)
  })
  it('peran yang boleh diberikan; super admin tidak bisa dibuat dari aplikasi', () => {
    expect(peranBolehDiberi('superadmin')).toEqual(['kader', 'admin'])
    expect(peranBolehDiberi('admin')).toEqual(['kader'])
    expect(peranBolehDiberi('kader')).toEqual([])
  })
  it('pengurus = admin atau super admin', () => {
    expect([pengurus('superadmin'), pengurus('admin'), pengurus('kader')]).toEqual([true, true, false])
    expect([superAdmin('superadmin'), superAdmin('admin')]).toEqual([true, false])
  })
  it('super admin terakhir tidak boleh dilepas', () => {
    const satu = [{ id: 'a', role: 'superadmin' as const, aktif: true }, { id: 'b', role: 'admin' as const, aktif: true }]
    expect(bolehLepasSuperAdmin(satu, 'a')).toBe(false)
    expect(bolehLepasSuperAdmin(satu, 'b')).toBe(true)
    expect(bolehLepasSuperAdmin([...satu, { id: 'c', role: 'superadmin', aktif: true }], 'a')).toBe(true)
    expect(bolehLepasSuperAdmin([...satu, { id: 'c', role: 'superadmin', aktif: false }], 'a')).toBe(false)
  })
})

describe('akun awal mode lokal', () => {
  beforeEach(async () => {
    // .env pengembang bisa berisi alamat Supabase; tes ini khusus mode lokal
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await db.users.clear()
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('perangkat baru: akun awal langsung super admin', async () => {
    await pastikanAdminAwal()
    expect((await db.users.toArray()).map((u) => [u.username, u.role])).toEqual([['admin', 'superadmin']])
  })
  it('perangkat lama tanpa super admin: admin pertama dinaikkan, admin lain tetap', async () => {
    const pertama = await buatUser('Pemilik', 'pemilik', 'rahasia1', 'admin')
    const desa = await buatUser('Admin Desa', 'desa', 'rahasia2', 'admin')
    await pastikanAdminAwal()
    expect((await db.users.get(pertama))?.role).toBe('superadmin')
    expect((await db.users.get(desa))?.role).toBe('admin')
    await pastikanAdminAwal() // dijalankan ulang tidak menaikkan admin lain
    expect((await db.users.get(desa))?.role).toBe('admin')
  })
})
