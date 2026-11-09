// Batas sesi: keluar otomatis bila tidak ada aktivitas selama BATAS_IDLE_MS.
// Waktu aktivitas terakhir disimpan di localStorage supaya berlaku juga setelah tab ditutup
// dan sama di semua tab yang terbuka.

export const BATAS_IDLE_MS = 30 * 60 * 1000
const KUNCI_AKTIVITAS = 'posyandu.aktivitas'
const KUNCI_ALASAN = 'posyandu.alasanKeluar'

/** Sesi dianggap habis bila belum pernah tercatat aktivitas atau jedanya sudah melewati batas. */
export function sesiKedaluwarsa(terakhir: number | null, sekarang: number, batas = BATAS_IDLE_MS): boolean {
  if (terakhir === null || !Number.isFinite(terakhir)) return true
  return sekarang - terakhir >= batas
}

export function bacaAktivitas(): number | null {
  try {
    const v = localStorage.getItem(KUNCI_AKTIVITAS)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

export function catatAktivitas(waktu = Date.now()): void {
  try {
    localStorage.setItem(KUNCI_AKTIVITAS, String(waktu))
  } catch {
    /* penyimpanan diblokir: abaikan */
  }
}

export function hapusAktivitas(): void {
  try {
    localStorage.removeItem(KUNCI_AKTIVITAS)
  } catch {
    /* abaikan */
  }
}

/** Pesan untuk halaman masuk setelah keluar otomatis. */
export function setAlasanKeluar(pesan: string): void {
  try {
    sessionStorage.setItem(KUNCI_ALASAN, pesan)
  } catch {
    /* abaikan */
  }
}

export function bacaAlasanKeluar(): string | null {
  try {
    return sessionStorage.getItem(KUNCI_ALASAN)
  } catch {
    return null
  }
}

export function hapusAlasanKeluar(): void {
  try {
    sessionStorage.removeItem(KUNCI_ALASAN)
  } catch {
    /* abaikan */
  }
}
