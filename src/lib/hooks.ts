import { useLiveQuery } from 'dexie-react-hooks'
import { KATEGORI_DEFAULT, kategoriDari, toISO, todayISO, type KategoriConfig } from './age'
import { db, PENGATURAN_DEFAULT, type Kegiatan, type Pengaturan, type Warga } from './db'
import { AMBANG_DEFAULT } from './health'

export function usePengaturan(): Pengaturan {
  const p = useLiveQuery(async () => {
    const row = await db.kv.get('pengaturan')
    return row?.value as Pengaturan | undefined
  })
  return p ? { ...PENGATURAN_DEFAULT, ...p, ambang: { ...AMBANG_DEFAULT, ...p.ambang } } : PENGATURAN_DEFAULT
}

export function useKategori(): KategoriConfig[] {
  const k = useLiveQuery(() => db.kategori.toArray())
  return k && k.length ? k : KATEGORI_DEFAULT
}

export function useKategoriMap() {
  const k = useKategori()
  return Object.fromEntries(k.map((x) => [x.kode, x])) as Record<string, KategoriConfig>
}

export function kodeKategori(w: Warga, ref: string, k: KategoriConfig[]): string {
  return kategoriDari(w.tanggalLahir, ref, k)?.kode ?? '-'
}

/** Kegiatan terdekat: yang paling dekat dengan hari ini (utamakan yang belum lewat). */
export function pilihKegiatanAktif(list: Kegiatan[]): Kegiatan | undefined {
  if (!list.length) return undefined
  const t = todayISO()
  const urut = [...list].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  return urut.find((k) => k.tanggal >= t) ?? urut[urut.length - 1]
}

export function useKegiatanList(): Kegiatan[] {
  return useLiveQuery(() => db.kegiatan.orderBy('tanggal').reverse().toArray()) ?? []
}

/** Tanggal kegiatan rutin untuk bulan tertentu, sesuai pengaturan. */
export function tanggalRutin(tahun: number, bulan: number, hari: number): string {
  const akhir = new Date(tahun, bulan, 0).getDate()
  return toISO(tahun, bulan, Math.min(hari, akhir))
}

export const KODE_TAHAP_WARNA: Record<string, string> = {
  terdaftar: 'abu',
  terukur: 'biru',
  tercatat: 'kuning',
  dilayani: 'hijau',
}
