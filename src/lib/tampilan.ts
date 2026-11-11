import type { StatusSinkron } from './sync'

export function salam(): string {
  const j = new Date().getHours()
  return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam'
}

/** Ringkasan status sinkron untuk ditampilkan dengan kata, bukan hanya warna. */
export function teksSinkron(s: StatusSinkron | null): { judul: string; sub: string; warna: 'hijau' | 'kuning' | 'merah' } {
  if (!s) return { judul: 'Tersimpan di perangkat', sub: 'Belum terhubung ke server', warna: 'kuning' }
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const jam = s.terakhir ? `Terakhir pukul ${new Date(s.terakhir).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Belum pernah sinkron'
  if (s.berjalan) return { judul: 'Menyinkron…', sub: jam, warna: 'kuning' }
  if (offline) return { judul: 'Offline', sub: s.tunggu ? `${s.tunggu} perubahan menunggu` : jam, warna: 'merah' }
  if (s.galat) return { judul: 'Gagal sinkron', sub: s.galat, warna: 'merah' }
  if (s.tunggu) return { judul: `${s.tunggu} menunggu`, sub: jam, warna: 'kuning' }
  return { judul: 'Tersinkron', sub: jam, warna: 'hijau' }
}

const BULAN_PENDEK = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
export const bulanPendek = (iso: string) => BULAN_PENDEK[Number(iso.slice(5, 7)) - 1] ?? ''
