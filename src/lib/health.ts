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

/** Jumlah penanda risiko dari hasil ukur yang diberikan (mis. satu kegiatan). */
export function rekapRisiko(
  baris: Array<{ jk: JK; bb?: number; tb?: number; sistol?: number; diastol?: number; lingkarPerut?: number }>,
  a: Ambang,
): { T: number; perut: number; kurus: number; gemuk: number } {
  const r = { T: 0, perut: 0, kurus: 0, gemuk: 0 }
  for (const x of baris) {
    const gizi = statusGizi(hitungIMT(x.bb, x.tb), a)
    if (tekananDarahBerisiko(x.sistol, x.diastol, a)) r.T++
    if (lingkarPerutBerisiko(x.lingkarPerut, x.jk, a)) r.perut++
    if (gizi === 'Kurus') r.kurus++
    if (gizi === 'Gemuk') r.gemuk++
  }
  return r
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
export type KolomUkur =
  | 'bb' | 'tb' | 'lila' | 'lingkarPerut' | 'sistol' | 'diastol' | 'gulaDarah' | 'kolesterol' | 'asamUrat'

/** Batas wajar tiap kolom. Di luar batas ini hampir pasti salah ketik, jadi tidak boleh disimpan. */
export const RENTANG_UKUR: Record<KolomUkur, { min: number; max: number; satuan: string }> = {
  bb: { min: 1, max: 250, satuan: 'kg' },
  tb: { min: 30, max: 220, satuan: 'cm' },
  lila: { min: 5, max: 60, satuan: 'cm' },
  lingkarPerut: { min: 20, max: 200, satuan: 'cm' },
  sistol: { min: 50, max: 300, satuan: 'mmHg' },
  diastol: { min: 30, max: 200, satuan: 'mmHg' },
  gulaDarah: { min: 20, max: 700, satuan: 'mg/dl' },
  kolesterol: { min: 50, max: 600, satuan: 'mg/dl' },
  asamUrat: { min: 1, max: 20, satuan: 'mg/dl' },
}

/**
 * Periksa isian mentah formulir pemeriksaan. Kolom kosong boleh.
 * Mengembalikan pesan galat per kolom; objek kosong berarti semua valid.
 */
export function validasiPemeriksaan(mentah: Partial<Record<KolomUkur, string>>): Partial<Record<KolomUkur, string>> {
  const g: Partial<Record<KolomUkur, string>> = {}
  for (const k of Object.keys(mentah) as KolomUkur[]) {
    const s = (mentah[k] ?? '').trim()
    if (s === '') continue
    const n = numOrUndef(s)
    if (n === undefined) {
      g[k] = 'Harus berupa angka.'
      continue
    }
    const r = RENTANG_UKUR[k]
    if (n < r.min || n > r.max) g[k] = `Harus antara ${angkaId(r.min, 0)}-${angkaId(r.max, 0)} ${r.satuan}.`
  }
  return g
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
