import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AksiPilihan, BilahPilih, Centang, teksHapusBanyak, usePilihan } from '../components/Pilihan'
import { ChipKategori, Ikon, KepalaHalaman, Konfirmasi, Kosong, inisial, useToast, warnaKategori } from '../components/ui'
import { formatUmur, kategoriDari, todayISO } from '../lib/age'
import { aturArsipWarga, db, hapusWargaPermanen, hitungDataWarga, type Warga } from '../lib/db'
import { useKategori } from '../lib/hooks'

/** Daftar warga yang diarsipkan. Khusus admin: pulihkan atau hapus permanen, satu per satu atau sekaligus. */
export default function WargaArsip() {
  const toast = useToast()
  const kategori = useKategori()
  const ref = todayISO()
  const arsip = useLiveQuery(() => db.warga.filter((w) => !w.aktif).toArray()) ?? []
  const pilih = usePilihan()
  const [q, setQ] = useState('')
  const [hapus, setHapus] = useState<{ ids: number[]; judul: string; teks: string } | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const hasil = useMemo(() => {
    const k = q.trim().toLowerCase()
    return arsip
      .filter((w) => !k || w.nama.toLowerCase().includes(k) || w.nik.includes(k))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }, [arsip, q])
  const idHasil = useMemo(() => hasil.map((w) => w.id!), [hasil])

  async function pulihkan(ids: number[], nama?: string) {
    if (sibuk) return
    setSibuk(true)
    const n = await aturArsipWarga(ids, true)
    setSibuk(false)
    toast(nama ? `${nama} dipulihkan` : `${n} warga dipulihkan`)
    pilih.selesai()
  }

  async function mintaHapusSatu(w: Warga) {
    const n = await hitungDataWarga(w.id!)
    const ikut = [n.kunjungan && `${n.kunjungan} kunjungan`, n.pemeriksaan && `${n.pemeriksaan} hasil pemeriksaan`, n.lain && `${n.lain} catatan lain`].filter(Boolean).join(', ')
    setHapus({
      ids: [w.id!],
      judul: 'Hapus permanen?',
      teks: `${w.nama} akan dihapus permanen${ikut ? ` beserta ${ikut}` : ''}. Data yang dihapus tidak bisa dikembalikan dan juga hilang dari laporan bulan-bulan sebelumnya.`,
    })
  }

  async function mintaHapusBanyak() {
    const ids = [...pilih.ids]
    setHapus({ ids, judul: `Hapus permanen ${ids.length} warga?`, teks: await teksHapusBanyak(ids) })
  }

  return (
    <>
      <KepalaHalaman
        kembali={{ to: '/warga', label: 'Warga' }}
        label="Khusus admin"
        judul="Arsip warga"
        sub="Warga yang diarsipkan tidak muncul di daftar, meja layanan, dan laporan. Pulihkan bila perlu, atau hapus permanen."
      />

      <div className="cari" style={{ marginBottom: 6 }}>
        <Ikon nama="cari" />
        <input className="input" placeholder="Cari nama atau NIK di arsip" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
      </div>

      <BilahPilih p={pilih} terlihat={idHasil} teks={`${hasil.length} warga diarsipkan`} />

      {arsip.length === 0 ? (
        <div className="kartu"><Kosong judul="Arsip kosong" teks="Warga yang diarsipkan dari halaman Warga atau detail warga akan muncul di sini." /></div>
      ) : hasil.length === 0 ? (
        <div className="kartu"><Kosong judul="Tidak ada yang cocok" teks="Coba kata kunci lain." /></div>
      ) : (
        <div className="daftar grid">
          {hasil.map((w) => {
            const kat = kategoriDari(w.tanggalLahir, ref, kategori)
            const isi = (
              <>
                <div className={`avatar ${warnaKategori(kat?.kode)}`}>{inisial(w.nama)}</div>
                <div className="isi">
                  <div className="nama">{w.nama}</div>
                  <div className="sub">
                    <span>{w.jk} · {formatUmur(w.tanggalLahir, ref)} · RT {w.rt}</span>
                    <ChipKategori kode={kat?.kode} nama={kat?.nama} />
                  </div>
                </div>
              </>
            )
            if (pilih.aktif) {
              const on = pilih.ids.has(w.id!)
              return (
                <button key={w.id} type="button" className={`item ${on ? 'terpilih' : ''}`} onClick={() => pilih.toggle(w.id!)} aria-pressed={on}>
                  <Centang on={on} />
                  {isi}
                </button>
              )
            }
            return (
              <div key={w.id} className="item item-arsip">
                <Link to={`/warga/${w.id}`} className="item-arsip-atas">
                  {isi}
                  <span className="btn-ikon"><Ikon nama="panah" ukuran={18} /></span>
                </Link>
                <div className="akun-aksi">
                  <button className="btn kecil lembut" onClick={() => pulihkan([w.id!], w.nama)}><Ikon nama="ulang" ukuran={16} /> Pulihkan</button>
                  <button className="btn kecil bahaya" onClick={() => mintaHapusSatu(w)}><Ikon nama="tutup" ukuran={16} /> Hapus permanen</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AksiPilihan p={pilih}>
        <button className="btn lembut" onClick={() => pulihkan([...pilih.ids])} disabled={sibuk}><Ikon nama="ulang" ukuran={18} /> Pulihkan</button>
        <button className="btn bahaya" onClick={mintaHapusBanyak}><Ikon nama="tutup" ukuran={18} /> Hapus permanen</button>
      </AksiPilihan>

      {hapus && (
        <Konfirmasi
          judul={hapus.judul}
          teks={hapus.teks}
          labelYa={sibuk ? 'Menghapus…' : 'Hapus permanen'}
          bahaya
          onYa={async () => {
            if (sibuk) return
            setSibuk(true)
            const n = await hapusWargaPermanen(hapus.ids)
            setSibuk(false)
            toast(hapus.ids.length === 1 ? 'Warga dihapus' : `${n} warga dihapus`)
            setHapus(null)
            pilih.selesai()
          }}
          onBatal={() => setHapus(null)}
        />
      )}
    </>
  )
}
