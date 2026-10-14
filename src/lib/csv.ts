import { parseTanggalBebas } from './age'
import type { Warga } from './db'

/** Parser CSV sederhana: mendukung tanda kutip, pemisah koma atau titik koma. */
export function parseCSV(teks: string): string[][] {
  const t = teks.replace(/^﻿/, '')
  const sep = (t.split('\n')[0].match(/;/g)?.length ?? 0) > (t.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export const CONTOH_CSV =
  'nama,nik,no_kk,tanggal_lahir,jenis_kelamin,rt,alamat,nama_ortu\n' +
  'Contoh Warga Satu,1801000000000001,1801000000000011,07-06-2014,L,22,Perum BW Blok A,Contoh Orang Tua\n' +
  'Contoh Warga Dua,,,14-01-1985,P,18,,\n'

export interface BarisImpor {
  baris: number
  data?: Omit<Warga, 'id' | 'dibuat' | 'diubah'>
  galat?: string
}

const ALIAS: Record<string, string> = {
  nama: 'nama',
  'nama lengkap': 'nama',
  nik: 'nik',
  no_kk: 'noKK',
  nokk: 'noKK',
  kk: 'noKK',
  'no kk': 'noKK',
  tanggal_lahir: 'tanggalLahir',
  'tanggal lahir': 'tanggalLahir',
  tgl_lahir: 'tanggalLahir',
  jenis_kelamin: 'jk',
  'jenis kelamin': 'jk',
  jk: 'jk',
  rt: 'rt',
  dusun: 'dusun',
  alamat: 'alamat',
  nama_ortu: 'namaOrtu',
  'nama ortu': 'namaOrtu',
  orang_tua: 'namaOrtu',
}

export function validasiNIK(nik: string): string | null {
  if (nik === '') return null
  return /^\d{16}$/.test(nik) ? null : 'NIK harus 16 digit angka.'
}

export function siapkanImpor(
  rows: string[][],
  rtValid: string[],
  nikAda: Set<string>,
): BarisImpor[] {
  if (rows.length < 2) return []
  const kolom = rows[0].map((h) => ALIAS[h.trim().toLowerCase()] ?? '')
  const lihat = new Set<string>()
  return rows.slice(1).map((r, i): BarisImpor => {
    const baris = i + 2
    const o: Record<string, string> = {}
    kolom.forEach((k, idx) => {
      if (k) o[k] = (r[idx] ?? '').trim()
    })
    if (!o.nama) return { baris, galat: 'Nama kosong.' }
    const lahir = parseTanggalBebas(o.tanggalLahir ?? '')
    if (!lahir) return { baris, galat: 'Tanggal lahir tidak valid (pakai dd-mm-yyyy).' }
    const jkRaw = (o.jk ?? '').toUpperCase()
    const jk = jkRaw.startsWith('L') ? 'L' : jkRaw.startsWith('P') ? 'P' : null
    if (!jk) return { baris, galat: 'Jenis kelamin harus L atau P.' }
    const rt = (o.rt ?? '').replace(/\D/g, '').replace(/^0+/, '')
    if (!rtValid.includes(rt)) return { baris, galat: `RT "${o.rt ?? ''}" tidak dikenal.` }
    const nik = (o.nik ?? '').replace(/\s/g, '')
    const gn = validasiNIK(nik)
    if (gn) return { baris, galat: gn }
    if (nik) {
      if (nikAda.has(nik) || lihat.has(nik)) return { baris, galat: 'NIK sudah terdaftar.' }
      lihat.add(nik)
    }
    return {
      baris,
      data: {
        nama: o.nama,
        nik,
        noKK: (o.noKK ?? '').replace(/\s/g, ''),
        tanggalLahir: lahir,
        jk,
        rt,
        dusun: o.dusun || 'Dusun 5',
        alamat: o.alamat ?? '',
        namaOrtu: o.namaOrtu ?? '',
        aktif: true,
      },
    }
  })
}

export function unduhTeks(nama: string, isi: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([isi], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}
