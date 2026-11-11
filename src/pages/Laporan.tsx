import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chip, Field, Ikon, JudulKartu, KepalaHalaman, Kosong } from '../components/ui'
import { kegiatanPadaBulan, NAMA_BULAN, parseISO, tanggalAcuanBulan, tglPanjang } from '../lib/age'
import { db } from '../lib/db'
import { pilihKegiatanAktif, useKategori, useKegiatanList, usePengaturan } from '../lib/hooks'
import { DAFTAR_LAPORAN } from '../reports/definisi'
import { LembarLaporan } from '../reports/LembarLaporan'
import type { ParamLaporan } from '../reports/types'

const PX_MM = 96 / 25.4
const WARNA_DOK = ['#E46F4C', '#174F42', '#2C6A8C', '#8C6BC2', '#94600A', '#2E8B6A']

export default function Laporan() {
  const p = usePengaturan()
  const kategori = useKategori()
  const kegiatan = useKegiatanList()
  const aktif = pilihKegiatanAktif(kegiatan)
  const [kode, setKode] = useState<string | null>(null)
  const [param, setParam] = useState<ParamLaporan>({
    tanggal: '', bulan: new Date().getMonth() + 1, tahun: new Date().getFullYear(), rt: 'semua', jenisObat: 'Obat Cacing', jenisIbu: 'keduanya', ttd: false,
  })
  const [cariWarga, setCariWarga] = useState('')

  // isi bawaan dari kegiatan aktif, sekali saja
  useEffect(() => {
    if (aktif && !param.tanggal) {
      const { y, m } = parseISO(aktif.tanggal)
      setParam((x) => ({ ...x, tanggal: aktif.tanggal, tahun: y, bulan: m }))
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
  // ganti periode: tanggal acuan ikut, pilihan kegiatan lama tidak berlaku lagi
  const setPeriode = (bulan: number, tahun: number) =>
    setParam((x) => ({ ...x, bulan, tahun, kegiatanId: undefined, tanggal: tahun >= 1000 ? tanggalAcuanBulan(kegiatan, tahun, bulan) : x.tanggal }))

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
  }, [lebarMM, def, !!hasil?.length])

  if (!def) {
    return (
      <>
        <KepalaHalaman label="Rekap bulanan" judul="Laporan" sub="Format sama dengan laporan manual Posyandu. Pilih laporan, periksa pratinjau, lalu cetak." />
        <div className="pilihan-laporan">
          {DAFTAR_LAPORAN.map((d, i) => (
            <button key={d.kode} className="kartu-laporan" onClick={() => setKode(d.kode)}>
              <span className="ikon-dok" style={{ ['--w' as string]: WARNA_DOK[i % WARNA_DOK.length] }} aria-hidden><span><i /><i /><i /><i /></span></span>
              <span className="btn-ikon" aria-hidden><Ikon nama="serong" ukuran={18} /></span>
              <h3>{d.nama}</h3>
              <p>{d.deskripsi}</p>
              <span className="baris"><Chip>A4</Chip><Chip>PDF</Chip></span>
            </button>
          ))}
        </div>
        <div className="banner info"><Ikon nama="info" ukuran={22} /> Di jendela cetak pilih “Simpan sebagai PDF”, ukuran A4, margin Tidak ada.</div>
      </>
    )
  }

  const perluTanggal = def.param.includes('tanggal')

  return (
    <>
      <KepalaHalaman kembali={{ onClick: () => setKode(null), label: 'Semua laporan' }} label="Laporan" judul={def.nama} />

      <div className="dua-kolom kiri-sempit">
      <div className="kartu no-print">
        <JudulKartu ikon="lainnya">Pengaturan laporan</JudulKartu>
        <div>
          {def.param.includes('rt') && (
            <Field label="RT">
              <select className="input" value={param.rt} onChange={(e) => set('rt', e.target.value)}>
                <option value="semua">Semua RT</option>
                {p.rtDaftar.map((r) => <option key={r} value={r}>RT {r}</option>)}
              </select>
            </Field>
          )}
          {def.param.includes('bulan') && (
            <Field label="Bulan">
              <select className="input" value={param.bulan} onChange={(e) => setPeriode(Number(e.target.value), param.tahun)}>
                {NAMA_BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
              </select>
            </Field>
          )}
          {def.param.includes('tahun') && (
            <Field label="Tahun">
              <input className="input" type="number" inputMode="numeric" value={param.tahun} onChange={(e) => setPeriode(param.bulan, Number(e.target.value))} />
            </Field>
          )}
          {perluTanggal && (
            <Field label="Tanggal acuan umur" petunjuk="Kategori dihitung pada tanggal ini.">
              <input className="input" type="date" value={param.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
            </Field>
          )}
          {def.param.includes('kegiatan') && (
            <Field label="Kegiatan">
              <select className="input" value={param.kegiatanId ?? ''} onChange={(e) => set('kegiatanId', Number(e.target.value) || undefined)}>
                <option value="">Semua kegiatan bulan ini</option>
                {kegiatanPadaBulan(kegiatan, param.tahun, param.bulan).map((k) => <option key={k.id} value={k.id}>{tglPanjang(k.tanggal)}</option>)}
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
          <div>
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
        <label className="kotak-centang">
          <input type="checkbox" checked={param.ttd} onChange={(e) => set('ttd', e.target.checked)} />
          Sertakan kolom tanda tangan
        </label>
        <button className="btn utama besar penuh" onClick={() => window.print()} disabled={!hasil?.length}>
          <Ikon nama="cetak" ukuran={22} /> Cetak / simpan PDF
        </button>
        <p className="petunjuk" style={{ marginBottom: 0 }}>
          Di jendela cetak pilih <b>Simpan sebagai PDF</b>, ukuran <b>A4</b>, margin <b>Tidak ada</b>, dan matikan “Header dan footer”.
        </p>
      </div>

      {hasil === undefined ? (
        <div className="panel-pratinjau"><p><Ikon nama="mata" ukuran={18} /> Menyiapkan laporan…</p></div>
      ) : hasil.length === 0 ? (
        <div className="kartu">
          <Kosong
            judul="Belum ada data untuk dilaporkan"
            teks={def.kode === 'kartu-pemeriksaan' ? 'Pilih warga terlebih dahulu.' : def.kode === 'hasil-pemeriksaan' || def.kode === 'pemberian-obat' ? 'Belum ada data pada periode ini. Coba bulan lain.' : 'Ubah pengaturan laporan.'}
          />
        </div>
      ) : (
        <div className="panel-pratinjau">
          <p><Ikon nama="mata" ukuran={18} /> Pratinjau · {hasil.length} halaman</p>
          <div className="kertas-gulir" ref={wadah}>
            <div className="skala" style={{ zoom: skala }}>
              {hasil.map((h, i) => <LembarLaporan key={i} hasil={h} ttd={param.ttd} pengaturan={p} />)}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  )
}
