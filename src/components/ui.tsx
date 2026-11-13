import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const PATH: Record<string, string> = {
  beranda: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  layanan: 'M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M9 14l2 2 4-4',
  warga: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1.5a4 4 0 0 0-3-3.85M15.5 4.1a3.5 3.5 0 0 1 0 6.8',
  laporan: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  lainnya: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4M4 12h2M10 12h10M8 10v4',
  cari: 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14',
  tambah: 'M12 5v14M5 12h14',
  cetak: 'M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  panah: 'M9 6l6 6-6 6',
  kiri: 'M19 12H5M11 18l-6-6 6-6',
  kanan: 'M5 12h14M13 6l6 6-6 6',
  serong: 'M7 17 17 7M8 7h9v9',
  bawah: 'M6 9l6 6 6-6',
  awan: 'M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 0 0 4.5 13 3.5 3.5 0 0 0 6.5 19z',
  keluar: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10',
  lonceng: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  jam: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  penggaris: 'M14.5 3.5l6 6-11 11-6-6zM8 10l2 2M11 7l2 2M5 13l2 2',
  peringatan: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  hati: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
  kalender: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1',
  lokasi: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  timbangan: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M8 9a4 4 0 0 1 8 0M12 9l1.5-2',
  grafik: 'M4 4v16h16M8 16v-4M12 16V8M16 16v-6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16v-4M12 8h.01',
  centang: 'M20 6 9 17l-5-5',
  kunci: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1M8 11V7a4 4 0 1 1 8 0v4',
  orang: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  mata: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  pensil: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  arsip: 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
  riwayat: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  unduh: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  unggah: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  saring: 'M4 6h16M7 12h10M10 18h4',
  bayi: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0M12 3c-1.5 1.5-1.5 3 0 4',
  basisdata: 'M12 8c4.42 0 8-1.34 8-3s-3.58-3-8-3-8 1.34-8 3 3.58 3 8 3M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
  tautan: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ulang: 'M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5',
  suntik: 'M18 2l4 4M17 7l3-3M19 9 8.7 19.3a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 0 1 0-1.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6',
  tutup: 'M18 6 6 18M6 6l12 12',
  rumah: 'M3 10.5 12 3l9 7.5M5 9v11h14V9',
  kamera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  logo: 'M12 21V10m0 0c0-4 3-6 7-6 0 4-3 6-7 6zm0 3c0-3.5-2.5-5-6-5 0 3.5 2.5 5 6 5z',
}

export function Ikon({ nama, ukuran = 24, tebal = 2 }: { nama: keyof typeof PATH | string; ukuran?: number; tebal?: number }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tebal} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATH[nama]} />
    </svg>
  )
}

/** Logo Posyandu Bangau: bangau garis di atas petak kunyit. */
export function Logo({ ukuran = 46 }: { ukuran?: number }) {
  return (
    <svg className="logo-bangau" width={ukuran} height={ukuran} viewBox="0 0 56 56" fill="none" aria-hidden>
      <rect width="56" height="56" rx="16" fill="#F2B33D" />
      <g stroke="#0F3D33" strokeWidth="2.52" strokeLinecap="round" strokeLinejoin="round">
        <path transform="translate(6.55 7.91)" d="M23.8 18.94C29.51 17.04 36.18 18.94 41.89 26.56M0 6.57L11.9 3C12.14 .85 13.81-.34 15.47 0C17.14.38 17.9 1.81 17.52 3.52C17.33 5.61 18.38 7.52 19.71 9.71C21.42 12.52 21.18 14.66 22.85 15.85C26.66 14.18 32.37 14.42 37.13 17.28C40.94 19.89 43.32 24.65 45.7 32.27C40.94 30.6 36.65 30.37 32.37 30.6C27.61 30.84 22.85 29.41 19.99 26.56C17.85 24.42 17.42 21.8 17.85 19.42C18.19 17.04 16.9 14.18 15.33 11.56C14 9.33 13.23 7.28 13.33 5.38L0 6.57Z" />
        <path transform="translate(30.83 38.28)" d="M3.81 0L2.85 17.61M2.85 17.61L0 18.32M2.85 17.61L5.71 18.32M7.14 0L9.99 8.09L4.76 9.99" />
      </g>
    </svg>
  )
}

export function Merek({ terang = true }: { terang?: boolean }) {
  return (
    <span className={`merek ${terang ? 'terang' : ''}`}>
      <Logo />
      <span>
        <small>POSYANDU</small>
        <b>Bangau</b>
      </span>
    </span>
  )
}

/** Maskot bangau gaya garis. Warna badan mengikuti `currentColor`, kaki kunyit. */
export function Bangau({ className, kaki = '#F2B33D' }: { className?: string; kaki?: string }) {
  return (
    <svg className={className} viewBox="0 0 235.2 256.9" fill="none" aria-hidden>
      <path transform="translate(12 15.84)" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M110 87.56C136.4 78.76 167.2 87.56 193.6 122.76M0 30.36L55 13.86C56.1 3.96 63.8-1.54 71.5 0C79.2 1.76 82.72 8.36 80.96 16.28C80.08 25.96 84.92 34.76 91.08 44.88C99 57.86 97.9 67.76 105.6 73.26C123.2 65.56 149.6 66.66 171.6 79.86C189.2 91.96 200.2 113.96 211.2 149.16C189.2 141.46 169.4 140.36 149.6 141.46C127.6 142.56 105.6 135.96 92.4 122.76C82.5 112.86 80.52 100.76 82.5 89.76C84.04 78.76 78.1 65.56 70.84 53.46C64.68 43.12 61.16 33.66 61.6 24.86L0 30.36Z" />
      <path transform="translate(124.2 156.2)" stroke={kaki} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M17.6 0L13.2 81.4M13.2 81.4L0 84.7M13.2 81.4L26.4 84.7M33 0L46.2 37.4L22 46.2" />
      <circle cx="83.28" cy="24.64" r="3.08" fill="currentColor" />
    </svg>
  )
}

/** Tangkai daun, aksen di kepala halaman. */
export function Daun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 125.1 180" fill="currentColor" aria-hidden>
      <path d="M93.6 99C90 113.4 75.6 131.4 43.2 135C46.8 117 64.8 99 93.6 99ZM0 99C3.6 113.4 14.4 127.8 43.2 135C41.4 117 25.2 100.8 0 99ZM105.41 54C101.81 68.4 87.41 86.4 55.01 90C58.61 72 76.61 54 105.41 54ZM11.81 54C15.41 68.4 26.21 82.8 55.01 90C53.21 72 37.01 55.8 11.81 54ZM125.1 9C121.5 23.4 107.1 41.4 74.7 45C78.3 27 96.3 9 125.1 9ZM31.5 9C35.1 23.4 45.9 37.8 74.7 45C72.9 27 56.7 10.8 31.5 9Z" />
    </svg>
  )
}

/** Kepala halaman hijau berpola kawung. */
export function KepalaHalaman({
  label,
  judul,
  sub,
  kembali,
  children,
}: {
  label?: string
  judul: ReactNode
  sub?: ReactNode
  kembali?: { to: string; label: string } | { onClick: () => void; label: string }
  children?: ReactNode
}) {
  return (
    <header className="kepala no-print">
      <Daun className="kepala-daun" />
      <div className="kepala-isi">
        {kembali &&
          ('to' in kembali ? (
            <Link className="pil-kembali" to={kembali.to}><Ikon nama="kiri" ukuran={16} /> {kembali.label}</Link>
          ) : (
            <button type="button" className="pil-kembali" onClick={kembali.onClick}><Ikon nama="kiri" ukuran={16} /> {kembali.label}</button>
          ))}
        {label && <p className="kepala-label">{label}</p>}
        <h2>{judul}</h2>
        {sub && <p className="kepala-sub">{sub}</p>}
      </div>
      {children && <div className="kepala-aksi">{children}</div>}
    </header>
  )
}

/** Judul kartu dengan petak ikon berwarna. */
export function JudulKartu({ ikon, warna = 'mint', children, ekor }: { ikon: string; warna?: Warna; children: ReactNode; ekor?: ReactNode }) {
  return (
    <div className="judul-kartu">
      <span className={`petak-ikon ${warna}`}><Ikon nama={ikon} ukuran={20} /></span>
      <h3>{children}</h3>
      {ekor}
    </div>
  )
}

export type Warna = 'abu' | 'hijau' | 'biru' | 'kuning' | 'merah' | 'ungu' | 'koral' | 'mint' | 'krem'

export function Chip({ warna = 'abu', titik, children }: { warna?: Warna; titik?: boolean; children: ReactNode }) {
  return <span className={`chip ${warna} ${titik ? 'titik' : ''}`}>{children}</span>
}

/** Warna tetap per kategori sasaran (kode bawaan), selain itu bergiliran. */
const WARNA_KAT: Record<string, Warna> = { balita: 'kuning', sekolah: 'biru', remaja: 'ungu', dewasa: 'mint', lansia: 'koral' }
const GILIR: Warna[] = ['kuning', 'biru', 'ungu', 'mint', 'koral', 'hijau']
export const warnaKategori = (kode?: string, i = 0): Warna => (kode && WARNA_KAT[kode]) || GILIR[i % GILIR.length]
/** Warna isi (grafik) per kategori. */
const HEX_KAT: Record<string, string> = { balita: '#F2B33D', sekolah: '#3B82A8', remaja: '#8C6BC2', dewasa: '#2E8B6A', lansia: '#E46F4C' }
export const PALET = ['#2E8B6A', '#F2B33D', '#E46F4C', '#3B82A8', '#8C6BC2', '#94600A', '#174F42']
export const hexKategori = (kode: string, i = 0) => HEX_KAT[kode] ?? PALET[i % PALET.length]

export function ChipKategori({ kode, nama }: { kode?: string; nama?: string }) {
  if (!nama) return null
  return <Chip warna={warnaKategori(kode)}>{nama}</Chip>
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
      {galat ? (
        <span className="pesan-salah"><Ikon nama="peringatan" ukuran={15} /> {galat}</span>
      ) : petunjuk ? (
        <span className="petunjuk">{petunjuk}</span>
      ) : null}
    </div>
  )
}

export function Sheet({
  judul,
  sub,
  ikon,
  onTutup,
  children,
  lebar,
}: {
  judul: string
  sub?: string
  ikon?: string
  onTutup: () => void
  children: ReactNode
  lebar?: boolean
}) {
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
      <div className={`sheet ${lebar ? 'lebar' : ''}`} role="dialog" aria-modal aria-label={judul}>
        <div className="sheet-kepala">
          {ikon && <span className="sheet-ikon"><Ikon nama={ikon} ukuran={22} /></span>}
          <div className="sheet-judul">
            <h3>{judul}</h3>
            {sub && <p>{sub}</p>}
          </div>
          <button className="tutup" onClick={onTutup} aria-label="Tutup">
            <Ikon nama="tutup" ukuran={18} />
          </button>
        </div>
        <div className="sheet-isi">{children}</div>
      </div>
    </div>
  )
}

export function Kosong({ judul, teks, children }: { judul: string; teks?: string; children?: ReactNode }) {
  return (
    <div className="kosong-state">
      <Bangau className="kosong-bangau" kaki="#F2B33D" />
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
    <Sheet judul={judul} ikon={bahaya ? 'peringatan' : 'info'} onTutup={onBatal}>
      <p style={{ marginTop: 0 }}>{teks}</p>
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
  const p = nama.replace(/^(hj|h|dr|bu|pak)\.?\s+/i, '').trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

/** Avatar akun: foto profil bila ada, selain itu inisial nama. `className` memakai gaya avatar yang sudah ada. */
export function AvatarAkun({ nama, foto, className }: { nama: string; foto?: string | null; className: string }) {
  return (
    <span className={`${className} ${foto ? 'berfoto' : ''}`} aria-hidden>
      {foto ? <img src={foto} alt="" /> : inisial(nama)}
    </span>
  )
}

/** Angka yang menghitung naik dari 0 (halus, via requestAnimationFrame). */
export function Angka({ nilai, durasi = 800 }: { nilai: number; durasi?: number }) {
  const [tampil, setTampil] = useState(0)
  const terakhir = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      terakhir.current = nilai
      setTampil(nilai)
      return
    }
    const dari = terakhir.current
    const mulai = performance.now()
    let id = 0
    const langkah = (now: number) => {
      const p = Math.min(1, (now - mulai) / durasi)
      terakhir.current = Math.round(dari + (nilai - dari) * (1 - Math.pow(1 - p, 3)))
      setTampil(terakhir.current)
      if (p < 1) id = requestAnimationFrame(langkah)
    }
    id = requestAnimationFrame(langkah)
    return () => cancelAnimationFrame(id)
  }, [nilai, durasi])
  return <>{tampil}</>
}

export function Cincin({ persen, warna = '#F2B33D', dasar = '#ffffff2e', tebal = 9 }: { persen: number; warna?: string; dasar?: string; tebal?: number }) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(Math.max(0, Math.min(100, persen))))
    return () => cancelAnimationFrame(id)
  }, [persen])
  const K = 2 * Math.PI * 40
  return (
    <svg className="cincin" viewBox="0 0 100 100" aria-hidden>
      <circle className="dasar" cx="50" cy="50" r="40" style={{ stroke: dasar, strokeWidth: tebal }} />
      <circle className="isi" cx="50" cy="50" r="40" style={{ stroke: warna, strokeWidth: tebal }} strokeDasharray={K} strokeDashoffset={K * (1 - p / 100)} />
    </svg>
  )
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

/** Grafik batang tegak berwarna (peserta per kategori). */
export function GrafikBatang({ data }: { data: Array<{ label: string; nilai: number; warna: string }> }) {
  const maks = Math.max(1, ...data.map((d) => d.nilai))
  return (
    <div className="grafik-batang" role="img" aria-label={data.map((d) => `${d.label} ${d.nilai}`).join(', ')}>
      {data.map((d) => (
        <div key={d.label} className="gb-kolom">
          <div className="gb-wadah">
            <b>{d.nilai}</b>
            <i style={{ height: `${Math.max(4, (d.nilai / maks) * 100)}%`, background: d.warna }} />
          </div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Donat dengan total di tengah dan legenda. */
export function GrafikDonat({ data, satuan = 'orang' }: { data: Array<{ label: string; nilai: number; warna: string }>; satuan?: string }) {
  const total = data.reduce((a, d) => a + d.nilai, 0)
  const K = 2 * Math.PI * 38
  let jalan = 0
  return (
    <div className="donat">
      <div className="donat-gambar">
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="38" fill="none" stroke="#F7F1E7" strokeWidth="18" />
          {total > 0 &&
            data.map((d) => {
              const pjg = (d.nilai / total) * K
              const el = (
                <circle key={d.label} cx="50" cy="50" r="38" fill="none" stroke={d.warna} strokeWidth="18"
                  strokeDasharray={`${Math.max(0, pjg - 1.2)} ${K}`} strokeDashoffset={-jalan} transform="rotate(-90 50 50)" />
              )
              jalan += pjg
              return el
            })}
        </svg>
        <div className="donat-tengah"><b>{total}</b><span>peserta</span></div>
      </div>
      <ul className="legenda">
        {data.map((d) => (
          <li key={d.label}>
            <i style={{ background: d.warna }} />
            <b>{d.label}</b>
            <span>{d.nilai} {satuan}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Grafik garis berisi untuk riwayat BB / TB. */
export function GrafikGaris({ titik, satuan }: { titik: Array<{ x: string; y: number }>; satuan: string }) {
  if (titik.length < 2) return <p className="petunjuk">Grafik muncul setelah minimal 2 kunjungan.</p>
  const W = 480
  const H = 200
  const padX = 26
  const padT = 34
  const padB = 34
  const ys = titik.map((t) => t.y)
  const min = Math.min(...ys)
  const maks = Math.max(...ys)
  const rentang = maks - min || 1
  const px = (i: number) => padX + (i * (W - padX * 2)) / (titik.length - 1)
  const py = (y: number) => H - padB - ((y - min) / rentang) * (H - padT - padB)
  const garis = titik.map((t, i) => `${px(i)},${py(t.y)}`).join(' ')
  const id = `gg-${satuan.replace(/\W/g, '')}`
  return (
    <svg className="grafik-garis" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Grafik ${satuan}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E8B6A" stopOpacity=".28" />
          <stop offset="1" stopColor="#2E8B6A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX - 10} x2={W - padX + 10} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="#EADFCF" strokeDasharray="4 5" />
      ))}
      <polygon fill={`url(#${id})`} points={`${px(0)},${H - padB} ${garis} ${px(titik.length - 1)},${H - padB}`} />
      <polyline fill="none" stroke="#2E8B6A" strokeWidth="3" strokeLinejoin="round" points={garis} />
      {titik.map((t, i) => {
        const akhir = i === titik.length - 1
        return (
          <g key={i}>
            <circle cx={px(i)} cy={py(t.y)} r="6" fill={akhir ? '#F2B33D' : '#fff'} stroke="#2E8B6A" strokeWidth="3" />
            <text x={px(i)} y={py(t.y) - 13} fontSize="12.5" fontWeight="800" textAnchor="middle" fill="#16302A">
              {String(t.y).replace('.', ',')}
            </text>
            <text x={px(i)} y={H - 10} fontSize="12" fontWeight="600" textAnchor="middle" fill="#6B7A73">
              {t.x}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
