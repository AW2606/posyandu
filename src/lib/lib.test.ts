import { describe, expect, it } from 'vitest'
import { KATEGORI_DEFAULT, kategoriDari, parseTanggalBebas, perkiraanLahir, umurTahun, usiaHamil } from './age'
import { AMBANG_DEFAULT, hitungIMT, lingkarPerutBerisiko, statusGizi } from './health'

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
})

describe('kehamilan', () => {
  it('HPL = HPHT + 280 hari dan usia kehamilan', () => {
    expect(perkiraanLahir('2026-01-01')).toBe('2026-10-08')
    expect(usiaHamil('2026-01-01', '2026-01-23')).toBe('3 mgg 1 hr')
  })
})
