import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import fotoKunjungan from '../assets/foto/imunisasi.jpg'
import { Chip, Ikon, JudulKartu, KepalaHalaman, Kosong, inisial, warnaKategori } from '../components/ui'
import { formatUmur, perkiraanLahir, selisihHari, tglId, usiaHamil } from '../lib/age'
import { useKategori } from '../lib/hooks'
import { useTindakLanjut } from '../lib/tindakLanjut'

type Tab = 'hadir' | 'imunisasi' | 'hamil' | 'risiko'

export default function TindakLanjut() {
  const kategori = useKategori()
  const tl = useTindakLanjut()
  const { ref, jml, bayi, bumil, absen, risiko, jenisImunisasi } = tl
  const [tab, setTab] = useState<Tab>('imunisasi')
  const wargaMap = new Map(tl.semua.map((x) => [x.w.id!, x]))

  const TABS: Array<[Tab, string, number]> = [
    ['imunisasi', 'Imunisasi', bayi.length],
    ['hamil', 'Bumil', bumil.length],
    ['hadir', 'Absen', absen.length],
    ['risiko', 'Risiko', risiko.length],
  ]

  const baris = (id: number, sub: ReactNode, ekor?: ReactNode, bawah?: ReactNode) => {
    const x = wargaMap.get(id)
    if (!x) return null
    return (
      <Link key={id} to={`/warga/${id}`} className="item">
        <div className={`avatar ${warnaKategori(x.kode)}`}>{inisial(x.w.nama)}</div>
        <div className="isi">
          <div className="nama">{x.w.nama}</div>
          <div className="sub">{sub}</div>
          {bawah}
        </div>
        <span className="ujung">
          {ekor}
          <span className="btn-ikon"><Ikon nama="panah" ukuran={18} /></span>
        </span>
      </Link>
    )
  }

  const titikImun = (n: number) => (
    <div className="titik-imun" aria-label={`${n} dari ${jenisImunisasi} imunisasi`}>
      {Array.from({ length: jenisImunisasi }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
      <b>{n}/{jenisImunisasi}</b>
    </div>
  )

  return (
    <>
      <KepalaHalaman kembali={{ to: '/', label: 'Beranda' }} label="Perlu perhatian" judul="Tindak lanjut" sub="Warga yang perlu dihubungi atau dikunjungi bulan ini." />

      <div className="tab" role="tablist">
        {TABS.map(([k, l, n]) => (
          <button key={k} className={tab === k ? 'aktif' : ''} onClick={() => setTab(k)}>{l} <span className="lencana">{n}</span></button>
        ))}
      </div>

      {tab === 'imunisasi' && (
        <>
          <div className="banner peringatan"><Ikon nama="suntik" ukuran={22} /> Bayi 12-23 bulan dengan imunisasi dasar belum lengkap ({jenisImunisasi} jenis).</div>
          {bayi.length === 0 ? <div className="kartu"><Kosong judul="Tidak ada" teks="Semua bayi 12-23 bulan sudah lengkap, atau belum ada datanya." /></div> : (
            <div className="daftar grid">
              {bayi.map((x) => baris(x.w.id!, `${formatUmur(x.w.tanggalLahir, ref)} · RT ${x.w.rt}${x.w.namaOrtu ? ` · ortu ${x.w.namaOrtu}` : ''}`, undefined, titikImun(jml.get(x.w.id!) ?? 0)))}
            </div>
          )}
        </>
      )}

      {tab === 'hamil' && (
        <>
          <div className="banner info"><Ikon nama="hati" ukuran={22} /> Ibu hamil yang tercatat, diurutkan dari yang paling dekat waktu lahirnya.</div>
          {bumil.length === 0 ? <div className="kartu"><Kosong judul="Belum ada ibu hamil tercatat" teks="Catat HPHT dari halaman warga perempuan." /></div> : (
            <div className="daftar grid">
              {[...bumil].sort((a, b) => a.hpht.localeCompare(b.hpht)).map((k) => {
                const sisa = selisihHari(ref, perkiraanLahir(k.hpht))
                return baris(k.wargaId, `${usiaHamil(k.hpht, ref)} · HPL ${tglId(perkiraanLahir(k.hpht))}`, sisa <= 30 ? <Chip warna="merah" titik>{sisa < 0 ? 'Lewat HPL' : `${sisa} hari lagi`}</Chip> : undefined)
              })}
            </div>
          )}
        </>
      )}

      {tab === 'hadir' && (
        <>
          <div className="banner peringatan"><Ikon nama="jam" ukuran={22} /> Sasaran yang tidak hadir di 2 kegiatan terakhir{tl.adaKegiatan ? '' : ' (belum ada kegiatan)'}.</div>
          {absen.length === 0 ? <div className="kartu"><Kosong judul="Tidak ada" /></div> : (
            <>
              <div className="daftar grid">
                {absen.slice(0, 100).map((x) => baris(x.w.id!, <><span>{formatUmur(x.w.tanggalLahir, ref)} · RT {x.w.rt}</span><Chip warna={warnaKategori(x.kode)}>{kategori.find((k) => k.kode === x.kode)?.nama}</Chip></>))}
              </div>
              {absen.length > 100 && <p className="petunjuk">Menampilkan 100 pertama.</p>}
            </>
          )}
        </>
      )}

      {tab === 'risiko' && (
        <>
          <div className="banner bahaya"><Ikon nama="peringatan" ukuran={22} /> Penanda dari pemeriksaan terakhir. Ini bukan diagnosis; arahkan konsultasi ke bidan.</div>
          {risiko.length === 0 ? <div className="kartu"><Kosong judul="Tidak ada" /></div> : (
            <div className="daftar grid">
              {risiko.slice(0, 100).map((x) => baris(x.w.id!, (
                <>
                  <span>{formatUmur(x.w.tanggalLahir, ref)} · RT {x.w.rt}</span>
                  {x.tinggi && <Chip warna="merah">Tensi tinggi</Chip>}
                  {x.perutRisiko && <Chip warna="merah">Lingkar perut</Chip>}
                  {x.gizi && x.gizi !== 'Normal' && <Chip warna="merah">Gizi {x.gizi.toLowerCase()}</Chip>}
                </>
              )))}
            </div>
          )}
        </>
      )}

      <div className="dua-kolom seimbang" style={{ marginTop: 24 }}>
        <div className="kartu-gambar">
          <img src={fotoKunjungan} alt="" />
          <b>Jadwalkan kunjungan rumah</b>
          <p>Ajak orang tua dan warga datang di Posyandu berikutnya.</p>
        </div>
        <div className="kartu">
          <JudulKartu ikon="grafik">Ringkasan bulan ini</JudulKartu>
          <div className="grid2">
            {TABS.map(([k, l, n]) => (
              <button key={k} className="stat-datar krem" style={{ border: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => { setTab(k); window.scrollTo({ top: 0 }) }}>
                <div><b>{n}</b><span>{l}</span></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
