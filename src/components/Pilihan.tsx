import { useCallback, useState, type ReactNode } from 'react'
import { hitungDataWarga } from '../lib/db'
import { Ikon } from './ui'

/** Status mode pilih: daftar id yang dicentang. */
export function usePilihan() {
  const [aktif, setAktif] = useState(false)
  const [ids, setIds] = useState<Set<number>>(new Set())
  const toggle = useCallback((id: number) => {
    setIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])
  const aturSemua = useCallback((semua: number[], pilih: boolean) => {
    setIds((s) => {
      const n = new Set(s)
      for (const id of semua) {
        if (pilih) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }, [])
  const mulai = useCallback(() => setAktif(true), [])
  const selesai = useCallback(() => {
    setAktif(false)
    setIds(new Set())
  }, [])
  return { aktif, ids, toggle, aturSemua, mulai, selesai }
}

export type Pilihan = ReturnType<typeof usePilihan>

/** Kotak centang bulat di depan baris daftar. */
export function Centang({ on }: { on: boolean }) {
  return <span className={`centang-pilih ${on ? 'on' : ''}`} aria-hidden>{on && <Ikon nama="centang" ukuran={16} tebal={3} />}</span>
}

/**
 * Baris di atas daftar: teks ringkasan di kiri, tombol "Pilih" atau
 * "Pilih semua" + "Batal" di kanan.
 */
export function BilahPilih({ p, terlihat, teks }: { p: Pilihan; terlihat: number[]; teks: ReactNode }) {
  const semua = terlihat.length > 0 && terlihat.every((id) => p.ids.has(id))
  const sebagian = !semua && terlihat.some((id) => p.ids.has(id))
  return (
    <div className="bilah-pilih">
      <span className="redup">{teks}</span>
      {p.aktif ? (
        <span className="baris" style={{ gap: 8 }}>
          <label className="pilih-semua">
            <input
              type="checkbox"
              checked={semua}
              ref={(el) => { if (el) el.indeterminate = sebagian }}
              onChange={() => p.aturSemua(terlihat, !semua)}
              disabled={!terlihat.length}
            />
            Pilih semua ({terlihat.length})
          </label>
          <button type="button" className="btn kecil" onClick={p.selesai}>Batal</button>
        </span>
      ) : (
        terlihat.length > 0 && (
          <button type="button" className="btn kecil" onClick={p.mulai}><Ikon nama="centang" ukuran={16} tebal={2.6} /> Pilih</button>
        )
      )}
    </div>
  )
}

/** Bilah aksi yang menempel di bawah layar selama mode pilih. */
export function AksiPilihan({ p, children }: { p: Pilihan; children: ReactNode }) {
  if (!p.aktif) return null
  const n = p.ids.size
  return (
    <div className="aksi-pilihan" role="toolbar" aria-label="Aksi untuk warga terpilih">
      <span><b>{n}</b> dipilih</span>
      <div className="aksi-pilihan-tombol">{n > 0 ? children : <span className="pudar">Centang warga yang ingin diproses</span>}</div>
    </div>
  )
}

/** Teks konfirmasi hapus banyak warga, menyebut berapa catatan yang ikut terhapus. */
export async function teksHapusBanyak(ids: number[]): Promise<string> {
  const n = await hitungDataWarga(ids)
  const ikut = [n.kunjungan && `${n.kunjungan} kunjungan`, n.pemeriksaan && `${n.pemeriksaan} hasil pemeriksaan`, n.lain && `${n.lain} catatan lain`].filter(Boolean).join(', ')
  return `${ids.length} warga terpilih akan dihapus permanen${ikut ? ` beserta ${ikut}` : ''}. Data yang dihapus tidak bisa dikembalikan dan juga hilang dari laporan bulan-bulan sebelumnya.`
}
