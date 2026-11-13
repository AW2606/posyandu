import { useEffect, useRef, useState } from 'react'
import { batasiPosisi, kotakSumber, muatGambarDariUrl, posisiTengah, potongKeDataUrl, skalaDasar, ZOOM_MAKS, zoomKeTengah } from '../lib/foto'
import { Ikon, Sheet } from './ui'

/**
 * Pratinjau sebelum foto profil disimpan: geser untuk memilih bagian yang tampil,
 * perbesar lewat penggeser, cubit dua jari (HP), atau gulir mouse (laptop).
 */
export default function AturFoto({ file, onBatal, onPakai, onGanti }: {
  file: File
  onBatal: () => void
  /** simpan foto; false = gagal, pratinjau tetap terbuka */
  onPakai: (dataUrl: string) => Promise<boolean>
  /** pilih berkas lain tanpa menutup pratinjau */
  onGanti: () => void
}) {
  const [bingkai] = useState(() => Math.max(200, Math.min(300, (typeof window === 'undefined' ? 300 : window.innerWidth) - 88)))
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [proses, setProses] = useState(false)
  const jari = useRef(new Map<number, { x: number; y: number }>())
  const cubitAwal = useRef<{ jarak: number; zoom: number } | null>(null)

  useEffect(() => {
    let batal = false
    setImg(null)
    setGalat(null)
    // Alamat sementara tetap hidup selama pratinjau terbuka (dipakai <img> di bawah dan saat memotong),
    // baru dicabut ketika berkas berganti atau pratinjau ditutup.
    const url = URL.createObjectURL(file)
    muatGambarDariUrl(url).then(
      (g) => {
        if (batal) return
        const s = skalaDasar(g.naturalWidth, g.naturalHeight, bingkai)
        setImg(g)
        setZoom(1)
        setPos(posisiTengah(g.naturalWidth, g.naturalHeight, s, bingkai))
      },
      (e: Error) => !batal && setGalat(e.message),
    )
    return () => {
      batal = true
      URL.revokeObjectURL(url)
    }
  }, [file, bingkai])

  const w = img?.naturalWidth ?? 1
  const h = img?.naturalHeight ?? 1
  const s0 = skalaDasar(w, h, bingkai)
  const skala = s0 * zoom

  function aturZoom(z: number) {
    const baru = Math.min(ZOOM_MAKS, Math.max(1, z))
    setPos((p) => zoomKeTengah(p, skala, s0 * baru, w, h, bingkai))
    setZoom(baru)
  }

  // ---- geser dan cubit (pointer events: mouse, jari, pena)
  function turun(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    jari.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (jari.current.size === 2) {
      const [a, b] = [...jari.current.values()]
      cubitAwal.current = { jarak: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  function gerak(e: React.PointerEvent) {
    const lama = jari.current.get(e.pointerId)
    if (!lama) return
    jari.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (jari.current.size === 2 && cubitAwal.current) {
      const [a, b] = [...jari.current.values()]
      aturZoom(cubitAwal.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / cubitAwal.current.jarak))
      return
    }
    const dx = e.clientX - lama.x
    const dy = e.clientY - lama.y
    setPos((p) => batasiPosisi({ x: p.x + dx, y: p.y + dy }, w, h, skala, bingkai))
  }
  function naik(e: React.PointerEvent) {
    jari.current.delete(e.pointerId)
    if (jari.current.size < 2) cubitAwal.current = null
  }

  async function pakai() {
    if (!img) return
    setProses(true)
    try {
      if (!(await onPakai(potongKeDataUrl(img, kotakSumber(pos, skala, bingkai))))) setProses(false)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Foto gagal diproses')
      setProses(false)
    }
  }

  return (
    <Sheet judul="Atur foto profil" sub="Geser foto untuk memilih bagian yang tampil" ikon="kamera" onTutup={onBatal}>
      <div className="atur-foto">
        <div
          className="atur-bingkai"
          style={{ width: bingkai, height: bingkai }}
          onPointerDown={turun}
          onPointerMove={gerak}
          onPointerUp={naik}
          onPointerCancel={naik}
          onWheel={(e) => aturZoom(zoom * Math.exp(-e.deltaY * 0.0015))}
          role="img"
          aria-label="Pratinjau foto profil. Geser untuk mengatur posisi."
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ left: pos.x, top: pos.y, width: w * skala, height: h * skala }}
            />
          )}
          <span className="atur-lingkaran" aria-hidden />
          {!img && !galat && <span className="atur-muat">Memuat foto…</span>}
        </div>

        <div className="atur-zoom">
          <button type="button" className="btn-ikon" onClick={() => aturZoom(zoom - 0.25)} disabled={!img || zoom <= 1} aria-label="Perkecil">
            <span aria-hidden className="tanda">-</span>
          </button>
          <input
            type="range"
            min={1}
            max={ZOOM_MAKS}
            step={0.01}
            value={zoom}
            onChange={(e) => aturZoom(Number(e.target.value))}
            disabled={!img}
            aria-label="Perbesar foto"
          />
          <button type="button" className="btn-ikon" onClick={() => aturZoom(zoom + 0.25)} disabled={!img || zoom >= ZOOM_MAKS} aria-label="Perbesar">
            <Ikon nama="tambah" ukuran={18} />
          </button>
        </div>
        <p className="petunjuk">Bagian di dalam lingkaran yang akan menjadi foto profil.</p>
        {galat && <div className="banner bahaya"><Ikon nama="peringatan" ukuran={20} /> {galat}</div>}
      </div>

      <div className="aksi-bawah">
        <button type="button" className="btn" onClick={onGanti} disabled={proses}>Pilih foto lain</button>
        <button type="button" className="btn utama" onClick={pakai} disabled={!img || proses}>
          <Ikon nama="centang" ukuran={18} tebal={2.4} /> {proses ? 'Menyimpan…' : 'Pakai foto'}
        </button>
      </div>
    </Sheet>
  )
}
