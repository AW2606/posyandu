import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Ikon, Kosong, inisial } from '../components/ui'
import { formatUmur, todayISO, tglId } from '../lib/age'
import { unduhTeks } from '../lib/csv'
import { useKategori, usePengaturan } from '../lib/hooks'
import { useWargaPlus, type WargaPlus } from '../lib/wargaData'

type Penanda = 'hamil' | 'menyusui' | 'T' | 'perut' | 'kurus' | 'gemuk'
const PENANDA: Array<{ k: Penanda; label: string; cocok: (x: WargaPlus) => boolean }> = [
  { k: 'hamil', label: 'Ibu hamil', cocok: (x) => x.hamil },
  { k: 'menyusui', label: 'Ibu menyusui', cocok: (x) => x.menyusui },
  { k: 'T', label: 'Tensi tinggi (T)', cocok: (x) => x.tinggi },
  { k: 'perut', label: 'Lingkar perut berisiko', cocok: (x) => x.perutRisiko },
  { k: 'kurus', label: 'Gizi kurus', cocok: (x) => x.gizi === 'Kurus' },
  { k: 'gemuk', label: 'Gizi gemuk', cocok: (x) => x.gizi === 'Gemuk' },
]

export default function WargaList() {
  const ref = todayISO()
  const semua = useWargaPlus(ref)
  const kategori = useKategori()
  const p = usePengaturan()
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('semua')
  const [rt, setRt] = useState('semua')
  const [penanda, setPenanda] = useState<Penanda[]>([])
  const [lanjut, setLanjut] = useState(false)

  const hitungKat = useMemo(() => {
    const m: Record<string, number> = { semua: 0 }
    for (const x of semua) {
      if (rt !== 'semua' && x.w.rt !== rt) continue
      m.semua++
      m[x.kode] = (m[x.kode] ?? 0) + 1
    }
    return m
  }, [semua, rt])

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase()
    const aktif = PENANDA.filter((x) => penanda.includes(x.k))
    return semua
      .filter((x) => (kat === 'semua' || x.kode === kat) && (rt === 'semua' || x.w.rt === rt))
      .filter((x) => !kata || x.w.nama.toLowerCase().includes(kata) || x.w.nik.includes(kata))
      .filter((x) => aktif.every((a) => a.cocok(x)))
      .sort((a, b) => a.w.nama.localeCompare(b.w.nama, 'id'))
  }, [semua, q, kat, rt, penanda])

  function ekspor() {
    const baris = [['nama', 'nik', 'tanggal_lahir', 'umur', 'jenis_kelamin', 'rt', 'kategori']]
    for (const x of hasil)
      baris.push([x.w.nama, x.w.nik, tglId(x.w.tanggalLahir), formatUmur(x.w.tanggalLahir, ref), x.w.jk, x.w.rt, kategori.find((k) => k.kode === x.kode)?.nama ?? ''])
    unduhTeks('warga.csv', baris.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv')
  }

  const toggle = (k: Penanda) => setPenanda((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  return (
    <>
      <div className="judul-halaman">
        <h2>Warga & Sasaran</h2>
        <Link className="btn utama" to="/warga/baru">
          <Ikon nama="tambah" ukuran={20} /> Tambah
        </Link>
      </div>

      <div className="cari" style={{ marginBottom: 10 }}>
        <Ikon nama="cari" />
        <input className="input" placeholder="Cari nama atau NIK" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
      </div>

      <div className="filter-baris" role="tablist" aria-label="Kategori sasaran">
        <button className={`pil ${kat === 'semua' ? 'aktif' : ''}`} onClick={() => setKat('semua')}>
          Semua<small>{hitungKat.semua ?? 0}</small>
        </button>
        {[...kategori].sort((a, b) => a.urutan - b.urutan).map((k) => (
          <button key={k.kode} className={`pil ${kat === k.kode ? 'aktif' : ''}`} onClick={() => setKat(k.kode)}>
            {k.nama}<small>{hitungKat[k.kode] ?? 0}</small>
          </button>
        ))}
      </div>
      <div className="filter-baris">
        <button className={`pil ${rt === 'semua' ? 'aktif' : ''}`} onClick={() => setRt('semua')}>Semua RT</button>
        {p.rtDaftar.map((r) => (
          <button key={r} className={`pil ${rt === r ? 'aktif' : ''}`} onClick={() => setRt(r)}>RT {r}</button>
        ))}
        <button className={`pil ${lanjut || penanda.length ? 'aktif' : ''}`} onClick={() => setLanjut(!lanjut)}>
          Penanda{penanda.length ? ` (${penanda.length})` : ''}
        </button>
      </div>
      {lanjut && (
        <div className="filter-baris" style={{ flexWrap: 'wrap' }}>
          {PENANDA.map((x) => (
            <button key={x.k} className={`pil ${penanda.includes(x.k) ? 'aktif' : ''}`} onClick={() => toggle(x.k)}>
              {x.label}
            </button>
          ))}
        </div>
      )}

      <div className="baris" style={{ justifyContent: 'space-between', margin: '4px 0 10px' }}>
        <span className="redup">{hasil.length} orang</span>
        {hasil.length > 0 && (
          <button className="btn kecil" onClick={ekspor}>Unduh CSV</button>
        )}
      </div>

      {semua.length === 0 ? (
        <div className="kartu">
          <Kosong judul="Belum ada data warga" teks="Impor dari berkas CSV, tambah satu per satu, atau muat data contoh untuk mencoba.">
            <div className="baris" style={{ justifyContent: 'center', marginTop: 12 }}>
              <Link className="btn utama" to="/warga/impor">Impor CSV</Link>
              <Link className="btn" to="/pengaturan">Muat data contoh</Link>
            </div>
          </Kosong>
        </div>
      ) : hasil.length === 0 ? (
        <Kosong judul="Tidak ada yang cocok" teks="Coba ubah kata kunci atau filter." />
      ) : (
        <div className="daftar">
          {hasil.slice(0, 200).map((x) => (
            <Link key={x.w.id} to={`/warga/${x.w.id}`} className="item">
              <div className="avatar">{inisial(x.w.nama)}</div>
              <div className="isi">
                <div className="nama">{x.w.nama}</div>
                <div className="sub">
                  <span>{x.w.jk === 'L' ? 'L' : 'P'} · {formatUmur(x.w.tanggalLahir, ref)} · RT {x.w.rt}</span>
                  <Chip warna="biru">{kategori.find((k) => k.kode === x.kode)?.nama}</Chip>
                  {x.hamil && <Chip warna="kuning">Hamil</Chip>}
                  {x.menyusui && <Chip warna="kuning">Menyusui</Chip>}
                  {x.tinggi && <Chip warna="merah">T</Chip>}
                  {x.perutRisiko && <Chip warna="merah">Perut</Chip>}
                  {x.gizi && x.gizi !== 'Normal' && <Chip warna="merah">{x.gizi}</Chip>}
                  {!x.w.nik && <Chip warna="abu">Tanpa NIK</Chip>}
                </div>
              </div>
              <Ikon nama="panah" ukuran={18} />
            </Link>
          ))}
          {hasil.length > 200 && <p className="petunjuk">Menampilkan 200 pertama. Persempit dengan pencarian atau filter.</p>}
        </div>
      )}
    </>
  )
}
