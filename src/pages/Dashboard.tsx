import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Angka, Bar, Cincin, Ikon, Kosong } from '../components/ui'
import { tglPanjang } from '../lib/age'
import { db, URUTAN_TAHAP, NAMA_TAHAP } from '../lib/db'
import { pilihKegiatanAktif, useKategori, useKegiatanList, usePengaturan } from '../lib/hooks'
import { useWargaPlus } from '../lib/wargaData'

export default function Dashboard() {
  const list = useKegiatanList()
  const p = usePengaturan()
  const kategori = useKategori()
  const [pilih, setPilih] = useState<number | null>(null)
  const kegiatan = list.find((k) => k.id === pilih) ?? pilihKegiatanAktif(list)
  const ref = kegiatan?.tanggal ?? new Date().toISOString().slice(0, 10)
  const semua = useWargaPlus(ref)
  const kunj = useLiveQuery(() => (kegiatan ? db.kunjungan.where('kegiatanId').equals(kegiatan.id!).toArray() : []), [kegiatan?.id]) ?? []
  const periksa = useLiveQuery(() => (kegiatan ? db.pemeriksaan.where('kegiatanId').equals(kegiatan.id!).toArray() : []), [kegiatan?.id]) ?? []

  const d = useMemo(() => {
    const byId = new Map(semua.map((x) => [x.w.id!, x]))
    const peserta = kunj.map((k) => byId.get(k.wargaId)).filter((x) => !!x)
    const perKat: Record<string, number> = {}
    const perRT: Record<string, number> = {}
    for (const x of peserta) {
      perKat[x!.kode] = (perKat[x!.kode] ?? 0) + 1
      perRT[x!.w.rt] = (perRT[x!.w.rt] ?? 0) + 1
    }
    const pm = new Map(periksa.map((x) => [x.wargaId, x]))
    let T = 0, perut = 0, kurus = 0, gemuk = 0
    for (const x of peserta) {
      const t = pm.get(x!.w.id!)
      if (!t) continue
      // gunakan data kegiatan ini, bukan pemeriksaan terakhir secara umum
      if (x!.terakhir?.kegiatanId === kegiatan?.id) {
        if (x!.tinggi) T++
        if (x!.perutRisiko) perut++
        if (x!.gizi === 'Kurus') kurus++
        if (x!.gizi === 'Gemuk') gemuk++
      }
    }
    const tahap = URUTAN_TAHAP.map((t) => ({ t, n: kunj.filter((k) => URUTAN_TAHAP.indexOf(k.tahap) >= URUTAN_TAHAP.indexOf(t)).length }))
    return { n: peserta.length, perKat, perRT, T, perut, kurus, gemuk, tahap, terukur: periksa.length }
  }, [semua, kunj, periksa, kegiatan?.id])

  const sasaran = semua.length
  const persen = sasaran ? Math.round((d.n / sasaran) * 100) : 0
  const maksKat = Math.max(1, ...Object.values(d.perKat))
  const maksRT = Math.max(1, ...Object.values(d.perRT))

  return (
    <>
      <div className="judul-halaman"><h2>Beranda</h2></div>

      {list.length === 0 ? (
        <div className="kartu">
          <Kosong judul={sasaran ? 'Belum ada kegiatan' : 'Selamat datang di Posyandu Bangau'} teks={sasaran ? 'Buat kegiatan untuk tanggal Posyandu berikutnya.' : 'Mulai dengan memasukkan data warga atau memuat data contoh untuk mencoba.'}>
            <div className="baris" style={{ justifyContent: 'center', marginTop: 12 }}>
              {sasaran ? (
                <Link className="btn utama" to="/kegiatan">Buat kegiatan</Link>
              ) : (
                <>
                  <Link className="btn utama" to="/warga/impor">Impor data warga</Link>
                  <Link className="btn" to="/pengaturan">Muat data contoh</Link>
                </>
              )}
            </div>
          </Kosong>
        </div>
      ) : (
        <>
          <div className="kartu hero">
            <p style={{ margin: 0, opacity: .85, fontSize: 13 }}>Kegiatan</p>
            <h3 style={{ fontSize: 22, margin: '2px 0 12px' }}>{kegiatan && tglPanjang(kegiatan.tanggal)}</h3>
            <div className="baris">
              <Link className="btn" to={`/kegiatan/${kegiatan?.id}`} style={{ color: 'var(--h-gelap)' }}>
                <Ikon nama="layanan" ukuran={20} /> Buka meja layanan
              </Link>
              <select className="input" style={{ width: 'auto', minHeight: 48, color: '#111' }} value={kegiatan?.id} onChange={(e) => setPilih(Number(e.target.value))} aria-label="Pilih kegiatan">
                {list.map((k) => <option key={k.id} value={k.id}>{tglPanjang(k.tanggal)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid4" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="angka"><Angka nilai={d.n} /></div><div className="lbl">Peserta hadir</div></div>
            <div className="stat hijau stat-hadir">
              <Cincin persen={persen} />
              <div><div className="angka"><Angka nilai={persen} />%</div><div className="lbl">Kehadiran dari {sasaran} sasaran</div></div>
            </div>
            <div className="stat"><div className="angka"><Angka nilai={d.terukur} /></div><div className="lbl">Sudah diukur</div></div>
            <div className="stat"><div className="angka"><Angka nilai={sasaran - d.n} /></div><div className="lbl">Belum hadir</div></div>
          </div>

          <Link className="item" to="/tindak-lanjut" style={{ marginBottom: 14 }}>
            <div className="isi">
              <div className="nama">Daftar tindak lanjut</div>
              <div className="sub">Belum hadir, bayi imunisasi belum lengkap, ibu hamil</div>
            </div>
            <Ikon nama="panah" ukuran={18} />
          </Link>

          <div className="kartu">
            <h3>Progres tahap layanan</h3>
            {d.tahap.map(({ t, n }) => <Bar key={t} label={NAMA_TAHAP[t]} nilai={n} maks={Math.max(1, d.n)} />)}
          </div>

          <div className="kartu">
            <h3>Penanda risiko pada kegiatan ini</h3>
            <div className="grid4">
              <div className={`stat ${d.T ? 'merah' : ''}`}><div className="angka"><Angka nilai={d.T} /></div><div className="lbl">Tensi berisiko (T)</div></div>
              <div className={`stat ${d.perut ? 'merah' : ''}`}><div className="angka"><Angka nilai={d.perut} /></div><div className="lbl">Lingkar perut berisiko</div></div>
              <div className={`stat ${d.kurus ? 'merah' : ''}`}><div className="angka"><Angka nilai={d.kurus} /></div><div className="lbl">IMT kurus</div></div>
              <div className={`stat ${d.gemuk ? 'merah' : ''}`}><div className="angka"><Angka nilai={d.gemuk} /></div><div className="lbl">IMT gemuk</div></div>
            </div>
          </div>

          <div className="grid2 tumpuk" style={{ alignItems: "start" }}>
            <div className="kartu">
              <h3>Peserta per kategori</h3>
              {[...kategori].sort((a, b) => a.urutan - b.urutan).map((k) => <Bar key={k.kode} label={k.nama} nilai={d.perKat[k.kode] ?? 0} maks={maksKat} />)}
            </div>
            <div className="kartu">
              <h3>Peserta per RT</h3>
              {p.rtDaftar.map((r) => <Bar key={r} label={`RT ${r}`} nilai={d.perRT[r] ?? 0} maks={maksRT} />)}
            </div>
          </div>
        </>
      )}
    </>
  )
}
