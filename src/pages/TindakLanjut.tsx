import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Kosong, inisial } from '../components/ui'
import { formatUmur, selisihHari, todayISO, umurBulan, usiaHamil, perkiraanLahir, tglId } from '../lib/age'
import { db } from '../lib/db'
import { pilihKegiatanAktif, useKategori, useKegiatanList, usePengaturan } from '../lib/hooks'
import { useWargaPlus } from '../lib/wargaData'

type Tab = 'hadir' | 'imunisasi' | 'hamil' | 'risiko'

export default function TindakLanjut() {
  const ref = todayISO()
  const semua = useWargaPlus(ref)
  const kategori = useKategori()
  const p = usePengaturan()
  const kegiatan = useKegiatanList()
  const [tab, setTab] = useState<Tab>('imunisasi')
  const imun = useLiveQuery(() => db.imunisasi.toArray()) ?? []
  const hamil = useLiveQuery(() => db.kehamilan.filter((k) => !k.tanggalLahir).toArray()) ?? []
  const kunj = useLiveQuery(() => db.kunjungan.toArray()) ?? []

  const aktif = pilihKegiatanAktif(kegiatan)
  const jml = useMemo(() => {
    const m = new Map<number, number>()
    for (const i of imun) m.set(i.wargaId, (m.get(i.wargaId) ?? 0) + 1)
    return m
  }, [imun])

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
  const absen = terakhir.length
    ? semua.filter((x) => terakhir.every((id) => !hadirDi.get(id)?.has(x.w.id!)))
    : []

  const wargaMap = new Map(semua.map((x) => [x.w.id!, x]))
  const risiko = semua.filter((x) => x.tinggi || x.perutRisiko || (x.gizi && x.gizi !== 'Normal'))

  const TABS: Array<[Tab, string, number]> = [
    ['imunisasi', 'Imunisasi', bayi.length],
    ['hamil', 'Bumil', hamil.length],
    ['hadir', 'Absen', absen.length],
    ['risiko', 'Risiko', risiko.length],
  ]

  const baris = (id: number, sub: React.ReactNode, chip?: React.ReactNode) => {
    const x = wargaMap.get(id)
    if (!x) return null
    return (
      <Link key={id} to={`/warga/${id}`} className="item">
        <div className="avatar">{inisial(x.w.nama)}</div>
        <div className="isi">
          <div className="nama">{x.w.nama}</div>
          <div className="sub">{sub}</div>
        </div>
        {chip}
      </Link>
    )
  }

  return (
    <>
      <div className="judul-halaman"><h2>Tindak lanjut</h2></div>
      <div className="tab" role="tablist">
        {TABS.map(([k, l, n]) => (
          <button key={k} className={tab === k ? 'aktif' : ''} onClick={() => setTab(k)}>{l} ({n})</button>
        ))}
      </div>

      {tab === 'imunisasi' && (
        <>
          <p className="redup" style={{ marginTop: -4 }}>Bayi usia 12–23 bulan dengan imunisasi dasar belum lengkap ({p.imunisasiDasar.length} jenis).</p>
          {bayi.length === 0 ? <Kosong judul="Tidak ada" teks="Semua bayi 12–23 bulan sudah lengkap, atau belum ada datanya." /> : (
            <div className="daftar">
              {bayi.map((x) => baris(x.w.id!, `${formatUmur(x.w.tanggalLahir, ref)} · RT ${x.w.rt}${x.w.namaOrtu ? ` · ortu ${x.w.namaOrtu}` : ''}`, <Chip warna="kuning">{jml.get(x.w.id!) ?? 0}/{p.imunisasiDasar.length}</Chip>))}
            </div>
          )}
        </>
      )}

      {tab === 'hamil' && (
        hamil.length === 0 ? <Kosong judul="Belum ada ibu hamil tercatat" teks="Catat HPHT dari halaman warga perempuan." /> : (
          <div className="daftar">
            {[...hamil].sort((a, b) => a.hpht.localeCompare(b.hpht)).map((k) => {
              const sisa = selisihHari(ref, perkiraanLahir(k.hpht))
              return baris(k.wargaId, `${usiaHamil(k.hpht, ref)} · HPL ${tglId(perkiraanLahir(k.hpht))}`, sisa <= 30 ? <Chip warna="merah">{sisa < 0 ? 'Lewat HPL' : `${sisa} hari`}</Chip> : undefined)
            })}
          </div>
        )
      )}

      {tab === 'hadir' && (
        <>
          <p className="redup" style={{ marginTop: -4 }}>Sasaran yang tidak hadir di 2 kegiatan terakhir{aktif ? '' : ' (belum ada kegiatan)'}.</p>
          {absen.length === 0 ? <Kosong judul="Tidak ada" /> : (
            <div className="daftar">
              {absen.slice(0, 100).map((x) => baris(x.w.id!, `${formatUmur(x.w.tanggalLahir, ref)} · RT ${x.w.rt} · ${kategori.find((k) => k.kode === x.kode)?.nama}`))}
              {absen.length > 100 && <p className="petunjuk">Menampilkan 100 pertama.</p>}
            </div>
          )}
        </>
      )}

      {tab === 'risiko' && (
        <>
          <p className="redup" style={{ marginTop: -4 }}>Penanda dari pemeriksaan terakhir. Ini bukan diagnosis; arahkan konsultasi ke bidan.</p>
          {risiko.length === 0 ? <Kosong judul="Tidak ada" /> : (
            <div className="daftar">
              {risiko.slice(0, 100).map((x) => baris(x.w.id!, (
                <>
                  <span>{formatUmur(x.w.tanggalLahir, ref)} · RT {x.w.rt}</span>
                  {x.tinggi && <Chip warna="merah">T</Chip>}
                  {x.perutRisiko && <Chip warna="merah">Perut</Chip>}
                  {x.gizi && x.gizi !== 'Normal' && <Chip warna="merah">{x.gizi}</Chip>}
                </>
              )))}
            </div>
          )}
        </>
      )}
    </>
  )
}
