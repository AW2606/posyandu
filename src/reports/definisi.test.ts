import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { KATEGORI_DEFAULT } from '../lib/age'
import { db, PENGATURAN_DEFAULT } from '../lib/db'
import { laporanByKode } from './definisi'
import type { KonteksLaporan, ParamLaporan } from './types'

const konteks: KonteksLaporan = { pengaturan: PENGATURAN_DEFAULT, kategori: KATEGORI_DEFAULT }
const param = (x: Partial<ParamLaporan>): ParamLaporan => ({
  tanggal: '2026-11-30', bulan: 11, tahun: 2026, rt: 'semua', jenisObat: 'Vitamin A', jenisIbu: 'keduanya', ttd: false, ...x,
})

let okt1: number, nov1: number, nov2: number

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  const warga = await db.warga.add({
    nama: 'Sari', nik: '', noKK: '', tanggalLahir: '1990-01-01', jk: 'P', rt: '18', dusun: '', alamat: '', namaOrtu: '', aktif: true, dibuat: 0, diubah: 0,
  })
  const buat = async (tanggal: string) => {
    const kegiatanId = await db.kegiatan.add({ tanggal, lokasi: '', keterangan: '' })
    const kunjunganId = await db.kunjungan.add({ kegiatanId, wargaId: warga, noAntrean: 1, hadir: true, tahap: 'terukur', penyuluhan: '', rujukan: '' })
    await db.pemeriksaan.add({ kunjunganId, kegiatanId, wargaId: warga, tanggal, gulaDarah: 100, catatan: '' })
    return kegiatanId
  }
  okt1 = await buat('2026-10-10')
  nov1 = await buat('2026-11-05')
  nov2 = await buat('2026-11-20')
  await db.layananObat.add({ kegiatanId: nov2, wargaId: warga, jenis: 'Vitamin A', keterangan: 'Merah' })
  await db.layananObat.add({ kegiatanId: okt1, wargaId: warga, jenis: 'Vitamin A', keterangan: 'Biru' })
})

describe('laporan per bulan', () => {
  const hasil = laporanByKode('hasil-pemeriksaan')!
  const obat = laporanByKode('pemberian-obat')!

  it('hasil pemeriksaan mencakup semua kegiatan pada bulan terpilih saja', async () => {
    const r = await hasil.bangun(param({}), konteks)
    expect(r.map((x) => x.metaKanan?.[1][1])).toEqual(['05-11-2026', '20-11-2026'])
  })
  it('hasil pemeriksaan bisa dipersempit ke satu kegiatan', async () => {
    const r = await hasil.bangun(param({ kegiatanId: nov1 }), konteks)
    expect(r.map((x) => x.metaKanan?.[1][1])).toEqual(['05-11-2026'])
  })
  it('bulan tanpa kegiatan menghasilkan laporan kosong', async () => {
    expect(await hasil.bangun(param({ bulan: 1 }), konteks)).toEqual([])
  })
  it('pemberian obat melewati kegiatan tanpa penerima bila mencakup sebulan', async () => {
    const r = await obat.bangun(param({}), konteks)
    expect(r.map((x) => x.kop[2])).toEqual(['Tanggal: 20-11-2026'])
  })
  it('pemberian obat tetap mencetak lembar kosong untuk kegiatan yang dipilih', async () => {
    const r = await obat.bangun(param({ kegiatanId: nov1 }), konteks)
    expect(r).toHaveLength(1)
    expect(r[0].bagian[0].baris).toEqual([])
  })
})
