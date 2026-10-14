import type { KategoriConfig } from '../lib/age'
import type { Pengaturan } from '../lib/db'

export type Sel = string | number | { teks: string; tebal?: boolean; kecil?: boolean }

export interface Kolom {
  judul: string
  /** lebar CSS, mis. "40%" atau "8mm" */
  lebar?: string
  rata?: 'kiri' | 'tengah'
  /** judul kelompok di atas beberapa kolom berurutan (mis. KUNJUNGAN) */
  kelompok?: string
}

export type Baris = Sel[] | { grup: string }

export interface Bagian {
  judul?: string
  kolom: Kolom[]
  baris: Baris[]
  /** isi baris kosong sampai jumlah ini, seperti kertas template */
  minBaris?: number
  /** font tabel lebih kecil untuk tabel lebar */
  rapat?: boolean
}

export interface HasilLaporan {
  /** baris kop. Baris pertama dicetak paling besar. */
  kop: string[]
  gayaKop?: 'tengah' | 'garis'
  judul?: string
  metaKiri?: Array<[string, string]>
  metaKanan?: Array<[string, string]>
  bagian: Bagian[]
  catatan?: string[]
  orientasi: 'portrait' | 'landscape'
}

export type NamaParam = 'rt' | 'tanggal' | 'tahun' | 'warga' | 'kegiatan' | 'jenisObat' | 'jenisIbu'

export interface ParamLaporan {
  tanggal: string
  tahun: number
  rt: string
  wargaId?: number
  kegiatanId?: number
  jenisObat: string
  jenisIbu: 'hamil' | 'menyusui' | 'keduanya'
  ttd: boolean
}

export interface KonteksLaporan {
  pengaturan: Pengaturan
  kategori: KategoriConfig[]
}

export interface DefinisiLaporan {
  kode: string
  nama: string
  deskripsi: string
  param: NamaParam[]
  bangun: (p: ParamLaporan, k: KonteksLaporan) => Promise<HasilLaporan[]>
}
