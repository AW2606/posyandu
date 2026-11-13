import { describe, expect, it } from 'vitest'
import { lmsPada, nilaiGiziAnak, statusNaikBB, zLMS } from './gizi'
import { AMBANG_DEFAULT } from './health'
import { hasilOtomatis, profilLayanan } from './kelompok'
import { WHO } from './whoData'

const dekat = (a: number | undefined, b: number, tol = 0.1) => expect(Math.abs((a ?? NaN) - b)).toBeLessThan(tol)

describe('z-score WHO dicocokkan dengan tabel resmi', () => {
  it('BB/U laki-laki 12 bulan: median 9,6 kg, -2 SD 7,7 kg, -3 SD 6,9 kg, +2 SD 12,0 kg', () => {
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 12, bb: 9.6 }).bbu?.z, 0)
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 12, bb: 7.7 }).bbu?.z, -2)
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 12, bb: 6.9 }).bbu?.z, -3)
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 12, bb: 12.0 }).bbu?.z, 2)
  })
  it('PB/U laki-laki lahir: median 49,9 cm, -2 SD 46,1 cm', () => {
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 0, tb: 49.9 }).tbu?.z, 0)
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 0, tb: 46.1 }).tbu?.z, -2)
  })
  it('LK/U laki-laki lahir: median 34,5 cm, -2 SD 31,9 cm', () => {
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 0, lika: 34.5 }).lku?.z, 0)
    dekat(nilaiGiziAnak({ jk: 'L', umurBln: 0, lika: 31.9 }).lku?.z, -2)
  })
  it('nilai di median tabel selalu z = 0, dan tabel di antara baris diinterpolasi', () => {
    const [L, M, S] = WHO.bbpb.P[20] // 55 cm
    expect(zLMS([L, M, S], M, true)).toBeCloseTo(0, 6)
    const tengah = lmsPada(WHO.bbpb, 'P', 55.25)!
    expect(tengah[1]).toBeGreaterThan(M)
    expect(lmsPada(WHO.bbpb, 'P', 44)).toBeUndefined()
  })
})

describe('kategori Permenkes 2/2020', () => {
  it('balita pendek dan gizi kurang', () => {
    const g = nilaiGiziAnak({ jk: 'P', umurBln: 30, bb: 8.9, tb: 83 }) // BB/TB perempuan 83 cm: -2 SD 9,2 kg, -3 SD 8,5 kg
    expect(g.tbu?.status).toBe('Pendek')
    expect(g.bbtb?.status).toBe('Gizi kurang')
    expect(g.imtu).toBeUndefined() // di bawah 60 bulan pakai BB/TB, bukan IMT/U
  })
  it('anak 10 tahun dinilai dengan IMT/U, tidak dengan BB/TB atau LK/U', () => {
    const g = nilaiGiziAnak({ jk: 'L', umurBln: 120, bb: 45, tb: 140, lika: 50 })
    expect(g.imtu?.status).toBe('Obesitas')
    expect(g.bbtb).toBeUndefined()
    expect(g.lku).toBeUndefined()
  })
})

describe('naik berat badan (KMS)', () => {
  const lalu = { tanggal: '2026-09-15', bb: 8 }
  it('N bila naik minimal KBM, T bila kurang atau turun', () => {
    expect(statusNaikBB({ umurBln: 8, tanggal: '2026-10-15', bb: 8.3, lalu })?.kode).toBe('N')
    expect(statusNaikBB({ umurBln: 8, tanggal: '2026-10-15', bb: 8.2, lalu })?.kode).toBe('T')
    expect(statusNaikBB({ umurBln: 8, tanggal: '2026-10-15', bb: 7.8, lalu })).toMatchObject({ kode: 'T', turun: true })
  })
  it('O bila bulan lalu tidak ditimbang, B bila pertama kali', () => {
    expect(statusNaikBB({ umurBln: 8, tanggal: '2026-11-15', bb: 8.5, lalu })?.kode).toBe('O')
    expect(statusNaikBB({ umurBln: 8, tanggal: '2026-11-15', bb: 8.5 })?.kode).toBe('B')
  })
})

describe('hasil otomatis per kelompok', () => {
  const a = AMBANG_DEFAULT
  const teks = (x: Parameters<typeof hasilOtomatis>[0]) => hasilOtomatis(x).map((c) => c.teks)

  it('balita: memakai standar WHO dan LIKA, tanpa IMT dewasa', () => {
    const profil = profilLayanan({ kode: 'balita', umurBln: 12, jk: 'L' })
    expect(profil.lika && !profil.lingkarPerut).toBe(true)
    const t = teks({ profil, v: { bb: 9.6, tb: 75.7, lika: 46 }, jk: 'L', umurBln: 12, tanggal: '2026-10-15', a })
    expect(t.some((x) => x.startsWith('BB/U · BB normal'))).toBe(true)
    expect(t.some((x) => x.startsWith('LK/U'))).toBe(true)
    expect(t.some((x) => x.startsWith('IMT '))).toBe(false)
  })
  it('anak sekolah: IMT/U menggantikan IMT dewasa', () => {
    const profil = profilLayanan({ kode: 'sekolah', umurBln: 96, jk: 'P' })
    const t = teks({ profil, v: { bb: 25, tb: 128 }, jk: 'P', umurBln: 96, tanggal: '2026-10-15', a })
    expect(t.some((x) => x.startsWith('IMT/U'))).toBe(true)
    expect(t.some((x) => x.startsWith('IMT 1'))).toBe(false)
  })
  it('dewasa: IMT 5 tingkat, LP, tensi rendah/tinggi, gula rendah', () => {
    const profil = profilLayanan({ kode: 'dewasa', umurBln: 45 * 12, jk: 'P' })
    expect(teks({ profil, v: { bb: 90, tb: 160, lingkarPerut: 95, sistol: 140, diastol: 90 }, jk: 'P', umurBln: 540, tanggal: '2026-10-15', a }))
      .toEqual(['IMT 35,2 · Obesitas', 'Lingkar perut berisiko (LP)', 'Tensi berisiko (T)'])
    expect(teks({ profil, v: { sistol: 85, diastol: 55, gulaDarah: 60 }, jk: 'P', umurBln: 540, tanggal: '2026-10-15', a }))
      .toEqual(['Tensi rendah', 'Gula Rendah'])
  })
  it('ibu hamil: LILA KEK dan anemia', () => {
    const profil = profilLayanan({ kode: 'dewasa', umurBln: 25 * 12, jk: 'P', hamil: true })
    expect(profil.hb).toBe(true)
    const t = teks({ profil, v: { lila: 22, hb: 10 }, jk: 'P', umurBln: 300, tanggal: '2026-10-15', a })
    expect(t).toEqual(['LILA 22,0 · KEK', 'Hb 10,0 · Anemia'])
  })
  it('skrining: TBC 2 gejala, PUMA, AKS, SKILAS', () => {
    const profil = profilLayanan({ kode: 'lansia', umurBln: 65 * 12, jk: 'L' })
    const t = teks({
      profil, v: {}, jk: 'L', umurBln: 780, tanggal: '2026-10-15', a,
      layanan: { tbcBatuk: 'Y', tbcDemam: 'Y', pumaSkor: 7, aks: 'R', skilasGerak: 'Y', skilasKognitif: 'T' },
    })
    expect(t).toEqual(['Bergejala TBC (2+ gejala)', 'PUMA 7 · berisiko PPOK', 'AKS: Ketergantungan ringan', 'SKILAS: gerak'])
  })
})
