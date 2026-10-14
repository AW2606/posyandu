import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { todayISO } from './age'
import { db, type Pemeriksaan, type Warga } from './db'
import {
  hitungIMT,
  lingkarPerutBerisiko,
  statusGizi,
  tekananDarahBerisiko,
  type StatusGizi,
} from './health'
import { kodeKategori, useKategori, usePengaturan } from './hooks'

export interface WargaPlus {
  w: Warga
  kode: string
  hamil: boolean
  menyusui: boolean
  terakhir?: Pemeriksaan
  imt?: number
  gizi?: StatusGizi
  tinggi: boolean // penanda T pada pemeriksaan terakhir
  perutRisiko: boolean
}

/** Semua warga + kategori + penanda, dihitung terhadap tanggal acuan. */
export function useWargaPlus(ref: string = todayISO(), termasukArsip = false): WargaPlus[] {
  const kategori = useKategori()
  const p = usePengaturan()
  const warga = useLiveQuery(() => db.warga.toArray())
  const status = useLiveQuery(() => db.statusKhusus.toArray())
  const periksa = useLiveQuery(() => db.pemeriksaan.toArray())

  return useMemo(() => {
    if (!warga) return []
    const aktif = new Map<string, Set<number>>([
      ['hamil', new Set()],
      ['menyusui', new Set()],
    ])
    for (const s of status ?? []) {
      if (s.mulai <= ref && (!s.selesai || s.selesai >= ref)) aktif.get(s.jenis)!.add(s.wargaId)
    }
    const terakhir = new Map<number, Pemeriksaan>()
    for (const x of periksa ?? []) {
      const lama = terakhir.get(x.wargaId)
      if (!lama || lama.tanggal <= x.tanggal) terakhir.set(x.wargaId, x)
    }
    return warga
      .filter((w) => termasukArsip || w.aktif)
      .map((w): WargaPlus => {
        const t = terakhir.get(w.id!)
        const imt = hitungIMT(t?.bb, t?.tb)
        return {
          w,
          kode: kodeKategori(w, ref, kategori),
          hamil: aktif.get('hamil')!.has(w.id!),
          menyusui: aktif.get('menyusui')!.has(w.id!),
          terakhir: t,
          imt,
          gizi: statusGizi(imt, p.ambang),
          tinggi: t ? tekananDarahBerisiko(t.sistol, t.diastol, p.ambang) : false,
          perutRisiko: t ? lingkarPerutBerisiko(t.lingkarPerut, w.jk, p.ambang) : false,
        }
      })
  }, [warga, status, periksa, kategori, p.ambang, ref, termasukArsip])
}
