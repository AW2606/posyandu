// Semua tanggal disimpan sebagai string ISO "YYYY-MM-DD".

export interface KategoriConfig {
  kode: string
  nama: string
  /** umur minimum (tahun, inklusif) */
  umurMin: number
  /** umur maksimum (tahun, eksklusif); null = tanpa batas */
  umurMax: number | null
  urutan: number
}

/** [KONFIRMASI] Batas ini disimpan di database dan bisa diubah Admin. */
export const KATEGORI_DEFAULT: KategoriConfig[] = [
  { kode: 'balita', nama: 'Balita', umurMin: 0, umurMax: 6, urutan: 1 },
  { kode: 'sekolah', nama: 'Usia Sekolah', umurMin: 6, umurMax: 15, urutan: 2 },
  { kode: 'remaja', nama: 'Remaja', umurMin: 15, umurMax: 18, urutan: 3 },
  { kode: 'dewasa', nama: 'Dewasa', umurMin: 18, umurMax: 60, urutan: 4 },
  { kode: 'lansia', nama: 'Lansia', umurMin: 60, umurMax: null, urutan: 5 },
]

export function parseISO(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function toISO(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
}

export function todayISO(): string {
  const n = new Date()
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate())
}

/** Umur dalam bulan penuh pada tanggal `ref`. */
export function umurBulan(lahir: string, ref: string): number {
  const a = parseISO(lahir)
  const b = parseISO(ref)
  let bulan = (b.y - a.y) * 12 + (b.m - a.m)
  if (b.d < a.d) bulan -= 1
  return Math.max(0, bulan)
}

/** Umur dalam tahun penuh pada tanggal `ref`. */
export function umurTahun(lahir: string, ref: string): number {
  return Math.floor(umurBulan(lahir, ref) / 12)
}

/** "3 th 2 bln" untuk anak kecil, "45 th" untuk yang lebih besar. */
export function formatUmur(lahir: string, ref: string): string {
  const bln = umurBulan(lahir, ref)
  const th = Math.floor(bln / 12)
  if (th >= 5) return `${th} th`
  const sisa = bln % 12
  if (th === 0) return `${sisa} bln`
  return sisa ? `${th} th ${sisa} bln` : `${th} th`
}

/** Kategori dihitung dari tanggal lahir terhadap tanggal acuan (bukan hari ini). */
export function kategoriDari(
  lahir: string,
  ref: string,
  config: KategoriConfig[],
): KategoriConfig | undefined {
  const th = umurTahun(lahir, ref)
  return [...config]
    .sort((a, b) => a.urutan - b.urutan)
    .find((k) => th >= k.umurMin && (k.umurMax === null || th < k.umurMax))
}

/** "2014-06-07" -> "07-06-2014" (format di template). */
export function tglId(iso: string | undefined, sep = '-'): string {
  if (!iso) return ''
  const { y, m, d } = parseISO(iso)
  return [d.toString().padStart(2, '0'), m.toString().padStart(2, '0'), y].join(sep)
}

/** Terima dd-mm-yyyy, dd/mm/yyyy, atau yyyy-mm-dd. Kembalikan ISO atau null. */
export function parseTanggalBebas(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t)
  let y: number
  let mo: number
  let d: number
  if (m) {
    y = Number(m[1])
    mo = Number(m[2])
    d = Number(m[3])
  } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t)
    if (!m) return null
    d = Number(m[1])
    mo = Number(m[2])
    y = Number(m[3])
  }
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return toISO(y, mo, d)
}

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function tglPanjang(iso: string): string {
  const { y, m, d } = parseISO(iso)
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`
}

export function tambahHari(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function selisihHari(a: string, b: string): number {
  const x = parseISO(a)
  const y = parseISO(b)
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86400000)
}

/** Usia kehamilan "12 mgg 3 hr" dari HPHT. */
export function usiaHamil(hpht: string, ref: string): string {
  const h = Math.max(0, selisihHari(hpht, ref))
  return `${Math.floor(h / 7)} mgg ${h % 7} hr`
}

/** Hari perkiraan lahir (rumus Naegele: HPHT + 280 hari). */
export function perkiraanLahir(hpht: string): string {
  return tambahHari(hpht, 280)
}
