export type JK = 'L' | 'P'

export interface Ambang {
  imtKurus: number // di bawah ini = berisiko kurang
  imtGemuk: number // sama dengan atau di atas ini = berisiko lebih
  lingkarPerutL: number // di atas ini berisiko
  lingkarPerutP: number
  tdSistol: number // sama dengan atau di atas ini = risiko (penanda T)
  tdDiastol: number
  gulaDarahMax: number
  kolesterolMax: number
  asamUratL: number
  asamUratP: number
}

/** [KONFIRMASI] Semua angka bisa diubah Admin di Pengaturan. */
export const AMBANG_DEFAULT: Ambang = {
  imtKurus: 18.5,
  imtGemuk: 25,
  lingkarPerutL: 90,
  lingkarPerutP: 80,
  tdSistol: 130,
  tdDiastol: 85,
  gulaDarahMax: 200,
  kolesterolMax: 200,
  asamUratL: 7,
  asamUratP: 6,
}

export function hitungIMT(bb?: number, tb?: number): number | undefined {
  if (!bb || !tb || bb <= 0 || tb <= 0) return undefined
  const m = tb / 100
  return Math.round((bb / (m * m)) * 10) / 10
}

export type StatusGizi = 'Kurus' | 'Normal' | 'Gemuk'

export function statusGizi(imt: number | undefined, a: Ambang): StatusGizi | undefined {
  if (imt === undefined) return undefined
  if (imt < a.imtKurus) return 'Kurus'
  if (imt >= a.imtGemuk) return 'Gemuk'
  return 'Normal'
}

/** Tepat di batas (90 / 80) tidak ditandai; di atasnya ditandai. */
export function lingkarPerutBerisiko(cm: number | undefined, jk: JK, a: Ambang): boolean {
  if (cm === undefined) return false
  return cm > (jk === 'L' ? a.lingkarPerutL : a.lingkarPerutP)
}

export function tekananDarahBerisiko(
  sis: number | undefined,
  dia: number | undefined,
  a: Ambang,
): boolean {
  return (sis !== undefined && sis >= a.tdSistol) || (dia !== undefined && dia >= a.tdDiastol)
}

export type Kadar = 'Normal' | 'Tinggi'

export function ketGula(v: number | undefined, a: Ambang): Kadar | '' {
  return v === undefined ? '' : v >= a.gulaDarahMax ? 'Tinggi' : 'Normal'
}
export function ketKolesterol(v: number | undefined, a: Ambang): Kadar | '' {
  return v === undefined ? '' : v >= a.kolesterolMax ? 'Tinggi' : 'Normal'
}
export function ketAsamUrat(v: number | undefined, jk: JK, a: Ambang): Kadar | '' {
  if (v === undefined) return ''
  return v > (jk === 'L' ? a.asamUratL : a.asamUratP) ? 'Tinggi' : 'Normal'
}

/** Peringatan rentang wajar (bukan blokir keras). */
export function peringatanRentang(p: {
  bb?: number
  tb?: number
  lila?: number
  lingkarPerut?: number
}): string[] {
  const w: string[] = []
  if (p.tb !== undefined && (p.tb < 30 || p.tb > 220)) w.push('Tinggi badan di luar 30–220 cm, periksa lagi.')
  if (p.bb !== undefined && (p.bb < 1 || p.bb > 250)) w.push('Berat badan di luar 1–250 kg, periksa lagi.')
  if (p.lila !== undefined && (p.lila < 5 || p.lila > 60)) w.push('LILA di luar 5–60 cm, periksa lagi.')
  if (p.lingkarPerut !== undefined && (p.lingkarPerut < 20 || p.lingkarPerut > 200))
    w.push('Lingkar perut di luar 20–200 cm, periksa lagi.')
  return w
}

/** Angka dengan desimal koma, sesuai format laporan. */
export function angkaId(n: number | undefined, desimal = 1): string {
  if (n === undefined || Number.isNaN(n)) return ''
  return n.toFixed(desimal).replace('.', ',')
}

export function numOrUndef(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
