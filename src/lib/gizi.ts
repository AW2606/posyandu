// Penilaian status gizi anak dengan standar antropometri WHO (z-score),
// kategori mengikuti Permenkes No. 2 Tahun 2020 tentang Standar Antropometri Anak.
import type { JK, StatusGizi } from './health'
import { WHO, type TabelLMS } from './whoData'

/** Nilai L, M, S pada x (bulan atau cm). Di antara dua baris diinterpolasi linear. Di luar tabel: undefined. */
export function lmsPada(t: TabelLMS, jk: JK, x: number): [number, number, number] | undefined {
  const rows = t[jk]
  const pos = (x - t.x0) / t.step
  if (pos < 0 || pos > rows.length - 1 + 1e-9) return undefined
  const i = Math.min(Math.floor(pos), rows.length - 1)
  const f = pos - i
  if (f < 1e-9 || i === rows.length - 1) return rows[i]
  const a = rows[i]
  const b = rows[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

/**
 * z-score metode LMS WHO. Untuk indikator berbasis berat (dibatasi = true), nilai di luar ±3 SD
 * dihitung ulang dengan jarak SD23 seperti pada software WHO Anthro.
 */
export function zLMS([L, M, S]: [number, number, number], x: number, dibatasi: boolean): number {
  const z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S)
  if (!dibatasi || Math.abs(z) <= 3) return z
  const sd = (k: number) => (L === 0 ? M * Math.exp(S * k) : M * Math.pow(1 + L * S * k, 1 / L))
  if (z > 3) return 3 + (x - sd(3)) / (sd(3) - sd(2))
  return -3 + (x - sd(-3)) / (sd(-2) - sd(-3))
}

const bulat = (z: number) => Math.round(z * 100) / 100

function z(tabel: TabelLMS, jk: JK, x: number, nilai: number | undefined, dibatasi: boolean): number | undefined {
  if (nilai === undefined || nilai <= 0) return undefined
  const lms = lmsPada(tabel, jk, x)
  return lms ? bulat(zLMS(lms, nilai, dibatasi)) : undefined
}

export type Nada = 'baik' | 'waspada' | 'bahaya'
export interface Nilai {
  z: number
  status: string
  nada: Nada
}

const nilai = (zz: number | undefined, f: (z: number) => [string, Nada]): Nilai | undefined => {
  if (zz === undefined) return undefined
  const [status, nada] = f(zz)
  return { z: zz, status, nada }
}

export const katBBU = (z: number): [string, Nada] =>
  z < -3 ? ['BB sangat kurang', 'bahaya'] : z < -2 ? ['BB kurang', 'waspada'] : z <= 1 ? ['BB normal', 'baik'] : ['Risiko BB lebih', 'waspada']
export const katTBU = (z: number): [string, Nada] =>
  z < -3 ? ['Sangat pendek', 'bahaya'] : z < -2 ? ['Pendek', 'waspada'] : z <= 3 ? ['Tinggi normal', 'baik'] : ['Tinggi', 'waspada']
export const katBBTB = (z: number): [string, Nada] =>
  z < -3
    ? ['Gizi buruk', 'bahaya']
    : z < -2
      ? ['Gizi kurang', 'waspada']
      : z <= 1
        ? ['Gizi baik', 'baik']
        : z <= 2
          ? ['Berisiko gizi lebih', 'waspada']
          : z <= 3
            ? ['Gizi lebih', 'waspada']
            : ['Obesitas', 'bahaya']
/** IMT/U anak 5-18 tahun. */
export const katIMTU = (z: number): [string, Nada] =>
  z < -3 ? ['Gizi buruk', 'bahaya'] : z < -2 ? ['Gizi kurang', 'waspada'] : z <= 1 ? ['Gizi baik', 'baik'] : z <= 2 ? ['Gizi lebih', 'waspada'] : ['Obesitas', 'bahaya']
export const katLKU = (z: number): [string, Nada] =>
  z < -2 ? ['Lingkar kepala kurang', 'waspada'] : z <= 2 ? ['Lingkar kepala normal', 'baik'] : ['Lingkar kepala lebih', 'waspada']

export interface PenilaianAnak {
  bbu?: Nilai
  tbu?: Nilai
  /** BB/PB (di bawah 24 bulan) atau BB/TB (24-60 bulan) */
  bbtb?: Nilai
  lku?: Nilai
  /** IMT/U, dipakai sebagai status gizi untuk umur di atas 60 bulan */
  imtu?: Nilai
}

/**
 * Status gizi anak menurut umur (bulan penuh). Hanya indikator yang punya tabel untuk umur itu yang terisi:
 * BB/U 0-120 bln, TB/U 0-228 bln, BB/PB-TB 0-60 bln, LK/U 0-60 bln, IMT/U 61-228 bln.
 */
export function nilaiGiziAnak(x: { jk: JK; umurBln: number; bb?: number; tb?: number; lika?: number }): PenilaianAnak {
  const { jk, umurBln: u } = x
  const r: PenilaianAnak = {}
  r.bbu = nilai(z(WHO.bbu, jk, u, x.bb, true), katBBU)
  r.tbu = nilai(z(WHO.tbu, jk, u, x.tb, false), katTBU)
  if (u <= 60) {
    if (x.bb !== undefined && x.tb !== undefined) r.bbtb = nilai(z(u < 24 ? WHO.bbpb : WHO.bbtb, jk, x.tb, x.bb, true), katBBTB)
    r.lku = nilai(z(WHO.lku, jk, u, x.lika, false), katLKU)
  } else if (x.bb !== undefined && x.tb !== undefined) {
    const imt = x.bb / Math.pow(x.tb / 100, 2)
    r.imtu = nilai(z(WHO.imtu, jk, u, imt, true), katIMTU)
  }
  for (const k of Object.keys(r) as Array<keyof PenilaianAnak>) if (!r[k]) delete r[k]
  return r
}

/** Batas umur (bulan) yang dinilai dengan standar anak, bukan IMT dewasa. */
export const UMUR_ANAK_MAKS_BLN = 216 // di bawah 18 tahun

/** Ringkas status gizi anak ke 3 tingkat yang dipakai filter dan dashboard. */
export function giziAnakRingkas(p: PenilaianAnak): StatusGizi | undefined {
  const s = p.bbtb ?? p.imtu
  if (!s) return undefined
  if (s.z < -2) return 'Kurus'
  if (s.z > (p.bbtb ? 2 : 1)) return 'Gemuk'
  return 'Normal'
}

/**
 * Status gizi 3 tingkat untuk siapa pun: anak di bawah 18 tahun memakai standar WHO,
 * dewasa memakai IMT seperti sebelumnya (statusGizi).
 */
export function statusGiziWarga(
  x: { jk: JK; umurBln: number; bb?: number; tb?: number },
  imtDewasa: (bb?: number, tb?: number) => StatusGizi | undefined,
): StatusGizi | undefined {
  if (x.umurBln < UMUR_ANAK_MAKS_BLN) return giziAnakRingkas(nilaiGiziAnak(x))
  return imtDewasa(x.bb, x.tb)
}

/**
 * Kenaikan Berat badan Minimal (KBM) per bulan dalam gram, sesuai KMS (Permenkes 155/2010).
 * Indeks = umur dalam bulan; 12 bulan ke atas 200 g.
 */
export const KBM_GRAM = [0, 800, 900, 800, 600, 500, 400, 400, 300, 300, 300, 200]
export const kbm = (umurBln: number) => (umurBln < KBM_GRAM.length ? KBM_GRAM[Math.max(0, umurBln)] : 200)

export type KodeNaik = 'N' | 'T' | 'O' | 'B'
export interface HasilNaik {
  kode: KodeNaik
  teks: string
  /** selisih dalam kg terhadap penimbangan bulan lalu */
  selisih?: number
  turun?: boolean
}

const bulanKe = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7))

/**
 * Status naik berat badan balita dibanding penimbangan bulan lalu (kode KMS):
 * N = naik sesuai KBM, T = tidak naik (kurang dari KBM, tetap, atau turun),
 * O = bulan lalu tidak ditimbang, B = baru pertama kali ditimbang.
 */
export function statusNaikBB(x: {
  umurBln: number
  tanggal: string
  bb?: number
  lalu?: { tanggal: string; bb?: number }
}): HasilNaik | undefined {
  if (x.bb === undefined) return undefined
  if (!x.lalu || x.lalu.bb === undefined) return { kode: 'B', teks: 'Baru ditimbang (B)' }
  if (bulanKe(x.tanggal) - bulanKe(x.lalu.tanggal) !== 1) return { kode: 'O', teks: 'Bulan lalu tidak ditimbang (O)' }
  const selisih = Math.round((x.bb - x.lalu.bb) * 100) / 100
  if (selisih * 1000 >= kbm(x.umurBln)) return { kode: 'N', teks: 'BB naik (N)', selisih }
  return { kode: 'T', teks: selisih < 0 ? 'BB turun (T)' : 'BB tidak naik (T)', selisih, turun: selisih < 0 }
}
