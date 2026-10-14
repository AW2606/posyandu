import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Chip, Field, Ikon, Kosong, Sheet, useToast } from '../components/ui'
import { parseISO, tglPanjang, todayISO } from '../lib/age'
import { catat, db } from '../lib/db'
import { tanggalRutin, useKegiatanList, usePengaturan } from '../lib/hooks'

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
    const m: Record<number, number> = {}
    for (const x of k) m[x.kegiatanId] = (m[x.kegiatanId] ?? 0) + 1
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

  return (
    <>
      <div className="judul-halaman">
        <h2>Hari Posyandu</h2>
        <button className="btn utama" onClick={buka}>
          <Ikon nama="tambah" ukuran={20} /> Kegiatan baru
        </button>
      </div>
      <p className="redup" style={{ marginTop: -6 }}>Posyandu rutin setiap tanggal {p.tanggalKegiatan}. Pilih kegiatan untuk membuka meja layanan.</p>

      {list.length === 0 ? (
        <div className="kartu">
          <Kosong judul="Belum ada kegiatan" teks="Buat kegiatan untuk tanggal Posyandu berikutnya.">
            <button className="btn utama" style={{ marginTop: 10 }} onClick={buka}>Buat kegiatan</button>
          </Kosong>
        </div>
      ) : (
        <div className="daftar">
          {list.map((k) => (
            <Link key={k.id} to={`/kegiatan/${k.id}`} className="item">
              <div className="avatar antre" style={{ fontSize: 15 }}>{parseISO(k.tanggal).d}</div>
              <div className="isi">
                <div className="nama">{tglPanjang(k.tanggal)}</div>
                <div className="sub">
                  <span>{hitung[k.id!] ?? 0} peserta</span>
                  {k.tanggal === t && <Chip warna="hijau">Hari ini</Chip>}
                  {k.tanggal > t && <Chip warna="biru">Akan datang</Chip>}
                </div>
              </div>
              <Ikon nama="panah" ukuran={18} />
            </Link>
          ))}
        </div>
      )}

      {baru && (
        <Sheet judul="Kegiatan baru" onTutup={() => setBaru(false)}>
          <Field label="Tanggal">
            <input className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Lokasi">
            <input className="input" value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
          </Field>
          <Field label="Keterangan (opsional)">
            <input className="input" value={ket} onChange={(e) => setKet(e.target.value)} />
          </Field>
          <div className="aksi-bawah">
            <button className="btn" onClick={() => setBaru(false)}>Batal</button>
            <button className="btn utama" onClick={simpan} disabled={!tanggal}>Buat</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
