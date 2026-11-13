import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buatUser, hashPassword } from './auth'
import { db } from './db'
import { batasiPosisi, cekBerkasFoto, kotakSumber, posisiTengah, potongTengah, skalaDasar, zoomKeTengah } from './foto'
import { gantiSandiSendiri, simpanProfil, validasiProfil, validasiSandi } from './profil'

describe('foto profil', () => {
  it('hanya gambar dan tidak lebih dari 15 MB', () => {
    expect(cekBerkasFoto({ type: 'image/jpeg', size: 2_000_000 })).toBeNull()
    expect(cekBerkasFoto({ type: 'application/pdf', size: 1000 })).toMatch(/gambar/)
    expect(cekBerkasFoto({ type: 'image/png', size: 20 * 1024 * 1024 })).toMatch(/terlalu besar/)
  })
  it('dipotong persegi dari tengah', () => {
    expect(potongTengah(4000, 3000)).toEqual({ sx: 500, sy: 0, sisi: 3000 }) // mendatar
    expect(potongTengah(1080, 1920)).toEqual({ sx: 0, sy: 420, sisi: 1080 }) // tegak
    expect(potongTengah(500, 500)).toEqual({ sx: 0, sy: 0, sisi: 500 })
  })
})

describe('atur posisi foto', () => {
  // foto mendatar 4000 x 3000 di bingkai 300 px
  const W = 4000, H = 3000, B = 300
  const s = skalaDasar(W, H, B) // 0,1: sisi pendek pas dengan bingkai

  it('awalnya di tengah dan menutup bingkai penuh', () => {
    expect(s).toBeCloseTo(0.1)
    expect(posisiTengah(W, H, s, B)).toEqual({ x: -50, y: 0 })
    expect(kotakSumber({ x: -50, y: 0 }, s, B)).toEqual({ sx: 500, sy: 0, sisi: 3000 })
  })
  it('tidak bisa digeser sampai bingkai kosong', () => {
    expect(batasiPosisi({ x: 40, y: 20 }, W, H, s, B)).toEqual({ x: 0, y: 0 }) // terlalu ke kanan/bawah
    expect(batasiPosisi({ x: -999, y: -999 }, W, H, s, B)).toEqual({ x: -100, y: 0 }) // terlalu ke kiri
  })
  it('digeser ke kiri penuh: yang tampil sisi kanan foto', () => {
    expect(kotakSumber({ x: -100, y: 0 }, s, B)).toEqual({ sx: 1000, sy: 0, sisi: 3000 })
  })
  it('zoom 2x ke tengah: titik tengah tetap, bagian yang tampil mengecil separuh', () => {
    const p = zoomKeTengah(posisiTengah(W, H, s, B), s, s * 2, W, H, B)
    const k = kotakSumber(p, s * 2, B)
    expect(k.sisi).toBeCloseTo(1500)
    expect(k.sx + k.sisi / 2).toBeCloseTo(2000) // tengah foto
    expect(k.sy + k.sisi / 2).toBeCloseTo(1500)
  })
})

describe('validasi profil', () => {
  it('nama wajib dan nama pengguna sesuai pola', () => {
    expect(validasiProfil({ nama: 'Sari', username: 'sari.kader' })).toEqual({})
    expect(validasiProfil({ nama: ' ', username: 'sari' }).nama).toBeDefined()
    expect(validasiProfil({ nama: 'Sari', username: 'sa' }).username).toBeDefined()
    expect(validasiProfil({ nama: 'Sari', username: 'Sari Kader' }).username).toBeDefined()
  })
  it('kata sandi baru minimal 6 dan harus sama', () => {
    expect(validasiSandi('rahasia', 'rahasia')).toBeNull()
    expect(validasiSandi('abc', 'abc')).toMatch(/minimal 6/)
    expect(validasiSandi('rahasia1', 'rahasia2')).toMatch(/tidak sama/)
  })
})

describe('simpan profil mode lokal', () => {
  let id: number
  beforeEach(async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await Promise.all([db.users.clear(), db.audit.clear()])
    id = await buatUser('Sari', 'sari', 'lama123', 'kader')
    await buatUser('Budi', 'budi', 'budi123', 'kader')
  })
  afterEach(() => { vi.unstubAllEnvs() })
  const akun = () => ({ cloud: false, id, username: 'sari' })

  it('mengubah nama, nama pengguna, dan foto, lalu tercatat di riwayat', async () => {
    expect(await simpanProfil(akun(), { nama: 'Sari Dewi', username: 'sari.dewi', foto: 'data:image/jpeg;base64,AAAA' })).toBeNull()
    expect(await db.users.get(id)).toMatchObject({ nama: 'Sari Dewi', username: 'sari.dewi', foto: 'data:image/jpeg;base64,AAAA' })
    expect((await db.audit.toArray()).some((a) => a.detail === '@sari menjadi @sari.dewi')).toBe(true)
  })
  it('menolak nama pengguna yang sudah dipakai', async () => {
    expect(await simpanProfil(akun(), { nama: 'Sari', username: 'budi', foto: null })).toBe('Nama pengguna sudah dipakai.')
    expect((await db.users.get(id))?.username).toBe('sari')
  })
  it('hapus foto', async () => {
    await simpanProfil(akun(), { nama: 'Sari', username: 'sari', foto: 'data:image/jpeg;base64,AAAA' })
    await simpanProfil(akun(), { nama: 'Sari', username: 'sari', foto: null })
    expect((await db.users.get(id))?.foto).toBeUndefined()
  })
  it('ganti kata sandi hanya dengan kata sandi lama yang benar', async () => {
    expect(await gantiSandiSendiri(akun(), 'salah', 'baru456')).toBe('Kata sandi lama salah.')
    expect(await gantiSandiSendiri(akun(), 'lama123', 'baru456')).toBeNull()
    const u = (await db.users.get(id))!
    expect(await hashPassword('baru456', u.salt)).toBe(u.hash)
  })
})
