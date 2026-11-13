import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { KATEGORI_DEFAULT } from '../lib/age'
import { db, PENGATURAN_DEFAULT, type LayananKunjungan, type Pemeriksaan } from '../lib/db'
import { KOLOM_HAMIL, KOLOM_NIFAS, slotHamil, slotNifas } from './kartuIbu'
import { laporanByKode } from './definisi'
import type { HasilLaporan, KonteksLaporan, ParamLaporan } from './types'

const konteks: KonteksLaporan = { pengaturan: PENGATURAN_DEFAULT, kategori: KATEGORI_DEFAULT }
let ibu: number
const param = (): ParamLaporan => ({ tanggal: '2026-10-15', bulan: 10, tahun: 2026, rt: 'semua', jenisObat: 'Vitamin A', jenisIbu: 'keduanya', ttd: false, wargaId: ibu })

async function datang(tanggal: string, ukur: Partial<Pemeriksaan>, layanan?: LayananKunjungan, penyuluhan = '') {
  const kegiatanId = await db.kegiatan.add({ tanggal, lokasi: '', keterangan: '' })
  const kunjunganId = await db.kunjungan.add({ kegiatanId, wargaId: ibu, noAntrean: 1, hadir: true, tahap: 'terukur', penyuluhan, rujukan: '', layanan })
  await db.pemeriksaan.add({ kunjunganId, kegiatanId, wargaId: ibu, tanggal, catatan: '', ...ukur })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  ibu = await db.warga.add({ nama: 'Yosi', nik: '1801000000000001', noKK: '', tanggalLahir: '2003-06-20', jk: 'P', rt: '22', dusun: 'Dusun 5', alamat: '', namaOrtu: '', aktif: true, dibuat: 0, diubah: 0 })
  await db.kehamilan.add({ wargaId: ibu, hpht: '2025-12-01', catatan: '', namaSuami: 'Andre', noHp: '0831', tanggalLahir: '2026-09-01', tempat: 'Puskesmas' })
  // 18 minggu: kolom 16-20 minggu
  await datang('2026-04-07', { bb: 45, tb: 147.5, lila: 24, sistol: 120, diastol: 62 }, { ttdJumlah: 30, ttdRutin: 'Y', tbcBatuk: 'T' }, 'Gizi ibu hamil')
  // 30 minggu: kolom 28-32 minggu, LILA KEK
  await datang('2026-06-29', { bb: 53, lila: 23, sistol: 113, diastol: 72 }, { kelasIbu: 'Y' })
  // nifas hari ke-14 dan bulan ke-3
  await datang('2026-09-15', { bb: 47.4, sistol: 105, diastol: 70 }, { vitANifas: 'Y', vitAKapsul: 2, menyusuiAsi: 'Y' })
  await datang('2026-11-20', { bb: 45, sistol: 110, diastol: 73 }, { kbPasca: 'Y' })
})

function baris(h: HasilLaporan, label: string, bagian = 0) {
  const r = h.bagian[bagian].baris.find((x) => Array.isArray(x) && String(x[0]).startsWith(label))
  expect(r, label).toBeDefined()
  return r as unknown[]
}

describe('kolom kartu ibu', () => {
  it('umur kehamilan', () => {
    expect(slotHamil(0)).toBe(0)
    expect(slotHamil(27)).toBe(0) // 3 minggu 6 hari
    expect(slotHamil(28)).toBe(1) // 4 minggu
    expect(KOLOM_HAMIL[slotHamil(18 * 7)!]).toBe('16-20 minggu')
    expect(KOLOM_HAMIL[slotHamil(42 * 7)!]).toBe('36-40 minggu')
    expect(slotHamil(-1)).toBeUndefined()
  })
  it('masa nifas lalu bulan 2-24', () => {
    const lahir = '2026-01-01'
    expect(KOLOM_NIFAS[slotNifas(lahir, '2026-01-05')!]).toBe('<7 hari')
    expect(KOLOM_NIFAS[slotNifas(lahir, '2026-01-20')!]).toBe('7-28 hari')
    expect(KOLOM_NIFAS[slotNifas(lahir, '2026-02-05')!]).toBe('28-42 hari')
    expect(KOLOM_NIFAS[slotNifas(lahir, '2026-02-20')!]).toBe('Bulan 2')
    expect(KOLOM_NIFAS[slotNifas(lahir, '2026-04-10')!]).toBe('Bulan 4')
    expect(KOLOM_NIFAS[slotNifas(lahir, '2027-12-15')!]).toBe('Bulan 24')
    expect(slotNifas(lahir, '2028-01-15')).toBeUndefined()
  })
})

describe('kartu ibu hamil', () => {
  it('mengisi kolom sesuai umur kehamilan', async () => {
    const [h] = await laporanByKode('kartu-ibu-hamil')!.bangun(param(), konteks)
    const k = (j: string) => 1 + KOLOM_HAMIL.indexOf(j)
    expect(baris(h, 'BB (kg)')[k('16-20 minggu')]).toBe('45,0')
    expect(baris(h, 'Tekanan darah (mmHg)')[k('16-20 minggu')]).toBe('120/62')
    expect(baris(h, 'Ploting IMT')[k('16-20 minggu')]).toBe('20,7 N')
    expect(baris(h, 'Ploting LILA')[k('16-20 minggu')]).toBe('N')
    expect(baris(h, 'Ploting LILA')[k('28-32 minggu')]).toBe('KEK')
    expect(baris(h, 'Ploting IMT')[k('28-32 minggu')]).toBe('24,4 N') // TB memakai pengukuran sebelumnya
    expect(baris(h, 'Jumlah TTD')[k('16-20 minggu')]).toBe('30')
    expect(baris(h, 'Batuk terus menerus')[k('16-20 minggu')]).toBe('T')
    expect(baris(h, 'Mengikuti kelas ibu hamil')[k('28-32 minggu')]).toBe('Y')
    expect(baris(h, 'Topik penyuluhan')[k('16-20 minggu')]).toBe('Gizi ibu hamil')
    // kunjungan setelah persalinan tidak masuk kartu hamil
    expect(baris(h, 'BB (kg)').slice(1).filter(Boolean)).toEqual(['45,0', '53,0'])
    expect(h.metaKiri).toContainEqual(['Nama suami', 'Andre'])
  })
})

describe('kartu nifas / menyusui', () => {
  it('dua tabel (sampai bulan 11, lalu bulan 12-24) dan kolom sesuai waktu setelah persalinan', async () => {
    const [h] = await laporanByKode('kartu-nifas')!.bangun(param(), konteks)
    expect(h.bagian).toHaveLength(2)
    expect(h.bagian[0].kolom.at(-1)?.judul).toBe('Bulan 11')
    expect(h.bagian[1].kolom[1].judul).toBe('Bulan 12')
    const k = (j: string) => 1 + KOLOM_NIFAS.indexOf(j)
    expect(baris(h, 'BB (kg)')[k('7-28 hari')]).toBe('47,4')
    expect(baris(h, 'Jika nakes memberikan vitamin A')[k('7-28 hari')]).toBe('2')
    expect(baris(h, 'Menyusui')[k('7-28 hari')]).toBe('Y')
    expect(baris(h, 'KB pasca persalinan')[k('Bulan 3')]).toBe('Y')
    expect(baris(h, 'BB (kg)').slice(1).filter(Boolean)).toEqual(['47,4', '45,0']) // kunjungan saat hamil tidak ikut
  })
})
