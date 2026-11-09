import { describe, expect, it } from 'vitest'
import { KATEGORI_DEFAULT, kategoriDari, kegiatanPadaBulan, parseTanggalBebas, perkiraanLahir, tanggalAcuanBulan, umurTahun, usiaHamil } from './age'
import { AMBANG_DEFAULT, hitungIMT, lingkarPerutBerisiko, rekapRisiko, statusGizi, validasiPemeriksaan } from './health'
import { BATAS_IDLE_MS, sesiKedaluwarsa } from './sesi'

describe('batas sesi idle (TC-034)', () => {
  const t0 = 1_700_000_000_000
  it('masih aktif sebelum 30 menit', () => {
    expect(sesiKedaluwarsa(t0, t0 + BATAS_IDLE_MS - 1)).toBe(false)
    expect(sesiKedaluwarsa(t0, t0 + 29 * 60 * 1000)).toBe(false)
  })
  it('habis tepat 30 menit atau lebih', () => {
    expect(sesiKedaluwarsa(t0, t0 + BATAS_IDLE_MS)).toBe(true)
    expect(sesiKedaluwarsa(t0, t0 + 2 * BATAS_IDLE_MS)).toBe(true)
  })
  it('belum pernah tercatat atau rusak dianggap habis', () => {
    expect(sesiKedaluwarsa(null, t0)).toBe(true)
    expect(sesiKedaluwarsa(Number.NaN, t0)).toBe(true)
  })
})

describe('validasi pemeriksaan (D-001)', () => {
  it('kolom kosong dan nilai wajar lolos', () => {
    expect(validasiPemeriksaan({ bb: '', tb: '  ', lila: '' })).toEqual({})
    expect(validasiPemeriksaan({ bb: '12,5', tb: '87', sistol: '120', asamUrat: '5,4' })).toEqual({})
  })
  it('menolak nilai negatif dan di luar rentang', () => {
    const g = validasiPemeriksaan({ bb: '-5', tb: '250', sistol: '0' })
    expect(Object.keys(g).sort()).toEqual(['bb', 'sistol', 'tb'])
  })
  it('menolak teks pada kolom angka (bukan diam-diam dikosongkan)', () => {
    expect(validasiPemeriksaan({ bb: 'abc' }).bb).toBe('Harus berupa angka.')
    expect(validasiPemeriksaan({ kolesterol: '12a' }).kolesterol).toBe('Harus berupa angka.')
  })
  it('batas rentang termasuk', () => {
    expect(validasiPemeriksaan({ bb: '1', tb: '220' })).toEqual({})
  })
})

const kat = (lahir: string, ref: string) => kategoriDari(lahir, ref, KATEGORI_DEFAULT)?.kode

describe('umur dan kategori', () => {
  const ref = '2026-10-15'
  it('batas 5/6, 14/15, 17/18, 59/60 tahun', () => {
    expect(kat('2020-10-16', ref)).toBe('balita') // 5 th 11 bln 29 hari
    expect(kat('2020-10-15', ref)).toBe('sekolah') // tepat 6 th
    expect(kat('2011-10-16', ref)).toBe('sekolah') // 14 th
    expect(kat('2011-10-15', ref)).toBe('remaja') // tepat 15 th
    expect(kat('2008-10-16', ref)).toBe('remaja') // 17 th
    expect(kat('2008-10-15', ref)).toBe('dewasa') // tepat 18 th
    expect(kat('1966-10-16', ref)).toBe('dewasa') // 59 th
    expect(kat('1966-10-15', ref)).toBe('lansia') // tepat 60 th
  })
  it('kategori mengikuti tanggal acuan, bukan hari ini', () => {
    expect(kat('2020-10-15', '2026-10-14')).toBe('balita')
    expect(umurTahun('2020-10-15', '2026-10-14')).toBe(5)
  })
  it('parse tanggal', () => {
    expect(parseTanggalBebas('07-06-2014')).toBe('2014-06-07')
    expect(parseTanggalBebas('2014/6/7')).toBe('2014-06-07')
    expect(parseTanggalBebas('31-02-2014')).toBeNull()
  })
})

describe('kesehatan', () => {
  it('IMT dan status', () => {
    expect(hitungIMT(60, 160)).toBe(23.4)
    expect(statusGizi(23.4, AMBANG_DEFAULT)).toBe('Normal')
    expect(statusGizi(18.4, AMBANG_DEFAULT)).toBe('Kurus')
    expect(statusGizi(25, AMBANG_DEFAULT)).toBe('Gemuk')
  })
  it('lingkar perut tepat di batas tidak berisiko', () => {
    expect(lingkarPerutBerisiko(90, 'L', AMBANG_DEFAULT)).toBe(false)
    expect(lingkarPerutBerisiko(90.1, 'L', AMBANG_DEFAULT)).toBe(true)
    expect(lingkarPerutBerisiko(80, 'P', AMBANG_DEFAULT)).toBe(false)
    expect(lingkarPerutBerisiko(81, 'P', AMBANG_DEFAULT)).toBe(true)
  })
  it('rekap risiko menghitung setiap penanda', () => {
    const r = rekapRisiko(
      [
        { jk: 'L', bb: 45, tb: 170, sistol: 140, diastol: 80, lingkarPerut: 95 }, // kurus, T, perut
        { jk: 'P', bb: 80, tb: 160, sistol: 110, diastol: 70, lingkarPerut: 80 }, // gemuk
        { jk: 'P', bb: 55, tb: 160 }, // normal, tanpa tensi
      ],
      AMBANG_DEFAULT,
    )
    expect(r).toEqual({ T: 1, perut: 1, kurus: 1, gemuk: 1 })
  })
})

describe('periode laporan', () => {
  const list = [{ tanggal: '2026-11-20' }, { tanggal: '2026-10-15' }, { tanggal: '2026-11-05' }, { tanggal: '2025-11-05' }]
  it('kegiatan disaring per bulan dan tahun, urut tanggal', () => {
    expect(kegiatanPadaBulan(list, 2026, 11).map((g) => g.tanggal)).toEqual(['2026-11-05', '2026-11-20'])
    expect(kegiatanPadaBulan(list, 2026, 1)).toEqual([])
  })
  it('tanggal acuan: kegiatan terakhir bulan itu, atau akhir bulan', () => {
    expect(tanggalAcuanBulan(list, 2026, 11)).toBe('2026-11-20')
    expect(tanggalAcuanBulan(list, 2026, 2)).toBe('2026-02-28')
    expect(tanggalAcuanBulan(list, 2024, 2)).toBe('2024-02-29')
  })
})

describe('kehamilan', () => {
  it('HPL = HPHT + 280 hari dan usia kehamilan', () => {
    expect(perkiraanLahir('2026-01-01')).toBe('2026-10-08')
    expect(usiaHamil('2026-01-01', '2026-01-23')).toBe('3 mgg 1 hr')
  })
})
