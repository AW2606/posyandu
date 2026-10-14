import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Field, Ikon, Kosong } from '../components/ui'
import { parseISO, tglPanjang } from '../lib/age'
import { db } from '../lib/db'
import { pilihKegiatanAktif, useKategori, useKegiatanList, usePengaturan } from '../lib/hooks'
import { DAFTAR_LAPORAN } from '../reports/definisi'
import { LembarLaporan } from '../reports/LembarLaporan'
import type { ParamLaporan } from '../reports/types'

const PX_MM = 96 / 25.4

export default function Laporan() {
  const p = usePengaturan()
  const kategori = useKategori()
  const kegiatan = useKegiatanList()
  const aktif = pilihKegiatanAktif(kegiatan)
  const [kode, setKode] = useState<string | null>(null)
  const [param, setParam] = useState<ParamLaporan>({
    tanggal: '', tahun: new Date().getFullYear(), rt: 'semua', jenisObat: 'Obat Cacing', jenisIbu: 'keduanya', ttd: false,
  })
  const [cariWarga, setCariWarga] = useState('')

  // isi bawaan dari kegiatan aktif, sekali saja
  useEffect(() => {
    if (aktif && !param.tanggal) {
      setParam((x) => ({ ...x, tanggal: aktif.tanggal, tahun: parseISO(aktif.tanggal).y, kegiatanId: aktif.id }))
    }
  }, [aktif, param.tanggal])
  useEffect(() => {
    if (!p.jenisObat.includes(param.jenisObat)) setParam((x) => ({ ...x, jenisObat: p.jenisObat[0] ?? '' }))
  }, [p.jenisObat, param.jenisObat])

  const def = DAFTAR_LAPORAN.find((d) => d.kode === kode)
  const warga = useLiveQuery(() => db.warga.filter((w) => w.aktif).toArray()) ?? []
  const opsiWarga = useMemo(() => {
    const k = cariWarga.trim().toLowerCase()
    return warga
      .filter((w) => !k || w.nama.toLowerCase().includes(k))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
      .slice(0, 60)
  }, [warga, cariWarga])

  const hasil = useLiveQuery(
    () => (def && param.tanggal ? def.bangun(param, { pengaturan: p, kategori }) : undefined),
    [def?.kode, JSON.stringify(param), JSON.stringify(p), JSON.stringify(kategori)],
  )

  const set = <K extends keyof ParamLaporan>(k: K, v: ParamLaporan[K]) => setParam((x) => ({ ...x, [k]: v }))

  // skala pratinjau agar muat di layar HP
  const wadah = useRef<HTMLDivElement>(null)
  const [skala, setSkala] = useState(1)
  const lebarMM = hasil?.[0]?.orientasi === 'landscape' ? 297 : 210
  useEffect(() => {
    const el = wadah.current
    if (!el) return
    const hitung = () => setSkala(Math.min(1, (el.clientWidth - 28) / (lebarMM * PX_MM)))
    hitung()
    const ro = new ResizeObserver(hitung)
    ro.observe(el)
    return () => ro.disconnect()
  }, [lebarMM, def])

  if (!def) {
    return (
      <>
        <div className="judul-halaman"><h2>Laporan</h2></div>
        <p className="redup" style={{ marginTop: -6 }}>Format sama dengan laporan manual Posyandu. Pilih laporan, periksa pratinjau, lalu cetak atau simpan sebagai PDF.</p>
        <div className="pilihan-laporan">
          {DAFTAR_LAPORAN.map((d) => (
            <button key={d.kode} className="item" onClick={() => setKode(d.kode)}>
              <div className="avatar"><Ikon nama="laporan" ukuran={22} /></div>
              <div className="isi">
                <div className="nama" style={{ whiteSpace: 'normal' }}>{d.nama}</div>
                <div className="sub">{d.deskripsi}</div>
              </div>
              <Ikon nama="panah" ukuran={18} />
            </button>
          ))}
        </div>
      </>
    )
  }

  const perluTanggal = def.param.includes('tanggal')
  const kegiatanTerpilih = kegiatan.find((k) => k.id === param.kegiatanId)

  return (
    <>
      <div className="judul-halaman no-print">
        <button className="btn kecil" onClick={() => setKode(null)}>← Semua laporan</button>
        <h2 style={{ fontSize: 18 }}>{def.nama}</h2>
      </div>

      <div className="kartu no-print">
        <div className="grid2 tumpuk">
          {def.param.includes('rt') && (
            <Field label="RT">
              <select className="input" value={param.rt} onChange={(e) => set('rt', e.target.value)}>
                <option value="semua">Semua RT</option>
                {p.rtDaftar.map((r) => <option key={r} value={r}>RT {r}</option>)}
              </select>
            </Field>
          )}
          {perluTanggal && (
            <Field label="Tanggal acuan umur" petunjuk="Kategori dihitung pada tanggal ini.">
              <input className="input" type="date" value={param.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
            </Field>
          )}
          {def.param.includes('tahun') && (
            <Field label="Tahun">
              <input className="input" type="number" inputMode="numeric" value={param.tahun} onChange={(e) => set('tahun', Number(e.target.value))} />
            </Field>
          )}
          {def.param.includes('kegiatan') && (
            <Field label="Kegiatan">
              <select className="input" value={param.kegiatanId ?? ''} onChange={(e) => set('kegiatanId', Number(e.target.value) || undefined)}>
                <option value="">Pilih kegiatan</option>
                {kegiatan.map((k) => <option key={k.id} value={k.id}>{tglPanjang(k.tanggal)}</option>)}
              </select>
            </Field>
          )}
          {def.param.includes('jenisObat') && (
            <Field label="Jenis">
              <select className="input" value={param.jenisObat} onChange={(e) => set('jenisObat', e.target.value)}>
                {p.jenisObat.map((j) => <option key={j}>{j}</option>)}
              </select>
            </Field>
          )}
          {def.param.includes('jenisIbu') && (
            <Field label="Sasaran">
              <select className="input" value={param.jenisIbu} onChange={(e) => set('jenisIbu', e.target.value as ParamLaporan['jenisIbu'])}>
                <option value="keduanya">Ibu hamil dan menyusui</option>
                <option value="hamil">Ibu hamil saja</option>
                <option value="menyusui">Ibu menyusui saja</option>
              </select>
            </Field>
          )}
        </div>
        {def.param.includes('warga') && (
          <div className="grid2 tumpuk">
            <Field label={def.kode === 'hasil-pemeriksaan' ? 'Warga (kosongkan untuk semua peserta)' : 'Warga'}>
              <input className="input" placeholder="Cari nama" value={cariWarga} onChange={(e) => setCariWarga(e.target.value)} />
            </Field>
            <Field label="Pilih">
              <select className="input" value={param.wargaId ?? ''} onChange={(e) => set('wargaId', Number(e.target.value) || undefined)}>
                <option value="">{def.kode === 'hasil-pemeriksaan' ? 'Semua yang punya hasil' : 'Pilih warga'}</option>
                {opsiWarga.map((w) => <option key={w.id} value={w.id}>{w.nama} (RT {w.rt})</option>)}
              </select>
            </Field>
          </div>
        )}
        <label className="baris" style={{ margin: '4px 0 14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={param.ttd} onChange={(e) => set('ttd', e.target.checked)} style={{ width: 22, height: 22 }} />
          Sertakan kolom tanda tangan
        </label>
        <button className="btn utama penuh" onClick={() => window.print()} disabled={!hasil?.length}>
          <Ikon nama="cetak" ukuran={20} /> Cetak / simpan PDF
        </button>
        <p className="petunjuk" style={{ marginBottom: 0 }}>
          Di jendela cetak pilih <b>Simpan sebagai PDF</b>, ukuran <b>A4</b>, margin <b>Tidak ada</b>, dan matikan “Header dan footer”.
        </p>
      </div>

      {hasil === undefined ? (
        <p className="redup">Menyiapkan laporan…</p>
      ) : hasil.length === 0 ? (
        <div className="kartu">
          <Kosong
            judul="Belum ada data untuk dilaporkan"
            teks={def.kode === 'kartu-pemeriksaan' ? 'Pilih warga terlebih dahulu.' : def.kode === 'hasil-pemeriksaan' || def.kode === 'pemberian-obat' ? (kegiatanTerpilih ? 'Belum ada data pada kegiatan ini.' : 'Pilih kegiatan terlebih dahulu.') : 'Ubah parameter di atas.'}
          />
        </div>
      ) : (
        <div className="kertas-gulir" ref={wadah}>
          <div className="skala" style={{ zoom: skala }}>
            {hasil.map((h, i) => <LembarLaporan key={i} hasil={h} ttd={param.ttd} pengaturan={p} />)}
          </div>
        </div>
      )}
    </>
  )
}
