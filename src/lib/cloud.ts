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
  const timer = window.setInterval(jalan, 20000)
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
