import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AksiPilihan, BilahPilih, Centang, teksHapusBanyak, usePilihan } from '../components/Pilihan'
import { Chip, ChipKategori, Ikon, KepalaHalaman, Konfirmasi, Kosong, hexKategori, inisial, useToast, warnaKategori } from '../components/ui'
import { formatUmur, todayISO, tglId } from '../lib/age'
import { useAuth } from '../lib/auth'
import { unduhTeks } from '../lib/csv'
import { aturArsipWarga, db, hapusWargaPermanen } from '../lib/db'
import { useKategori, usePengaturan } from '../lib/hooks'
import { useWargaPlus, type WargaPlus } from '../lib/wargaData'

type Penanda = 'hamil' | 'menyusui' | 'T' | 'perut' | 'kurus' | 'gemuk'
const PENANDA: Array<{ k: Penanda; label: string; cocok: (x: WargaPlus) => boolean }> = [
  { k: 'hamil', label: 'Ibu hamil', cocok: (x) => x.hamil },
  { k: 'menyusui', label: 'Ibu menyusui', cocok: (x) => x.menyusui },
  { k: 'T', label: 'Tensi tinggi (T)', cocok: (x) => x.tinggi },
  { k: 'perut', label: 'Lingkar perut berisiko (LP)', cocok: (x) => x.perutRisiko },
  { k: 'kurus', label: 'Gizi kurus', cocok: (x) => x.gizi === 'Kurus' },
  { k: 'gemuk', label: 'Gizi gemuk', cocok: (x) => x.gizi === 'Gemuk' },
]

export default function WargaList() {
  const ref = todayISO()
  const semua = useWargaPlus(ref)
  const kategori = useKategori()
  const p = usePengaturan()
  const { isAdmin } = useAuth()
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
    const baris = [['nama', 'nik', 'tanggal_lahir', 'umur', 'jenis_kelamin', 'rt', 'kategori', 'no_kk', 'nama_ortu', 'nik_ortu']]
    for (const x of hasil)
      baris.push([x.w.nama, x.w.nik, tglId(x.w.tanggalLahir), formatUmur(x.w.tanggalLahir, ref), x.w.jk, x.w.rt, kategori.find((k) => k.kode === x.kode)?.nama ?? '', x.w.noKK, x.w.namaOrtu, x.w.nikOrtu ?? ''])
    unduhTeks('warga.csv', baris.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv')
  }

  const toggle = (k: Penanda) => setPenanda((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const jumlahArsip = useLiveQuery(() => db.warga.filter((w) => !w.aktif).count()) ?? 0
  const toast = useToast()
  const pilih = usePilihan()
  const idHasil = useMemo(() => hasil.map((x) => x.w.id!), [hasil])
  const [konf, setKonf] = useState<null | 'arsip' | { teks: string }>(null)
  const [sibuk, setSibuk] = useState(false)

  async function mintaHapus() {
    setKonf({ teks: await teksHapusBanyak([...pilih.ids]) })
  }
  async function jalankan(aksi: () => Promise<string>) {
    if (sibuk) return
    setSibuk(true)
    try {
      toast(await aksi())
      pilih.selesai()
    } finally {
      setSibuk(false)
      setKonf(null)
    }
  }
  const katUrut = [...kategori].sort((a, b) => a.urutan - b.urutan)
  const nHamil = semua.filter((x) => x.hamil).length

  return (
    <>
      <KepalaHalaman label="Data sasaran" judul="Warga & Sasaran" sub="Cari warga, lihat kategori, dan buka riwayat pemeriksaannya.">
        <Link className="btn ajakan" to="/warga/baru">
          <Ikon nama="tambah" ukuran={20} /> Tambah warga
        </Link>
        {hasil.length > 0 && (
          <button className="btn" onClick={ekspor}><Ikon nama="unduh" ukuran={20} /> Unduh CSV</button>
        )}
        {isAdmin && (
          <Link className="btn" to="/warga/arsip"><Ikon nama="arsip" ukuran={20} /> Arsip{jumlahArsip ? <span className="lencana">{jumlahArsip}</span> : null}</Link>
        )}
      </KepalaHalaman>

      {semua.length > 0 && (
        <div className="grid4" style={{ marginBottom: 24 }}>
          <div className="stat-datar mint"><span className="petak-stat"><Ikon nama="warga" ukuran={22} /></span><div><b>{semua.length}</b><span>Total sasaran</span></div></div>
          <div className="stat-datar kuning"><span className="petak-stat"><Ikon nama="bayi" ukuran={22} /></span><div><b>{semua.filter((x) => x.kode === 'balita').length}</b><span>Balita</span></div></div>
          <div className="stat-datar koral"><span className="petak-stat"><Ikon nama="hati" ukuran={22} /></span><div><b>{nHamil}</b><span>Ibu hamil</span></div></div>
          <div className="stat-datar biru"><span className="petak-stat"><Ikon nama="orang" ukuran={22} /></span><div><b>{semua.filter((x) => x.kode === 'lansia').length}</b><span>Lansia</span></div></div>
        </div>
      )}

      <div className="cari" style={{ marginBottom: 20 }}>
        <Ikon nama="cari" />
        <input className="input" placeholder="Cari nama atau NIK" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
      </div>

      <div className="filter-baris" role="tablist" aria-label="Kategori sasaran">
        <button className={`pil ${kat === 'semua' ? 'aktif' : ''}`} onClick={() => setKat('semua')}>
          Semua<small>{hitungKat.semua ?? 0}</small>
        </button>
        {katUrut.map((k, i) => (
          <button key={k.kode} className={`pil ${kat === k.kode ? 'aktif' : ''}`} onClick={() => setKat(k.kode)}>
            <i className="titik-warna" style={{ background: hexKategori(k.kode, i) }} />
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
          <i className="titik-warna" style={{ background: '#B93A28' }} />
          Penanda risiko{penanda.length ? <small>{penanda.length}</small> : null}
        </button>
      </div>
      {lanjut && (
        <div className="filter-baris" style={{ flexWrap: 'wrap' }}>
          {PENANDA.map((x) => (
            <button key={x.k} className={`pil ${penanda.includes(x.k) ? 'aktif' : ''}`} onClick={() => toggle(x.k)}>
              {penanda.includes(x.k) && <Ikon nama="centang" ukuran={16} tebal={2.6} />}
              {x.label}
            </button>
          ))}
        </div>
      )}

      {isAdmin ? (
        <BilahPilih p={pilih} terlihat={idHasil} teks={`Menampilkan ${hasil.length} orang · urut nama`} />
      ) : (
        <p className="redup" style={{ margin: '14px 0 16px', fontWeight: 600, fontSize: 15 }}>Menampilkan {hasil.length} orang · urut nama</p>
      )}

      {semua.length === 0 ? (
        <div className="kartu">
          <Kosong
            judul="Belum ada data warga"
            teks={isAdmin ? 'Impor dari berkas CSV, tambah satu per satu, atau muat data contoh untuk mencoba.' : 'Tambahkan warga satu per satu dengan tombol Tambah.'}
          >
            {isAdmin && (
              <div className="baris" style={{ justifyContent: 'center', marginTop: 16 }}>
                <Link className="btn utama" to="/warga/impor"><Ikon nama="unggah" ukuran={20} /> Impor CSV</Link>
                <Link className="btn" to="/pengaturan">Muat data contoh</Link>
              </div>
            )}
          </Kosong>
        </div>
      ) : hasil.length === 0 ? (
        <Kosong judul="Tidak ada yang cocok" teks="Coba ubah kata kunci atau filter." />
      ) : (
        <>
          <div className="daftar grid">
            {hasil.slice(0, 200).map((x) => {
              const isi = (
                <>
                  <div className={`avatar ${warnaKategori(x.kode)}`}>{inisial(x.w.nama)}</div>
                  <div className="isi">
                    <div className="nama">{x.w.nama}</div>
                    <div className="sub">
                      <span>{x.w.jk === 'L' ? 'L' : 'P'} · {formatUmur(x.w.tanggalLahir, ref)} · RT {x.w.rt}</span>
                      <ChipKategori kode={x.kode} nama={kategori.find((k) => k.kode === x.kode)?.nama} />
                      {x.hamil && <Chip warna="koral">Hamil</Chip>}
                      {x.menyusui && <Chip warna="koral">Menyusui</Chip>}
                      {x.tinggi && <Chip warna="merah">Tensi tinggi</Chip>}
                      {x.perutRisiko && <Chip warna="merah">Lingkar perut</Chip>}
                      {x.gizi && x.gizi !== 'Normal' && <Chip warna="merah">Gizi {x.gizi.toLowerCase()}</Chip>}
                      {!x.w.nik && <Chip warna="abu">Tanpa NIK</Chip>}
                    </div>
                  </div>
                </>
              )
              if (pilih.aktif) {
                const on = pilih.ids.has(x.w.id!)
                return (
                  <button key={x.w.id} type="button" className={`item ${on ? 'terpilih' : ''}`} onClick={() => pilih.toggle(x.w.id!)} aria-pressed={on}>
                    <Centang on={on} />
                    {isi}
                  </button>
                )
              }
              return (
                <Link key={x.w.id} to={`/warga/${x.w.id}`} className="item">
                  {isi}
                  <span className="btn-ikon"><Ikon nama="panah" ukuran={18} /></span>
                </Link>
              )
            })}
          </div>
          {hasil.length > 200 && <p className="petunjuk">Menampilkan 200 pertama di layar. {pilih.aktif ? `"Pilih semua" tetap memilih ke-${hasil.length} warga yang cocok.` : 'Persempit dengan pencarian atau filter.'}</p>}
        </>
      )}

      <AksiPilihan p={pilih}>
        <button className="btn lembut" onClick={() => setKonf('arsip')}><Ikon nama="arsip" ukuran={18} /> Arsipkan</button>
        <button className="btn bahaya" onClick={mintaHapus}><Ikon nama="tutup" ukuran={18} /> Hapus permanen</button>
      </AksiPilihan>

      {konf === 'arsip' && (
        <Konfirmasi
          judul={`Arsipkan ${pilih.ids.size} warga?`}
          teks="Warga terpilih disembunyikan dari daftar, meja layanan, dan laporan. Riwayatnya tetap tersimpan dan bisa dipulihkan dari halaman Arsip warga."
          labelYa={sibuk ? 'Mengarsipkan…' : 'Arsipkan'}
          onYa={() => jalankan(async () => `${await aturArsipWarga([...pilih.ids], false)} warga diarsipkan`)}
          onBatal={() => setKonf(null)}
        />
      )}
      {konf && typeof konf === 'object' && (
        <Konfirmasi
          judul={`Hapus permanen ${pilih.ids.size} warga?`}
          teks={konf.teks}
          labelYa={sibuk ? 'Menghapus…' : 'Hapus permanen'}
          bahaya
          onYa={() => jalankan(async () => `${await hapusWargaPermanen([...pilih.ids])} warga dihapus`)}
          onBatal={() => setKonf(null)}
        />
      )}
    </>
  )
}
