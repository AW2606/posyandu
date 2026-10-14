import Dexie, { type Table } from 'dexie'
import { KATEGORI_DEFAULT, type KategoriConfig } from './age'
import { AMBANG_DEFAULT, type Ambang, type JK } from './health'

export type Role = 'admin' | 'kader'

export interface User {
  id?: number
  nama: string
  username: string
  salt: string
  hash: string
  role: Role
  aktif: boolean
}

export interface Warga {
  id?: number
  nama: string
  nik: string // boleh kosong (belum punya NIK); jika terisi harus 16 digit
  noKK: string
  tanggalLahir: string // ISO
  jk: JK
  rt: string // "18" | "20" | "22" | "24"
  dusun: string
  alamat: string
  namaOrtu: string
  aktif: boolean
  dibuat: number
  diubah: number
}

export interface Kegiatan {
  id?: number
  tanggal: string // ISO
  lokasi: string
  keterangan: string
}

export type Tahap = 'terdaftar' | 'terukur' | 'tercatat' | 'dilayani'
export const URUTAN_TAHAP: Tahap[] = ['terdaftar', 'terukur', 'tercatat', 'dilayani']
export const NAMA_TAHAP: Record<Tahap, string> = {
  terdaftar: 'Terdaftar',
  terukur: 'Terukur',
  tercatat: 'Tercatat',
  dilayani: 'Dilayani',
}

export interface Kunjungan {
  id?: number
  kegiatanId: number
  wargaId: number
  noAntrean: number
  hadir: boolean
  tahap: Tahap
  penyuluhan: string
  rujukan: string
}

export interface Pemeriksaan {
  id?: number
  kunjunganId: number
  kegiatanId: number
  wargaId: number
  tanggal: string // tanggal kegiatan, disalin agar riwayat cepat
  bb?: number
  tb?: number
  lila?: number
  lingkarPerut?: number
  sistol?: number
  diastol?: number
  gulaDarah?: number
  kolesterol?: number
  asamUrat?: number
  catatan: string
}

export type JenisStatus = 'hamil' | 'menyusui'
export interface StatusKhusus {
  id?: number
  wargaId: number
  jenis: JenisStatus
  mulai: string
  selesai?: string
}

export interface LayananObat {
  id?: number
  kegiatanId: number
  wargaId: number
  jenis: string // "Obat Cacing" | "Vitamin A" | ...
  keterangan: string // "Diterima langsung" | "Dititipkan" | "Merah" | "Biru"
}

export interface Imunisasi {
  id?: number
  wargaId: number
  jenis: string
  tanggal: string
}

export interface Kehamilan {
  id?: number
  wargaId: number
  hpht: string // hari pertama haid terakhir
  catatan: string
  /** persalinan; kosong selama masih hamil */
  tanggalLahir?: string
  tempat?: string
  diFaskes?: boolean
}

export interface AuditLog {
  id?: number
  waktu: number
  user: string
  aksi: string
  entitas: string
  detail: string
}

export interface Pengaturan {
  namaPosyandu: string
  dusun: string
  desa: string
  kecamatan: string
  alamatKop: string
  puskesmas: string
  rtDaftar: string[]
  tanggalKegiatan: number
  ketua: string
  kader: string
  bidan: string
  jenisObat: string[]
  imunisasiDasar: string[]
  ambang: Ambang
}

export const PENGATURAN_DEFAULT: Pengaturan = {
  namaPosyandu: 'POSYANDU BANGAU',
  dusun: 'DUSUN 5',
  desa: 'WAY HUWI',
  kecamatan: 'JATI AGUNG LAM – SEL',
  alamatKop: 'PERUM. BW Dusun 5 RT.22 Desa Way Huwi\nKec.Jati Agung Lam-Sel',
  puskesmas: 'KARANG ANYAR',
  rtDaftar: ['18', '20', '22', '24'],
  tanggalKegiatan: 15,
  ketua: '',
  kader: '',
  bidan: '',
  jenisObat: ['Obat Cacing', 'Vitamin A'],
  // [KONFIRMASI] sesuaikan dengan buku KIA
  imunisasiDasar: ['HB-0', 'BCG', 'Polio 1', 'DPT-HB-Hib 1', 'Polio 2', 'DPT-HB-Hib 2', 'Polio 3', 'DPT-HB-Hib 3', 'Polio 4', 'IPV', 'Campak-Rubella'],
  ambang: AMBANG_DEFAULT,
}

export interface Outbox {
  k: string // "tabel:id"
  tbl: string
  id: string
  v: number
}

/** Tabel bernomor id otomatis. Id dibuat unik lintas perangkat agar bisa disinkronkan. */
const TABEL_ID_NUMERIK = ['warga', 'kegiatan', 'kunjungan', 'pemeriksaan', 'statusKhusus', 'layananObat', 'imunisasi', 'kehamilan', 'audit', 'users'] as const

let urutId = Math.floor(Math.random() * 1000)
/** Maksimal ~1.8e15, masih di bawah batas bilangan bulat aman JavaScript (9e15). */
export function idBaru(): number {
  urutId = (urutId + 1) % 1000
  return Date.now() * 1000 + urutId
}

export class PosyanduDB extends Dexie {
  users!: Table<User, number>
  warga!: Table<Warga, number>
  kegiatan!: Table<Kegiatan, number>
  kunjungan!: Table<Kunjungan, number>
  pemeriksaan!: Table<Pemeriksaan, number>
  statusKhusus!: Table<StatusKhusus, number>
  layananObat!: Table<LayananObat, number>
  imunisasi!: Table<Imunisasi, number>
  kehamilan!: Table<Kehamilan, number>
  kategori!: Table<KategoriConfig, string>
  kv!: Table<{ key: string; value: unknown }, string>
  audit!: Table<AuditLog, number>
  outbox!: Table<Outbox, string>

  constructor(nama = 'posyandu-bangau') {
    super(nama)
    this.version(1).stores({
      users: '++id,&username',
      warga: '++id,nik,nama,rt,tanggalLahir,aktif',
      kegiatan: '++id,tanggal',
      kunjungan: '++id,kegiatanId,wargaId,&[kegiatanId+wargaId]',
      pemeriksaan: '++id,&kunjunganId,wargaId,kegiatanId,tanggal',
      statusKhusus: '++id,wargaId,jenis',
      layananObat: '++id,kegiatanId,wargaId,jenis',
      kategori: 'kode',
      kv: 'key',
      audit: '++id,waktu',
    })
    this.version(2).stores({
      imunisasi: '++id,wargaId,&[wargaId+jenis]',
      kehamilan: '++id,wargaId',
    })
    this.version(3).stores({ outbox: '&k' })
    for (const t of TABEL_ID_NUMERIK) {
      this.table(t).hook('creating', (_pk, obj) => (obj.id === undefined ? idBaru() : undefined))
    }
  }
}

export const db = new PosyanduDB()

export async function getPengaturan(): Promise<Pengaturan> {
  const row = await db.kv.get('pengaturan')
  const v = (row?.value ?? {}) as Partial<Pengaturan>
  return { ...PENGATURAN_DEFAULT, ...v, ambang: { ...AMBANG_DEFAULT, ...(v.ambang ?? {}) } }
}

export async function simpanPengaturan(p: Pengaturan): Promise<void> {
  await db.kv.put({ key: 'pengaturan', value: p })
}

export async function getKategori(): Promise<KategoriConfig[]> {
  const rows = await db.kategori.toArray()
  return rows.length ? rows : KATEGORI_DEFAULT
}

let user = ''
export function setAuditUser(u: string) {
  user = u
}
export async function catat(aksi: string, entitas: string, detail: string): Promise<void> {
  await db.audit.add({ waktu: Date.now(), user, aksi, entitas, detail })
}

/** Pastikan master data dasar dan akun awal tersedia. */
export async function inisialisasi(opsi: { isiBawaan: boolean } = { isiBawaan: true }): Promise<void> {
  // Mode cloud: jangan menulis bawaan, nanti ikut tersinkron dan bisa menimpa pengaturan admin.
  // Pembacaan sudah punya nilai bawaan sendiri.
  if (!opsi.isiBawaan) return
  if ((await db.kategori.count()) === 0) await db.kategori.bulkPut(KATEGORI_DEFAULT)
  if (!(await db.kv.get('pengaturan'))) await simpanPengaturan(PENGATURAN_DEFAULT)
}

export async function eksporSemua(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of db.tables) data[t.name] = await t.toArray()
  return JSON.stringify({ app: 'posyandu-bangau', versi: 1, waktu: new Date().toISOString(), data })
}

export async function impor(json: string): Promise<void> {
  const obj = JSON.parse(json)
  if (obj?.app !== 'posyandu-bangau' || !obj.data) throw new Error('Berkas bukan cadangan Posyandu Bangau.')
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear()
      const rows = obj.data[t.name]
      if (Array.isArray(rows) && rows.length) await t.bulkAdd(rows)
    }
  })
}

export function rtLabel(rt: string): string {
  return `RT ${rt}`
}
