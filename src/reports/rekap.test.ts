import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { KATEGORI_DEFAULT } from '../lib/age'
import { db, PENGATURAN_DEFAULT, type LayananKunjungan, type Pemeriksaan, type Warga } from '../lib/db'
import { laporanByKode } from './definisi'
import { susunKepala } from './LembarLaporan'
import type { HasilLaporan, KonteksLaporan, ParamLaporan } from './types'

const konteks: KonteksLaporan = { pengaturan: PENGATURAN_DEFAULT, kategori: KATEGORI_DEFAULT }
const param: ParamLaporan = { tanggal: '2026-10-15', bulan: 10, tahun: 2026, rt: 'semua', jenisObat: 'Vitamin A', jenisIbu: 'keduanya', ttd: false }

let sep: number, okt: number

async function warga(nama: string, tanggalLahir: string, jk: 'L' | 'P'): Promise<number> {
  const w: Omit<Warga, 'id'> = { nama, nik: '', noKK: '', tanggalLahir, jk, rt: '22', dusun: '', alamat: '', namaOrtu: '', aktif: true, dibuat: 0, diubah: 0 }
  return db.warga.add(w)
}
async function datang(
  kegiatanId: number, tanggal: string, wargaId: number,
  ukur: Partial<Pemeriksaan>, extra: { layanan?: LayananKunjungan; penyuluhan?: string; rujukan?: string } = {},
) {
  const kunjunganId = await db.kunjungan.add({ kegiatanId, wargaId, noAntrean: 1, hadir: true, tahap: 'terukur', penyuluhan: extra.penyuluhan ?? '', rujukan: extra.rujukan ?? '', layanan: extra.layanan })
  await db.pemeriksaan.add({ kunjunganId, kegiatanId, wargaId, tanggal, catatan: '', ...ukur })
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  sep = await db.kegiatan.add({ tanggal: '2026-09-15', lokasi: '', keterangan: '' })
  okt = await db.kegiatan.add({ tanggal: '2026-10-15', lokasi: '', keterangan: '' })

  const bayi = await warga('Bayi', '2025-10-15', 'L') // 12 bulan pada Oktober
  await datang(sep, '2026-09-15', bayi, { bb: 9.0 })
  await datang(okt, '2026-10-15', bayi, { bb: 9.6, tb: 75.7, lika: 46 }, { layanan: { tbcBatuk: 'Y' } })
  await warga('Bayi absen', '2026-01-01', 'P')

  const remaja = await warga('Remaja', '2010-05-01', 'P') // 16 th
  await datang(okt, '2026-10-15', remaja, { bb: 50, tb: 158, hb: 10, sistol: 120, diastol: 80 }, { layanan: { heeadsss: 'Y' } })
  const delapanBelas = await warga('Delapan belas', '2008-03-01', 'L') // 18 th: masih remaja di rekap
  await datang(okt, '2026-10-15', delapanBelas, { bb: 60, tb: 170 })

  const ibu = await warga('Ibu', '1998-02-01', 'P')
  await db.statusKhusus.add({ wargaId: ibu, jenis: 'hamil', mulai: '2026-08-01' })
  await datang(okt, '2026-10-15', ibu, { bb: 50, tb: 155, lila: 22, sistol: 110, diastol: 70 }, { layanan: { ttdJumlah: 30, ttdRutin: 'Y', kelasIbu: 'T' } })

  const lansia = await warga('Lansia', '1960-01-01', 'L')
  await datang(okt, '2026-10-15', lansia, { bb: 80, tb: 165, lingkarPerut: 95, sistol: 140, diastol: 90 }, {
    layanan: { aks: 'R', skilasGerak: 'Y', skilasKognitif: 'T', pumaSkor: 7 }, penyuluhan: 'Hipertensi', rujukan: 'Puskesmas',
  })
})

/** Nilai sel pada baris bulan ke-i untuk kolom (judul, kelompok). */
function sel(h: HasilLaporan, i: number, judul: string, kelompok?: string) {
  const b = h.bagian[0]
  const j = b.kolom.findIndex((k) => k.judul === judul && (kelompok === undefined || k.kelompok === kelompok))
  expect(j, `kolom ${kelompok ?? ''} > ${judul}`).toBeGreaterThanOrEqual(0)
  return (b.baris[i] as unknown[])[j]
}

describe('rekap Puskesmas 12 bulan', () => {
  it('satu baris per bulan yang ada kegiatannya', async () => {
    const [h] = await laporanByKode('rekap-sasaran')!.bangun(param, konteks)
    expect(h.bagian[0].baris.map((r) => (r as unknown[])[0])).toEqual(['15-09-2026', '15-10-2026'])
  })

  it('rekap balita: sasaran, BB naik, LK, skrining TB', async () => {
    const [h] = await laporanByKode('rekap-balita')!.bangun(param, konteks)
    expect(sel(h, 1, 'BALITA', 'SASARAN')).toBe(2)
    expect(sel(h, 1, 'DATANG', 'SASARAN')).toBe(1)
    expect(sel(h, 1, 'TIDAK DATANG', 'SASARAN')).toBe(1)
    expect(sel(h, 1, 'BB NAIK')).toBe(1) // +600 g pada umur 12 bln (KBM 200 g)
    expect(sel(h, 1, 'NORMAL', 'TB/U')).toBe(1)
    expect(sel(h, 1, 'NORMAL', 'LINGKAR KEPALA')).toBe(1)
    expect(sel(h, 1, 'BATUK ≥2 MG')).toBe(1)
  })

  it('rekap sekolah/remaja: 18 tahun masih remaja, anemia putri, HEEADSSS', async () => {
    const [h] = await laporanByKode('rekap-sekolah-remaja')!.bangun(param, konteks)
    expect(sel(h, 1, '15-18 th', 'Sasaran')).toBe(2)
    expect(sel(h, 1, '15-18 th', 'Datang')).toBe(2)
    expect(sel(h, 1, 'Anemia')).toBe(1)
    expect(sel(h, 1, 'Normal', 'Tekanan darah (≥15 th)')).toBe(1)
    expect(sel(h, 1, 'Skrining HEEADSSS (Ya min. 1)')).toBe(1)
  })

  it('rekap ibu: KEK, TTD, kelas ibu', async () => {
    const [h] = await laporanByKode('rekap-ibu')!.bangun(param, konteks)
    expect(sel(h, 1, 'Ibu hamil', 'Sasaran')).toBe(1)
    expect(sel(h, 1, 'Ibu hamil', 'Datang')).toBe(1)
    expect(sel(h, 1, 'Hijau', 'Berat badan')).toBe(1)
    expect(sel(h, 1, 'Merah/ KEK', 'LILA')).toBe(1)
    expect(sel(h, 1, 'Hijau', 'Tekanan darah')).toBe(1)
    expect(sel(h, 1, 'Bumil dapat TTD')).toBe(1)
    expect(sel(h, 1, 'Minum setiap hari')).toBe(1)
    expect(sel(h, 1, 'Tidak', 'Bumil ikut kelas ibu hamil')).toBe(1)
  })

  it('rekap dewasa/lansia: hanya ≥19 th, IMT 5 tingkat, LP, tensi, PUMA, AKS, SKILAS', async () => {
    const [h] = await laporanByKode('rekap-dewasa-lansia')!.bangun(param, konteks)
    expect(sel(h, 1, 'Obesitas')).toBe(1)
    expect(sel(h, 1, 'Normal', 'IMT')).toBe(1) // ibu hamil 25 th; anak 18 th tidak ikut
    expect(sel(h, 1, 'L > 90 cm')).toBe(1)
    expect(sel(h, 1, 'Tinggi', 'Tekanan darah')).toBe(1)
    expect(sel(h, 1, 'Tinggi ≥6')).toBe(1)
    expect(sel(h, 1, 'B:\u00a0R')).toBe(1)
    expect(sel(h, 1, 'Ya', 'SKILAS gerak')).toBe(1)
    expect(sel(h, 1, 'Tidak', 'SKILAS kognitif')).toBe(1)
    expect(sel(h, 1, 'Mendapat edukasi')).toBe(1)
    expect(sel(h, 1, 'Dirujuk')).toBe(1)
  })
})

describe('judul kolom bertingkat', () => {
  it('dua tingkat sama seperti sebelumnya', () => {
    const k = susunKepala([{ judul: 'NO' }, { judul: 'JAN', kelompok: 'KUNJUNGAN' }, { judul: 'FEB', kelompok: 'KUNJUNGAN' }])
    expect(k.map((r) => r.map((c) => [c.judul, c.span, c.rowSpan]))).toEqual([
      [['NO', 1, 2], ['KUNJUNGAN', 2, 1]],
      [['JAN', 1, 1], ['FEB', 1, 1]],
    ])
  })
  it('tiga tingkat dengan campuran kolom dua tingkat di bawah induk yang sama', () => {
    const k = susunKepala([
      { judul: 'Bulan' },
      { judul: 'BB naik', kelompok: 'Hasil' },
      { judul: 'Pendek', kelompok: 'TB/U', induk: 'Hasil' },
      { judul: 'Normal', kelompok: 'TB/U', induk: 'Hasil' },
    ])
    expect(k.map((r) => r.map((c) => [c.judul, c.span, c.rowSpan]))).toEqual([
      [['Bulan', 1, 3], ['Hasil', 3, 1]],
      [['BB naik', 1, 2], ['TB/U', 2, 1]],
      [['Pendek', 1, 1], ['Normal', 1, 1]],
    ])
  })
})
