import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { db } from './db'
import { buatSinkron, type BarisTarik, type Remote, type Sinkron, type StatusSinkron } from './sync'

const KUNCI = 'posyandu.supabase'

export interface KonfigCloud {
  url: string
  key: string
}

export function getKonfig(): KonfigCloud | null {
  try {
    const t = localStorage.getItem(KUNCI)
    if (t) {
      const k = JSON.parse(t) as KonfigCloud
      if (k.url && k.key) return k
    }
  } catch {
    /* abaikan */
  }
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return url && key ? { url, key } : null
}

export function simpanKonfig(k: KonfigCloud | null): void {
  if (k) localStorage.setItem(KUNCI, JSON.stringify(k))
  else localStorage.removeItem(KUNCI)
}

export const adaCloud = () => getKonfig() !== null

let klien: SupabaseClient | null = null
export function getKlien(): SupabaseClient {
  if (!klien) {
    const k = getKonfig()
    if (!k) throw new Error('Server belum dikonfigurasi')
    klien = createClient(k.url, k.key, { auth: { persistSession: true, autoRefreshToken: true } })
  }
  return klien
}

function remoteSupabase(c: SupabaseClient): Remote {
  const galat = (e: { message: string; code?: string }) => Object.assign(new Error(e.message), { code: e.code })
  return {
    async dorong(rows) {
      const { error } = await c.from('records').upsert(rows, { onConflict: 'tbl,id' })
      if (error) throw galat(error)
    },
    async tarik(sejak, batas) {
      const { data, error } = await c.from('records').select('seq,tbl,id,data,deleted').gt('seq', sejak).order('seq').limit(batas)
      if (error) throw galat(error)
      return (data ?? []) as BarisTarik[]
    },
  }
}

const penyimpan = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* abaikan */
    }
  },
}

let sinkron: Sinkron | null = null
export function getSinkron(): Sinkron | null {
  if (!adaCloud()) return null
  if (!sinkron) sinkron = buatSinkron(db, remoteSupabase(getKlien()), penyimpan)
  return sinkron
}

/** Jalankan sinkron berkala. Kembalikan fungsi untuk menghentikan. */
export function mulaiSinkron(): () => void {
  const s = getSinkron()
  if (!s) return () => {}
  const jalan = () => void s.jalankan()
  jalan()
  // hemat kuota: hanya saat aplikasi terlihat
  const timer = window.setInterval(() => document.visibilityState === 'visible' && jalan(), 30000)
  const saatKembali = () => document.visibilityState === 'visible' && jalan()
  window.addEventListener('online', jalan)
  document.addEventListener('visibilitychange', saatKembali)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('online', jalan)
    document.removeEventListener('visibilitychange', saatKembali)
  }
}

export function useStatusSinkron(): StatusSinkron | null {
  const s = getSinkron()
  const [, paksa] = useState(0)
  useEffect(() => s?.berlangganan(() => paksa((n) => n + 1)), [s])
  return s ? { ...s.status } : null
}

export interface Profil {
  id: string
  username: string
  nama: string
  role: 'admin' | 'kader'
  aktif: boolean
}

const KUNCI_PROFIL = 'posyandu.profil'

/** Profil dari server; saat offline pakai salinan terakhir. */
export async function ambilProfil(uid: string): Promise<Profil | null> {
  try {
    const { data, error } = await getKlien().from('profiles').select('*').eq('id', uid).maybeSingle()
    if (error) throw error
    if (data) localStorage.setItem(KUNCI_PROFIL, JSON.stringify(data))
    return (data as Profil) ?? null
  } catch {
    try {
      const t = localStorage.getItem(KUNCI_PROFIL)
      const p = t ? (JSON.parse(t) as Profil) : null
      return p && p.id === uid ? p : null
    } catch {
      return null
    }
  }
}

export function hapusProfilCache() {
  try {
    localStorage.removeItem(KUNCI_PROFIL)
  } catch {
    /* abaikan */
  }
}

export function emailDariUsername(u: string): string {
  const t = u.trim()
  return t.includes('@') ? t : `${t.toLowerCase()}@posyandu.local`
}

/** Nama pengguna boleh huruf kecil, angka, titik, garis bawah, dan strip. */
export const POLA_USERNAME = /^[a-z0-9._-]{3,30}$/

/**
 * Buat akun kader. Memakai klien sementara agar sesi admin tidak tergeser.
 * Akun baru nonaktif dari server; admin langsung mengaktifkannya di sini.
 */
export async function buatAkunKader(nama: string, username: string, password: string, role: 'admin' | 'kader'): Promise<string | null> {
  const k = getKonfig()
  if (!k) return 'Server belum dikonfigurasi'
  const u = username.trim().toLowerCase()
  if (!POLA_USERNAME.test(u)) return 'Nama pengguna 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip.'
  if (password.length < 6) return 'Kata sandi minimal 6 karakter.'
  const sementara = createClient(k.url, k.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'posyandu.sementara' },
  })
  const { data, error } = await sementara.auth.signUp({ email: emailDariUsername(u), password, options: { data: { nama: nama.trim() } } })
  if (error) return /already|registered/i.test(error.message) ? 'Nama pengguna sudah dipakai.' : error.message
  const uid = data.user?.id
  if (!uid || data.user?.identities?.length === 0) return 'Nama pengguna sudah dipakai.'
  const { error: e2 } = await getKlien().from('profiles').update({ aktif: true, role, nama: nama.trim() }).eq('id', uid)
  if (e2) return `Akun dibuat tetapi belum bisa diaktifkan: ${e2.message}`
  if (!data.session) return 'Akun dibuat, tetapi server meminta konfirmasi email. Matikan "Confirm email" di Supabase lalu hapus akun itu dan buat ulang.'
  return null
}

/** Tautan sekali ketuk untuk menghubungkan HP kader. Hanya berisi alamat dan kunci publik. */
export function buatTautan(): string | null {
  const k = getKonfig()
  if (!k) return null
  const q = new URLSearchParams({ url: k.url, key: k.key })
  return `${location.origin}${location.pathname}#/sambung?${q}`
}

/** Dipanggil sebelum aplikasi tampil: terima konfigurasi dari tautan, dengan konfirmasi. */
export function terimaTautan(): void {
  const m = /^#\/sambung\?(.*)$/.exec(location.hash)
  if (!m) return
  const q = new URLSearchParams(m[1])
  const url = (q.get('url') ?? '').replace(/\/$/, '')
  const key = q.get('key') ?? ''
  location.hash = '#/'
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || key.length < 20) return
  if (getKonfig()?.url === url) return
  // Tautan palsu bisa mengarahkan login ke server orang lain, jadi tampilkan tujuannya.
  const host = new URL(url).host
  if (window.confirm(`Hubungkan aplikasi ke server ${host}?\n\nHanya lanjutkan jika tautan ini dari admin Posyandu Anda.`)) {
    simpanKonfig({ url, key })
  }
}
