import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import fotoJadwal from '../assets/foto/timbang-balita.jpg'
import { Chip, Field, Ikon, JudulKartu, KepalaHalaman, Kosong, Sheet, useToast } from '../components/ui'
import { parseISO, tglPanjang, todayISO } from '../lib/age'
import { catat, db, type Kegiatan } from '../lib/db'
import { tanggalRutin, useKegiatanList, usePengaturan } from '../lib/hooks'
import { bulanPendek } from '../lib/tampilan'

function tanggalBerikut(hari: number): string {
  const t = todayISO()
  const { y, m } = parseISO(t)
  const bulanIni = tanggalRutin(y, m, hari)
  if (bulanIni >= t) return bulanIni
  return m === 12 ? tanggalRutin(y + 1, 1, hari) : tanggalRutin(y, m + 1, hari)
}

export default function KegiatanList() {
  const list = useKegiatanList()
  const p = usePengaturan()
  const nav = useNavigate()
  const toast = useToast()
  const [baru, setBaru] = useState(false)
  const [tanggal, setTanggal] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [ket, setKet] = useState('')
  const hitung = useLiveQuery(async () => {
    const k = await db.kunjungan.toArray()
    const m: Record<number, { n: number; dilayani: number }> = {}
    for (const x of k) {
      const h = (m[x.kegiatanId] ??= { n: 0, dilayani: 0 })
      h.n++
      if (x.tahap === 'dilayani') h.dilayani++
    }
    return m
  }) ?? {}

  function buka() {
    setTanggal(tanggalBerikut(p.tanggalKegiatan))
    setLokasi(`Posyandu Bangau, ${p.dusun} ${p.desa}`)
    setKet('')
    setBaru(true)
  }

  async function simpan() {
    if (!tanggal) return
    if (list.some((k) => k.tanggal === tanggal)) {
      toast('Sudah ada kegiatan pada tanggal itu')
      return
    }
    const id = (await db.kegiatan.add({ tanggal, lokasi, keterangan: ket })) as number
    await catat('tambah', 'kegiatan', tanggal)
    nav(`/kegiatan/${id}`)
  }

  const t = todayISO()
  const datang = list.filter((k) => k.tanggal >= t).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  const lewat = list.filter((k) => k.tanggal < t)
  const berikut = datang.find((k) => k.tanggal > t) ?? datang[0]
  const enamLalu = lewat.slice(0, 6)
  const rataHadir = enamLalu.length ? Math.round(enamLalu.reduce((a, k) => a + (hitung[k.id!]?.n ?? 0), 0) / enamLalu.length) : 0

  const baris = (k: Kegiatan) => {
    const h = hitung[k.id!] ?? { n: 0, dilayani: 0 }
    const kini = k.tanggal === t
    const nanti = k.tanggal > t
    return (
      <Link key={k.id} to={`/kegiatan/${k.id}`} className="item">
        <div className={`petak-tgl ${kini ? 'hijau' : nanti ? 'kuning' : 'krem'}`}>
          <b>{parseISO(k.tanggal).d}</b>
          <small>{bulanPendek(k.tanggal)}</small>
        </div>
        <div className="isi">
          <div className="nama">{tglPanjang(k.tanggal)}</div>
          <div className="sub">
            <span>{h.n ? `${h.n} peserta${kini && h.dilayani ? ` · ${h.dilayani} dilayani` : ''}` : 'Belum ada peserta'}</span>
            {kini && <Chip warna="hijau" titik>Hari ini</Chip>}
            {nanti && <Chip warna="kuning" titik>Akan datang</Chip>}
            {!kini && !nanti && <Chip warna="krem"><Ikon nama="centang" ukuran={14} tebal={2.6} /> Selesai</Chip>}
          </div>
        </div>
        <span className="btn-ikon"><Ikon nama="panah" ukuran={18} /></span>
      </Link>
    )
  }

  return (
    <>
      <KepalaHalaman label="Layanan" judul="Hari Posyandu" sub={`Posyandu rutin setiap tanggal ${p.tanggalKegiatan}. Pilih kegiatan untuk membuka meja layanan.`}>
        <button className="btn ajakan" onClick={buka}>
          <Ikon nama="tambah" ukuran={20} /> Kegiatan baru
        </button>
      </KepalaHalaman>

      <div className="dua-kolom">
        <div>
          {list.length === 0 ? (
            <div className="kartu">
              <Kosong judul="Belum ada kegiatan" teks="Buat kegiatan untuk tanggal Posyandu berikutnya.">
                <button className="btn utama" style={{ marginTop: 14 }} onClick={buka}><Ikon nama="tambah" ukuran={20} /> Buat kegiatan</button>
              </Kosong>
            </div>
          ) : (
            <>
              {datang.length > 0 && (
                <>
                  <p className="label-bagian">Akan datang</p>
                  <div className="daftar" style={{ marginBottom: 24 }}>{datang.map(baris)}</div>
                </>
              )}
              {lewat.length > 0 && (
                <>
                  <p className="label-bagian">Sudah lewat</p>
                  <div className="daftar" style={{ marginBottom: 24 }}>{lewat.map(baris)}</div>
                </>
              )}
            </>
          )}
        </div>

        <aside>
          <div className="kartu kartu-foto">
            <div className="foto-atas">
              <img src={fotoJadwal} alt="" />
              <b>Jadwal rutin</b>
            </div>
            <div className="isi-foto">
              <p className="redup kecil" style={{ margin: 0, fontWeight: 600 }}>Kegiatan berikutnya</p>
              <h3>{berikut ? tglPanjang(berikut.tanggal) : tglPanjang(tanggalBerikut(p.tanggalKegiatan))}</h3>
              <p className="redup" style={{ margin: '0 0 16px', fontSize: 15 }}>
                {berikut ? 'Kegiatan sudah dibuat. Buka untuk mendaftarkan peserta.' : 'Buat kegiatan lebih awal supaya antrean bisa langsung dibuka di hari-H.'}
              </p>
              {berikut ? (
                <Link className="btn utama penuh" to={`/kegiatan/${berikut.id}`}><Ikon nama="layanan" ukuran={20} /> Buka kegiatan</Link>
              ) : (
                <button className="btn ajakan penuh" onClick={buka}><Ikon nama="tambah" ukuran={20} /> Buat kegiatan</button>
              )}
            </div>
          </div>
          {enamLalu.length > 0 && (
            <div className="kartu">
              <JudulKartu ikon="grafik">Rata-rata kehadiran</JudulKartu>
              <p style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>{rataHadir} orang</p>
              <p className="redup" style={{ margin: '6px 0 0' }}>per kegiatan, {enamLalu.length} kegiatan terakhir</p>
            </div>
          )}
        </aside>
      </div>

      {baru && (
        <Sheet judul="Kegiatan baru" sub="Buat jadwal Posyandu berikutnya" ikon="kalender" onTutup={() => setBaru(false)}>
          <Field label="Tanggal" petunjuk={`Posyandu rutin setiap tanggal ${p.tanggalKegiatan}.`}>
            <input className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Lokasi">
            <input className="input" value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
          </Field>
          <Field label="Keterangan (opsional)">
            <input className="input" placeholder="mis. Pemberian Vitamin A" value={ket} onChange={(e) => setKet(e.target.value)} />
          </Field>
          <div className="aksi-bawah">
            <button className="btn" onClick={() => setBaru(false)}>Batal</button>
            <button className="btn utama" onClick={simpan} disabled={!tanggal}>Buat kegiatan</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
