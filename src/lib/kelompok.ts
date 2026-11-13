// Isian, layanan, dan hasil otomatis yang berbeda per kelompok umur / status.
import type { KodeAKS, LayananKunjungan, YaTidak } from './db'
import { nilaiGiziAnak, statusNaikBB, UMUR_ANAK_MAKS_BLN, type Nada, type Nilai } from './gizi'
import {
  anemia,
  angkaId,
  hitungIMT,
  ketAsamUrat,
  ketKolesterol,
  lilaKEK,
  lingkarPerutBerisiko,
  statusIMT5,
  statusLilaBalita,
  tingkatGula,
  tingkatTensi,
  type Ambang,
  type JK,
} from './health'

export interface ProfilLayanan {
  balita: boolean
  /** di bawah 18 tahun dan bukan balita: status gizi pakai IMT/U */
  anak: boolean
  /** 15-17 tahun */
  remaja15: boolean
  hamil: boolean
  menyusui: boolean
  lansia: boolean
  /** isian tensi (dan gula/kolesterol/asam urat) */
  tensi: boolean
  lingkarPerut: boolean
  lika: boolean
  hb: boolean
  asi: boolean
  heeadsss: boolean
  puma: boolean
}

export function profilLayanan(x: { kode: string; umurBln: number; jk: JK; hamil?: boolean; menyusui?: boolean }): ProfilLayanan {
  const balita = x.kode === 'balita'
  const anak = !balita && x.umurBln < UMUR_ANAK_MAKS_BLN
  const remaja15 = x.umurBln >= 180 && x.umurBln < UMUR_ANAK_MAKS_BLN
  const hamil = !!x.hamil
  const menyusui = !!x.menyusui
  return {
    balita,
    anak,
    remaja15,
    hamil,
    menyusui,
    lansia: x.kode === 'lansia',
    // sama seperti sebelumnya (remaja/dewasa/lansia), ditambah ibu hamil/menyusui
    tensi: ['remaja', 'dewasa', 'lansia'].includes(x.kode) || hamil || menyusui,
    lingkarPerut: !balita,
    lika: balita,
    hb: hamil || (x.jk === 'P' && remaja15),
    asi: balita && x.umurBln <= 6,
    heeadsss: x.umurBln >= 120 && x.umurBln < UMUR_ANAK_MAKS_BLN,
    puma: x.umurBln >= 40 * 12,
  }
}

export interface ChipHasil {
  teks: string
  nada: Nada
}

export interface UkurHasil {
  bb?: number
  tb?: number
  lila?: number
  lingkarPerut?: number
  sistol?: number
  diastol?: number
  gulaDarah?: number
  kolesterol?: number
  asamUrat?: number
  lika?: number
  hb?: number
}

const NAMA_AKS: Record<KodeAKS, string> = { M: 'Mandiri', R: 'Ketergantungan ringan', S: 'Ketergantungan sedang', B: 'Ketergantungan berat', T: 'Ketergantungan total' }
export const PILIHAN_AKS = Object.entries(NAMA_AKS) as Array<[KodeAKS, string]>

export const SKILAS: Array<[keyof LayananKunjungan, string]> = [
  ['skilasKognitif', 'Kognitif'],
  ['skilasGerak', 'Gerak'],
  ['skilasMalnutrisi', 'Malnutrisi'],
  ['skilasPenglihatan', 'Penglihatan'],
  ['skilasPendengaran', 'Pendengaran'],
  ['skilasDepresi', 'Depresi'],
]

export const GEJALA_TBC: Array<[keyof LayananKunjungan, string]> = [
  ['tbcBatuk', 'Batuk terus menerus'],
  ['tbcDemam', 'Demam 2 minggu atau lebih'],
  ['tbcBB', 'BB tidak naik / turun 2 bulan berturut-turut'],
  ['tbcKontak', 'Kontak erat pasien TBC'],
]

/** Bergejala TBC jika memenuhi minimal 2 gejala (kolom rekap Puskesmas). */
export function bergejalaTBC(l: LayananKunjungan | undefined): boolean {
  return GEJALA_TBC.filter(([k]) => (l?.[k] as YaTidak | undefined) === 'Y').length >= 2
}

const chipNilai = (label: string, n: Nilai | undefined): ChipHasil[] =>
  n ? [{ teks: `${label} · ${n.status} (z ${angkaId(n.z)})`, nada: n.nada }] : []

/**
 * Semua chip HASIL OTOMATIS untuk satu pemeriksaan, sesuai kelompok.
 * Dewasa tetap memakai penilaian lama (IMT, lingkar perut, tensi T, gula, kolesterol, asam urat), dengan tingkat tambahan.
 * Balita dan anak di bawah 18 tahun memakai standar WHO, bukan IMT dewasa.
 */
export function hasilOtomatis(x: {
  profil: ProfilLayanan
  v: UkurHasil
  jk: JK
  umurBln: number
  tanggal: string
  a: Ambang
  lalu?: { tanggal: string; bb?: number }
  layanan?: LayananKunjungan
}): ChipHasil[] {
  const { profil: pr, v, jk, umurBln, a } = x
  const out: ChipHasil[] = []

  if (pr.balita || pr.anak) {
    const g = nilaiGiziAnak({ jk, umurBln, bb: v.bb, tb: v.tb, lika: pr.lika ? v.lika : undefined })
    if (pr.balita) {
      const naik = statusNaikBB({ umurBln, tanggal: x.tanggal, bb: v.bb, lalu: x.lalu })
      if (naik) out.push({ teks: naik.selisih !== undefined ? `${naik.teks} ${naik.selisih > 0 ? '+' : ''}${angkaId(naik.selisih, 2)} kg` : naik.teks, nada: naik.kode === 'N' ? 'baik' : naik.kode === 'T' ? 'bahaya' : 'waspada' })
    }
    out.push(...chipNilai('BB/U', g.bbu))
    out.push(...chipNilai(umurBln < 24 ? 'PB/U' : 'TB/U', g.tbu))
    out.push(...chipNilai(umurBln < 24 ? 'BB/PB' : 'BB/TB', g.bbtb))
    out.push(...chipNilai('IMT/U', g.imtu))
    out.push(...chipNilai('LK/U', g.lku))
    const lb = pr.balita ? statusLilaBalita(v.lila, umurBln, a) : undefined
    if (lb) out.push({ teks: `LILA ${angkaId(v.lila)} · ${lb}`, nada: lb === 'Normal' ? 'baik' : lb === 'Gizi buruk' ? 'bahaya' : 'waspada' })
  } else {
    const imt = hitungIMT(v.bb, v.tb)
    const s = statusIMT5(imt, a)
    if (imt !== undefined && s) out.push({ teks: `IMT ${angkaId(imt)} · ${s}`, nada: s === 'Normal' ? 'baik' : 'bahaya' })
  }

  if (pr.hamil && v.lila !== undefined) {
    out.push(lilaKEK(v.lila, a) ? { teks: `LILA ${angkaId(v.lila)} · KEK`, nada: 'bahaya' } : { teks: `LILA ${angkaId(v.lila)} · normal`, nada: 'baik' })
  }
  if (pr.lingkarPerut && lingkarPerutBerisiko(v.lingkarPerut, jk, a)) out.push({ teks: 'Lingkar perut berisiko (LP)', nada: 'bahaya' })

  const td = tingkatTensi(v.sistol, v.diastol, a)
  if (td === 'Tinggi' || (v.sistol !== undefined && v.diastol === undefined && v.sistol >= a.tdSistol) || (v.diastol !== undefined && v.sistol === undefined && v.diastol >= a.tdDiastol))
    out.push({ teks: 'Tensi berisiko (T)', nada: 'bahaya' })
  else if (td === 'Rendah') out.push({ teks: 'Tensi rendah', nada: 'waspada' })
  else if (td === 'Normal') out.push({ teks: 'Tensi normal', nada: 'baik' })

  const gula = tingkatGula(v.gulaDarah, a)
  if (gula) out.push({ teks: `Gula ${gula}`, nada: gula === 'Normal' ? 'baik' : gula === 'Tinggi' ? 'bahaya' : 'waspada' })
  const kol = ketKolesterol(v.kolesterol, a)
  if (kol) out.push({ teks: `Kolesterol ${kol}`, nada: kol === 'Tinggi' ? 'bahaya' : 'baik' })
  const au = ketAsamUrat(v.asamUrat, jk, a)
  if (au) out.push({ teks: `Asam urat ${au}`, nada: au === 'Tinggi' ? 'bahaya' : 'baik' })

  if (pr.hb && v.hb !== undefined) {
    const batas = pr.hamil ? a.hbAnemiaHamil : a.hbAnemiaRemaja
    out.push(anemia(v.hb, batas) ? { teks: `Hb ${angkaId(v.hb)} · Anemia`, nada: 'bahaya' } : { teks: `Hb ${angkaId(v.hb)} · Tidak anemia`, nada: 'baik' })
  }

  const l = x.layanan
  if (bergejalaTBC(l)) out.push({ teks: 'Bergejala TBC (2+ gejala)', nada: 'bahaya' })
  if (pr.heeadsss && l?.heeadsss === 'Y') out.push({ teks: 'HEEADSSS: ada masalah', nada: 'waspada' })
  if (pr.puma && l?.pumaSkor !== undefined)
    out.push(l.pumaSkor >= a.pumaTinggi ? { teks: `PUMA ${l.pumaSkor} · berisiko PPOK`, nada: 'bahaya' } : { teks: `PUMA ${l.pumaSkor} · normal`, nada: 'baik' })
  if (pr.lansia && l?.aks) out.push({ teks: `AKS: ${NAMA_AKS[l.aks]}`, nada: l.aks === 'M' ? 'baik' : l.aks === 'B' || l.aks === 'T' ? 'bahaya' : 'waspada' })
  if (pr.lansia) {
    const masalah = SKILAS.filter(([k]) => l?.[k] === 'Y').map(([, n]) => n.toLowerCase())
    if (masalah.length) out.push({ teks: `SKILAS: ${masalah.join(', ')}`, nada: 'waspada' })
  }
  return out
}
