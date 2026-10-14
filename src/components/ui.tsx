import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const PATH: Record<string, string> = {
  beranda: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  layanan: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  warga: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  laporan: 'M7 3h8l5 5v13H7zM14 3v6h6M10 13h7M10 17h7',
  lainnya: 'M4 6h16M4 12h16M4 18h16',
  cari: 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14',
  tambah: 'M12 5v14M5 12h14',
  cetak: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  panah: 'M9 6l6 6-6 6',
  logo: 'M12 21V10m0 0c0-4 3-6 7-6 0 4-3 6-7 6zm0 3c0-3.5-2.5-5-6-5 0 3.5 2.5 5 6 5z',
}

export function Ikon({ nama, ukuran = 24 }: { nama: keyof typeof PATH | string; ukuran?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATH[nama]} />
    </svg>
  )
}

export function Chip({ warna = 'abu', children }: { warna?: 'abu' | 'hijau' | 'biru' | 'kuning' | 'merah'; children: ReactNode }) {
  return <span className={`chip ${warna}`}>{children}</span>
}

export function Field({
  label,
  galat,
  petunjuk,
  children,
}: {
  label: string
  galat?: string | null
  petunjuk?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {galat ? <span className="pesan-salah">{galat}</span> : petunjuk ? <span className="petunjuk">{petunjuk}</span> : null}
    </div>
  )
}

export function Sheet({ judul, onTutup, children }: { judul: string; onTutup: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onTutup])
  return (
    <div className="latar" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div className="sheet" role="dialog" aria-modal aria-label={judul}>
        <div className="sheet-kepala">
          <h3>{judul}</h3>
          <button className="tutup" onClick={onTutup} aria-label="Tutup">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Kosong({ judul, teks, children }: { judul: string; teks?: string; children?: ReactNode }) {
  return (
    <div className="kosong-state">
      <h3>{judul}</h3>
      {teks && <p>{teks}</p>}
      {children}
    </div>
  )
}

export function Konfirmasi({
  judul,
  teks,
  labelYa = 'Ya, lanjutkan',
  bahaya,
  onYa,
  onBatal,
}: {
  judul: string
  teks: string
  labelYa?: string
  bahaya?: boolean
  onYa: () => void
  onBatal: () => void
}) {
  return (
    <Sheet judul={judul} onTutup={onBatal}>
      <p>{teks}</p>
      <div className="aksi-bawah">
        <button className="btn" onClick={onBatal}>
          Batal
        </button>
        <button className={`btn ${bahaya ? 'bahaya' : 'utama'}`} onClick={onYa}>
          {labelYa}
        </button>
      </div>
    </Sheet>
  )
}

const ToastCtx = createContext<(t: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [teks, setTeks] = useState<string | null>(null)
  const tampil = useCallback((t: string) => {
    setTeks(t)
    window.setTimeout(() => setTeks(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={tampil}>
      {children}
      {teks && <div className="toast" role="status">{teks}</div>}
    </ToastCtx.Provider>
  )
}

export function inisial(nama: string): string {
  const p = nama.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

export function Bar({ label, nilai, maks }: { label: string; nilai: number; maks: number }) {
  return (
    <div className="bar-baris">
      <span>{label}</span>
      <div className="bar">
        <i style={{ width: `${maks ? (nilai / maks) * 100 : 0}%` }} />
      </div>
      <b>{nilai}</b>
    </div>
  )
}

/** Grafik garis sederhana (SVG) untuk riwayat BB / TB. */
export function GrafikGaris({ titik, satuan }: { titik: Array<{ x: string; y: number }>; satuan: string }) {
  if (titik.length < 2) return <p className="petunjuk">Grafik muncul setelah minimal 2 kunjungan.</p>
  const W = 320
  const H = 140
  const pad = 28
  const ys = titik.map((t) => t.y)
  const min = Math.min(...ys)
  const maks = Math.max(...ys)
  const rentang = maks - min || 1
  const px = (i: number) => pad + (i * (W - pad * 2)) / (titik.length - 1)
  const py = (y: number) => H - pad - ((y - min) / rentang) * (H - pad * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Grafik ${satuan}`}>
      <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" points={titik.map((t, i) => `${px(i)},${py(t.y)}`).join(' ')} />
      {titik.map((t, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(t.y)} r="4" fill="#0f766e" />
          <text x={px(i)} y={py(t.y) - 8} fontSize="10" textAnchor="middle" fill="#1c2b29">
            {t.y}
          </text>
          <text x={px(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#5b6e6b">
            {t.x}
          </text>
        </g>
      ))}
    </svg>
  )
}
