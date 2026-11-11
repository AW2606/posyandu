import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { todayISO, umurBulan } from './age'
import { db } from './db'
import { useKegiatanList, usePengaturan } from './hooks'
import { useWargaPlus } from './wargaData'

/** Daftar warga yang perlu ditindaklanjuti. Dipakai Beranda dan halaman Tindak lanjut. */
export function useTindakLanjut() {
  const ref = todayISO()
  const semua = useWargaPlus(ref)
  const p = usePengaturan()
  const kegiatan = useKegiatanList()
  const imun = useLiveQuery(() => db.imunisasi.toArray()) ?? []
  const hamil = useLiveQuery(() => db.kehamilan.filter((k) => !k.tanggalLahir).toArray()) ?? []
  const kunj = useLiveQuery(() => db.kunjungan.toArray()) ?? []

  return useMemo(() => {
    const jml = new Map<number, number>()
    for (const i of imun) jml.set(i.wargaId, (jml.get(i.wargaId) ?? 0) + 1)

    // bayi 12-23 bulan yang belum lengkap (SDGs 3.28.1)
    const bayi = semua
      .filter((x) => { const b = umurBulan(x.w.tanggalLahir, ref); return b >= 12 && b < 24 })
      .filter((x) => (jml.get(x.w.id!) ?? 0) < p.imunisasiDasar.length)
      .sort((a, b) => (jml.get(a.w.id!) ?? 0) - (jml.get(b.w.id!) ?? 0))

    // tidak hadir 2 kegiatan terakhir berturut-turut
    const terakhir = [...kegiatan].filter((k) => k.tanggal <= ref).slice(0, 2).map((k) => k.id!)
    const hadirDi = new Map<number, Set<number>>()
    for (const k of kunj) {
      if (!hadirDi.has(k.kegiatanId)) hadirDi.set(k.kegiatanId, new Set())
      hadirDi.get(k.kegiatanId)!.add(k.wargaId)
    }
    const absen = terakhir.length ? semua.filter((x) => terakhir.every((id) => !hadirDi.get(id)?.has(x.w.id!))) : []

    const aktifIds = new Set(semua.map((x) => x.w.id!))
    const bumil = hamil.filter((k) => aktifIds.has(k.wargaId))
    const risiko = semua.filter((x) => x.tinggi || x.perutRisiko || (x.gizi && x.gizi !== 'Normal'))

    const unik = new Set<number>([...bayi.map((x) => x.w.id!), ...bumil.map((k) => k.wargaId), ...absen.map((x) => x.w.id!), ...risiko.map((x) => x.w.id!)])
    return { ref, semua, jml, bayi, bumil, absen, risiko, total: unik.size, ids: [...unik], adaKegiatan: terakhir.length > 0, jenisImunisasi: p.imunisasiDasar.length }
  }, [semua, imun, hamil, kunj, kegiatan, p.imunisasiDasar.length, ref])
}
