import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PeriksaSheet from '../components/PeriksaSheet'
import { Chip, ChipKategori, Field, Ikon, JudulKartu, KepalaHalaman, Konfirmasi, Kosong, Sheet, inisial, useToast, warnaKategori } from '../components/ui'
import { formatUmur, tglPanjang, todayISO } from '../lib/age'
import { useAuth } from '../lib/auth'
import { catat, db, NAMA_TAHAP, URUTAN_TAHAP, type Kunjungan } from '../lib/db'
import { KODE_TAHAP_WARNA, useKategoriMap, usePengaturan } from '../lib/hooks'
import { daftarkan } from '../lib/layanan'
import { useWargaPlus, type WargaPlus } from '../lib/wargaData'

type Tab = 'peserta' | 'belum' | 'obat'

export default function KegiatanDetail() {
  const kid = Number(useParams().id)
  const nav = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const p = usePengaturan()
  const katMap = useKategoriMap()
  const kegiatan = useLiveQuery(() => db.kegiatan.get(kid), [kid])
  const kunj = useLiveQuery(() => db.kunjungan.where('kegiatanId').equals(kid).sortBy('noAntrean'), [kid]) ?? []
  const periksa = useLiveQuery(() => db.pemeriksaan.where('kegiatanId').equals(kid).toArray(), [kid]) ?? []
  const obat = useLiveQuery(() => db.layananObat.where('kegiatanId').equals(kid).toArray(), [kid]) ?? []
  const semua = useWargaPlus(kegiatan?.tanggal ?? new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<Tab>('peserta')
  const [q, setQ] = useState('')
  const [rtF, setRtF] = useState('semua')
  const [buka, setBuka] = useState<number | null>(null)
  const [hapus, setHapus] = useState(false)
  const [obatBaru, setObatBaru] = useState(false)

  const wargaMap = useMemo(() => new Map(semua.map((x) => [x.w.id!, x])), [semua])
  const periksaMap = useMemo(() => new Map(periksa.map((x) => [x.kunjunganId, x])), [periksa])
  const terdaftar = useMemo(() => new Set(kunj.map((k) => k.wargaId)), [kunj])

  if (kegiatan === undefined) return null
  if (!kegiatan) return <Kosong judul="Kegiatan tidak ditemukan" />

  const kata = q.trim().toLowerCase()
  const cocok = (x: WargaPlus) => !kata || x.w.nama.toLowerCase().includes(kata) || x.w.nik.includes(kata)

  const hitungTahap = URUTAN_TAHAP.map((t) => ({
    t,
    n: kunj.filter((k) => URUTAN_TAHAP.indexOf(k.tahap) >= URUTAN_TAHAP.indexOf(t)).length,
  }))

  const daftarPeserta = kunj.filter((k) => {
    const x = wargaMap.get(k.wargaId)
    return x && cocok(x)
  })
  const hasilCari = kata ? semua.filter((x) => !terdaftar.has(x.w.id!) && cocok(x)).slice(0, 8) : []
  const belumHadir = semua
    .filter((x) => !terdaftar.has(x.w.id!) && (rtF === 'semua' || x.w.rt === rtF) && cocok(x))
    .sort((a, b) => a.w.nama.localeCompare(b.w.nama, 'id'))

  async function daftar(wargaId: number, nama: string) {
    const r = await daftarkan(kid, wargaId)
    toast(r.ok ? `${nama} didaftarkan` : (r.pesan ?? ''))
    if (r.ok) setQ('')
  }

  const aktif = buka ? kunj.find((k) => k.id === buka) : undefined
  const aktifW = aktif ? wargaMap.get(aktif.wargaId) : undefined
  const berikutnya = () => {
    const urut = kunj.filter((k) => !periksaMap.has(k.id!) && k.id !== buka)
    setBuka(urut[0]?.id ?? null)
    if (!urut[0]) toast('Semua peserta sudah diukur')
  }

  async function hapusKegiatan() {
    await db.transaction('rw', [db.kegiatan, db.kunjungan, db.pemeriksaan, db.layananObat], async () => {
      await db.pemeriksaan.where('kegiatanId').equals(kid).delete()
      await db.kunjungan.where('kegiatanId').equals(kid).delete()
      await db.layananObat.where('kegiatanId').equals(kid).delete()
      await db.kegiatan.delete(kid)
    })
    await catat('hapus', 'kegiatan', kegiatan!.tanggal)
    nav('/kegiatan', { replace: true })
  }

  const barisPeserta = (k: Kunjungan) => {
    const x = wargaMap.get(k.wargaId)
    if (!x) return null
    const pm = periksaMap.get(k.id!)
    const warnaNo = k.tahap === 'dilayani' ? 'hijau' : k.tahap === 'terdaftar' ? 'kuning' : ''
    return (
      <button key={k.id} className="item" onClick={() => setBuka(k.id!)}>
        <div className={`petak-no ${warnaNo}`}><small>NO</small><b>{k.noAntrean}</b></div>
        <div className="isi">
          <div className="nama">{x.w.nama}</div>
          <div className="sub">
            <span>{formatUmur(x.w.tanggalLahir, kegiatan.tanggal)} · RT {x.w.rt}{pm?.bb !== undefined ? ` · ${String(pm.bb).replace('.', ',')} kg` : ''}</span>
            <ChipKategori kode={x.kode} nama={katMap[x.kode]?.nama} />
            {x.hamil && <Chip warna="koral">Hamil</Chip>}
            {x.menyusui && <Chip warna="koral">Menyusui</Chip>}
          </div>
          <div className={`tahap ${k.tahap}`} style={{ marginTop: 10 }} aria-label={`Tahap ${NAMA_TAHAP[k.tahap]}`}>
            {URUTAN_TAHAP.map((t, i) => <i key={t} className={i <= URUTAN_TAHAP.indexOf(k.tahap) ? 'on' : ''} />)}
          </div>
        </div>
        <span className="ujung">
          <Chip warna={KODE_TAHAP_WARNA[k.tahap] as 'abu'} titik>{NAMA_TAHAP[k.tahap]}</Chip>
          {k.tahap === 'terdaftar'
            ? <span className="btn-ikon gelap" aria-hidden><Ikon nama="pensil" ukuran={17} /></span>
            : <span className="btn-ikon" aria-hidden><Ikon nama="panah" ukuran={18} /></span>}
        </span>
      </button>
    )
  }

  const hariIni = kegiatan.tanggal === todayISO()
  const WARNA_STAT: Record<string, string> = { terdaftar: '#6B7A73', terukur: '#3B82A8', tercatat: '#E09A1B', dilayani: '#2E8B6A' }

  return (
    <>
      <KepalaHalaman
        kembali={{ to: '/kegiatan', label: 'Hari Posyandu' }}
        label={hariIni ? 'Meja layanan · Hari ini' : 'Meja layanan'}
        judul={tglPanjang(kegiatan.tanggal)}
        sub={kegiatan.lokasi}
      >
        <Link className="btn" to="/laporan">
          <Ikon nama="cetak" ukuran={20} /> Cetak laporan
        </Link>
      </KepalaHalaman>

      <div className="grid4" style={{ marginBottom: 24 }}>
        {hitungTahap.map(({ t, n }) => (
          <div key={t} className="stat-garis">
            <i style={{ background: WARNA_STAT[t] }} />
            <div><b>{n}</b><span>{NAMA_TAHAP[t]}</span></div>
          </div>
        ))}
      </div>

      <div className="tab" role="tablist">
        <button className={tab === 'peserta' ? 'aktif' : ''} onClick={() => setTab('peserta')}>Peserta <span className="lencana">{kunj.length}</span></button>
        <button className={tab === 'belum' ? 'aktif' : ''} onClick={() => setTab('belum')}>Belum hadir <span className="lencana">{Math.max(0, semua.length - kunj.length)}</span></button>
        <button className={tab === 'obat' ? 'aktif' : ''} onClick={() => setTab('obat')}>Obat/Vitamin <span className="lencana">{obat.length}</span></button>
      </div>

      {tab !== 'obat' && (
        <div className="cari" style={{ marginBottom: 24 }}>
          <Ikon nama="cari" />
          <input className="input" placeholder={tab === 'peserta' ? 'Cari atau daftarkan: nama / NIK' : 'Cari nama / NIK'} value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
        </div>
      )}

      {tab === 'peserta' && (
        <>
          {hasilCari.length > 0 && (
            <div className="kartu" style={{ background: 'var(--mint)', boxShadow: 'none' }}>
              <JudulKartu ikon="tambah" warna="krem">Belum terdaftar hari ini</JudulKartu>
              <div className="daftar">
                {hasilCari.map((x) => (
                  <div key={x.w.id} className="item" style={{ cursor: 'default' }}>
                    <div className={`avatar ${warnaKategori(x.kode)}`}>{inisial(x.w.nama)}</div>
                    <div className="isi">
                      <div className="nama">{x.w.nama}</div>
                      <div className="sub"><span>{formatUmur(x.w.tanggalLahir, kegiatan.tanggal)} · RT {x.w.rt}</span><ChipKategori kode={x.kode} nama={katMap[x.kode]?.nama} /></div>
                    </div>
                    <button className="btn utama kecil" onClick={() => daftar(x.w.id!, x.w.nama)}><Ikon nama="tambah" ukuran={18} /> Daftarkan</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {kata && hasilCari.length === 0 && daftarPeserta.length === 0 && (
            <div className="kartu">
              <Kosong judul="Tidak ditemukan" teks="Warga belum ada di data.">
                <Link className="btn utama" style={{ marginTop: 14 }} to={`/warga/baru?nama=${encodeURIComponent(q)}&daftarKe=${kid}`}>
                  <Ikon nama="tambah" ukuran={20} /> Tambah “{q}” & daftarkan
                </Link>
              </Kosong>
            </div>
          )}
          {kunj.length === 0 && !kata ? (
            <div className="kartu">
              <Kosong judul="Belum ada peserta" teks="Ketik nama di kolom cari untuk mendaftarkan warga ke antrean, atau lihat tab Belum hadir." />
            </div>
          ) : (
            <div className="daftar">{daftarPeserta.map(barisPeserta)}</div>
          )}
        </>
      )}

      {tab === 'belum' && (
        <>
          <div className="filter-baris">
            <button className={`pil ${rtF === 'semua' ? 'aktif' : ''}`} onClick={() => setRtF('semua')}>Semua RT</button>
            {p.rtDaftar.map((r) => (
              <button key={r} className={`pil ${rtF === r ? 'aktif' : ''}`} onClick={() => setRtF(r)}>RT {r}</button>
            ))}
          </div>
          {belumHadir.length === 0 ? (
            <Kosong judul="Semua sasaran sudah terdaftar" />
          ) : (
            <div className="daftar">
              {belumHadir.slice(0, 100).map((x) => (
                <div key={x.w.id} className="item" style={{ cursor: 'default' }}>
                  <div className={`avatar ${warnaKategori(x.kode)}`}>{inisial(x.w.nama)}</div>
                  <div className="isi">
                    <div className="nama">{x.w.nama}</div>
                    <div className="sub"><span>{formatUmur(x.w.tanggalLahir, kegiatan.tanggal)} · RT {x.w.rt}</span><ChipKategori kode={x.kode} nama={katMap[x.kode]?.nama} /></div>
                  </div>
                  <button className="btn kecil" onClick={() => daftar(x.w.id!, x.w.nama)}><Ikon nama="tambah" ukuran={18} /> Daftarkan</button>
                </div>
              ))}
              {belumHadir.length > 100 && <p className="petunjuk">Menampilkan 100 pertama.</p>}
            </div>
          )}
        </>
      )}

      {tab === 'obat' && (
        <>
          <button className="btn utama penuh" style={{ marginBottom: 12 }} onClick={() => setObatBaru(true)} disabled={kunj.length === 0}>
            <Ikon nama="tambah" ukuran={20} /> Catat pemberian
          </button>
          {kunj.length === 0 && <p className="petunjuk">Daftarkan peserta dulu, lalu catat pemberian obat atau vitamin.</p>}
          {obat.length === 0 ? (
            <Kosong judul="Belum ada pemberian tercatat" />
          ) : (
            <div className="daftar">
              {obat.map((o) => {
                const x = wargaMap.get(o.wargaId)
                return (
                  <div key={o.id} className="item" style={{ cursor: 'default' }}>
                    {x && <div className={`avatar ${warnaKategori(x.kode)}`}>{inisial(x.w.nama)}</div>}
                    <div className="isi">
                      <div className="nama">{x?.w.nama}</div>
                      <div className="sub"><Chip warna="biru">{o.jenis}</Chip><span>{o.keterangan}</span></div>
                    </div>
                    <button className="btn kecil bahaya" onClick={() => db.layananObat.delete(o.id!)}>Hapus</button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {isAdmin && (
        <div style={{ marginTop: 28 }}>
          <button className="btn bahaya kecil" onClick={() => setHapus(true)}><Ikon nama="arsip" ukuran={18} /> Hapus kegiatan ini</button>
        </div>
      )}

      {aktif && aktifW && (
        <PeriksaSheet
          key={aktif.id}
          kegiatan={kegiatan}
          kunjungan={aktif}
          warga={aktifW.w}
          kode={aktifW.kode}
          ada={periksaMap.get(aktif.id!)}
          onTutup={() => setBuka(null)}
          onBerikutnya={berikutnya}
        />
      )}

      {obatBaru && (
        <FormObat
          kegiatanId={kid}
          peserta={kunj.map((k) => wargaMap.get(k.wargaId)).filter((x): x is WargaPlus => !!x)}
          jenisObat={p.jenisObat}
          onTutup={() => setObatBaru(false)}
        />
      )}

      {hapus && (
        <Konfirmasi
          judul="Hapus kegiatan?"
          teks={`Kegiatan ${tglPanjang(kegiatan.tanggal)} beserta ${kunj.length} peserta dan semua hasil pemeriksaannya akan dihapus permanen.`}
          labelYa="Hapus permanen"
          bahaya
          onYa={hapusKegiatan}
          onBatal={() => setHapus(false)}
        />
      )}
    </>
  )
}

function FormObat({
  kegiatanId,
  peserta,
  jenisObat,
  onTutup,
}: {
  kegiatanId: number
  peserta: WargaPlus[]
  jenisObat: string[]
  onTutup: () => void
}) {
  const toast = useToast()
  const [jenis, setJenis] = useState(jenisObat[0] ?? 'Obat Cacing')
  const [ket, setKet] = useState('Diterima langsung')
  const [q, setQ] = useState('')
  const [dipilih, setDipilih] = useState<Set<number>>(new Set())
  const pilihanKet = jenis.toLowerCase().includes('vitamin') ? ['Merah', 'Biru'] : ['Diterima langsung', 'Dititipkan']
  const daftar = peserta.filter((x) => x.w.nama.toLowerCase().includes(q.trim().toLowerCase()))

  const toggle = (id: number) =>
    setDipilih((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  async function simpan() {
    const ada = await db.layananObat.where('kegiatanId').equals(kegiatanId).filter((o) => o.jenis === jenis).toArray()
    const sudah = new Set(ada.map((o) => o.wargaId))
    const baru = [...dipilih].filter((id) => !sudah.has(id))
    await db.layananObat.bulkAdd(baru.map((wargaId) => ({ kegiatanId, wargaId, jenis, keterangan: ket })))
    toast(`${baru.length} pemberian dicatat${baru.length < dipilih.size ? ' (sebagian sudah ada)' : ''}`)
    onTutup()
  }

  return (
    <Sheet judul="Catat pemberian" sub="Obat cacing atau vitamin" ikon="suntik" onTutup={onTutup}>
      <Field label="Jenis">
        <select className="input" value={jenis} onChange={(e) => { setJenis(e.target.value); setKet(e.target.value.toLowerCase().includes('vitamin') ? 'Merah' : 'Diterima langsung') }}>
          {jenisObat.map((j) => <option key={j}>{j}</option>)}
        </select>
      </Field>
      <div className="field">
        <span className="lbl">Keterangan</span>
        <div className="tab krem" style={{ marginBottom: 0 }}>
          {pilihanKet.map((o) => <button key={o} className={ket === o ? 'aktif' : ''} onClick={() => setKet(o)}>{o}</button>)}
        </div>
      </div>
      <Field label={`Penerima (${dipilih.size} dipilih)`}>
        <input className="input" placeholder="Cari nama peserta" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <div className="daftar" style={{ maxHeight: '36dvh', overflowY: 'auto' }}>
        {daftar.map((x) => (
          <button key={x.w.id} className="item" onClick={() => toggle(x.w.id!)} style={dipilih.has(x.w.id!) ? { background: 'var(--mint)', boxShadow: 'inset 0 0 0 2px var(--hijau-segar)' } : { boxShadow: 'inset 0 0 0 1.5px var(--garis)' }}>
            <div className={`avatar ${dipilih.has(x.w.id!) ? '' : 'krem'}`}>{dipilih.has(x.w.id!) ? <Ikon nama="centang" ukuran={22} tebal={2.6} /> : inisial(x.w.nama)}</div>
            <div className="isi">
              <div className="nama">{x.w.nama}</div>
              <div className="sub">{x.w.jk} · RT {x.w.rt}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="aksi-bawah">
        <button className="btn" onClick={onTutup}>Batal</button>
        <button className="btn utama" onClick={simpan} disabled={!dipilih.size}>Simpan</button>
      </div>
    </Sheet>
  )
}
