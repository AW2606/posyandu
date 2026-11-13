import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import fotoHero from '../assets/foto/timbang-bayi.jpg'
import { Angka, Cincin, GrafikBatang, GrafikDonat, Ikon, JudulKartu, Kosong, PALET, hexKategori, inisial, warnaKategori } from '../components/ui'
import { tglPanjang, todayISO, umurBulan } from '../lib/age'
import { statusGiziWarga } from '../lib/gizi'
import { useAuth } from '../lib/auth'
import { useStatusSinkron } from '../lib/cloud'
import { db, URUTAN_TAHAP, NAMA_TAHAP } from '../lib/db'
import { hitungIMT, rekapRisiko, statusGizi } from '../lib/health'
import { salam, teksSinkron } from '../lib/tampilan'
import { pilihKegiatanAktif, useKategori, useKegiatanList, usePengaturan } from '../lib/hooks'
import { useTindakLanjut } from '../lib/tindakLanjut'
import { useWargaPlus } from '../lib/wargaData'

export default function Dashboard() {
  const list = useKegiatanList()
  const { user, isAdmin, isSuper } = useAuth()
  const p = usePengaturan()
  const kategori = useKategori()
  const sinkron = teksSinkron(useStatusSinkron())
  const tl = useTindakLanjut()
  const [pilih, setPilih] = useState<number | null>(null)
  const kegiatan = list.find((k) => k.id === pilih) ?? pilihKegiatanAktif(list)
  const ref = kegiatan?.tanggal ?? todayISO()
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
    // gunakan data kegiatan ini, bukan pemeriksaan terakhir secara umum
    const risiko = rekapRisiko(
      peserta.flatMap((x) => {
        const t = pm.get(x!.w.id!)
        if (!t) return []
        // anak dinilai dengan standar WHO, dewasa dengan IMT seperti sebelumnya
        const gizi = statusGiziWarga({ jk: x!.w.jk, umurBln: umurBulan(x!.w.tanggalLahir, t.tanggal), bb: t.bb, tb: t.tb }, (bb, tb) => statusGizi(hitungIMT(bb, tb), p.ambang))
        return [{ ...t, jk: x!.w.jk, gizi }]
      }),
      p.ambang,
    )
    const tahap = URUTAN_TAHAP.map((t) => ({ t, n: kunj.filter((k) => URUTAN_TAHAP.indexOf(k.tahap) >= URUTAN_TAHAP.indexOf(t)).length }))
    return { n: peserta.length, perKat, perRT, ...risiko, tahap, terukur: periksa.length }
  }, [semua, kunj, periksa, p.ambang])

  const sasaran = semua.length
  const persen = sasaran ? Math.round((d.n / sasaran) * 100) : 0
  const namaPanggil = user?.nama.split(' ')[0] ?? ''
  const hariIni = kegiatan?.tanggal === todayISO()
  const wargaMap = new Map(tl.semua.map((x) => [x.w.id!, x]))
  const contohTL = tl.ids.slice(0, 3).map((id) => wargaMap.get(id)).filter((x) => !!x)

  return (
    <>
      <div className="sapaan">
        <div>
          <h2>{salam()}, {namaPanggil}</h2>
          <p>Ini ringkasan Posyandu hari ini. Semangat melayani warga!</p>
        </div>
        <span className="pil-status"><Ikon nama="awan" ukuran={20} /> {sinkron.judul}</span>
      </div>

      {list.length === 0 ? (
        <div className="kartu">
          <Kosong judul={sasaran ? 'Belum ada kegiatan' : 'Selamat datang di Posyandu Bangau'} teks={sasaran ? 'Buat kegiatan untuk tanggal Posyandu berikutnya.' : 'Mulai dengan memasukkan data warga atau memuat data contoh untuk mencoba.'}>
            <div className="baris" style={{ justifyContent: 'center', marginTop: 16 }}>
              {sasaran ? (
                <Link className="btn utama" to="/kegiatan"><Ikon nama="tambah" ukuran={20} /> Buat kegiatan</Link>
              ) : isAdmin ? (
                <>
                  <Link className="btn utama" to="/warga/impor"><Ikon nama="unggah" ukuran={20} /> Impor data warga</Link>
                  {isSuper && <Link className="btn" to="/pengaturan">Muat data contoh</Link>}
                </>
              ) : (
                <Link className="btn utama" to="/warga/baru"><Ikon nama="tambah" ukuran={20} /> Tambah warga</Link>
              )}
            </div>
          </Kosong>
        </div>
      ) : (
        <>
          <section className="hero">
            <img className="hero-foto" src={fotoHero} alt="" />
            <div className="hero-isi">
              <div className="hero-label">
                {hariIni ? <span className="chip-hari">HARI INI</span> : <span className="chip-hari">{kegiatan && kegiatan.tanggal > todayISO() ? 'AKAN DATANG' : 'TERAKHIR'}</span>}
                Kegiatan Posyandu
              </div>
              <h3>{kegiatan && tglPanjang(kegiatan.tanggal)}</h3>
              <p className="hero-lokasi"><Ikon nama="lokasi" ukuran={18} /> {kegiatan?.lokasi || `Posyandu Bangau, ${p.dusun} ${p.desa}`}</p>
              <div className="hero-aksi">
                <Link className="btn ajakan besar" to={`/kegiatan/${kegiatan?.id}`}>
                  <Ikon nama="layanan" ukuran={20} /> Buka meja layanan
                </Link>
                {list.length > 1 && (
                  <label className="pilih-kegiatan">
                    <select value={kegiatan?.id} onChange={(e) => setPilih(Number(e.target.value))} aria-label="Ganti kegiatan">
                      {list.map((k) => <option key={k.id} value={k.id}>{tglPanjang(k.tanggal)}</option>)}
                    </select>
                    <Ikon nama="bawah" ukuran={18} />
                  </label>
                )}
              </div>
            </div>
            <div className="hero-cincin">
              <div className="wadah">
                <Cincin persen={persen} tebal={10} />
                <b><Angka nilai={persen} />%</b>
              </div>
              <span>hadir dari {sasaran} sasaran</span>
            </div>
          </section>

          <div className="grid4" style={{ marginBottom: 24 }}>
            <div className="stat warna mint"><span className="petak-stat"><Ikon nama="warga" ukuran={22} /></span><div className="angka"><Angka nilai={d.n} /></div><div className="lbl">Peserta hadir</div></div>
            <div className="stat warna biru"><span className="petak-stat"><Ikon nama="penggaris" ukuran={22} /></span><div className="angka"><Angka nilai={d.terukur} /></div><div className="lbl">Sudah diukur</div></div>
            <div className="stat warna koral"><span className="petak-stat"><Ikon nama="jam" ukuran={22} /></span><div className="angka"><Angka nilai={Math.max(0, sasaran - d.n)} /></div><div className="lbl">Belum hadir</div></div>
            <div className="stat warna kuning"><span className="petak-stat"><Ikon nama="lonceng" ukuran={22} /></span><div className="angka"><Angka nilai={tl.total} /></div><div className="lbl">Perlu tindak lanjut</div></div>
          </div>

          <Link className="pita-tindak" to="/tindak-lanjut">
            {contohTL.length > 0 && (
              <span className="tumpuk-avatar" aria-hidden>
                {contohTL.map((x) => <i key={x!.w.id} className={`avatar ${warnaKategori(x!.kode)}`}>{inisial(x!.w.nama)}</i>)}
              </span>
            )}
            <div className="isi">
              <b>{tl.total ? `${tl.total} warga perlu ditindaklanjuti` : 'Daftar tindak lanjut'}</b>
              <span>Imunisasi belum lengkap, ibu hamil mendekati HPL, dan sering absen.</span>
            </div>
            <span className="btn-ikon hitam"><Ikon nama="kanan" ukuran={22} /></span>
          </Link>

          <div className="kartu">
            <JudulKartu ikon="layanan" ekor={<span className="chip">{d.n} peserta</span>}>Progres tahap layanan</JudulKartu>
            <div className="alur-tahap">
              {d.tahap.map(({ t, n }, i) => {
                const pr = d.n ? Math.round((n / d.n) * 100) : 0
                return (
                  <FragmenTahap key={t} panah={i > 0}>
                    <div className={`kotak-tahap ${t}`}>
                      <div className="atas"><span>{NAMA_TAHAP[t]}</span><small>{pr}%</small></div>
                      <b>{n}</b>
                      <div className="bar"><i style={{ width: `${pr}%` }} /></div>
                    </div>
                  </FragmenTahap>
                )
              })}
            </div>
          </div>

          <div className="dua-kolom seimbang">
            <div className="kartu">
              <JudulKartu ikon="grafik" warna="kuning">Peserta per kategori</JudulKartu>
              <GrafikBatang
                data={[...kategori].sort((a, b) => a.urutan - b.urutan).map((k, i) => ({ label: k.nama, nilai: d.perKat[k.kode] ?? 0, warna: hexKategori(k.kode, i) }))}
              />
            </div>
            <div className="kartu">
              <JudulKartu ikon="lokasi" warna="biru">Peserta per RT</JudulKartu>
              <GrafikDonat data={p.rtDaftar.map((r, i) => ({ label: `RT ${r}`, nilai: d.perRT[r] ?? 0, warna: PALET[i % PALET.length] }))} />
            </div>
          </div>

          <div className="kartu">
            <JudulKartu ikon="peringatan" warna="koral">Penanda risiko kegiatan ini</JudulKartu>
            <div className="grid2 tumpuk">
              <PetakRisiko ikon="hati" n={d.T} label="Tensi berisiko (T)" />
              <PetakRisiko ikon="penggaris" n={d.perut} label="Lingkar perut berisiko" />
              <PetakRisiko ikon="timbangan" n={d.kurus} label="IMT kurus" />
              <PetakRisiko ikon="timbangan" n={d.gemuk} label="IMT gemuk" />
            </div>
            <p className="catatan-kaki"><Ikon nama="info" ukuran={16} /> Penanda dari hasil ukur, bukan diagnosis.</p>
          </div>
        </>
      )}
    </>
  )
}

function FragmenTahap({ panah, children }: { panah: boolean; children: React.ReactNode }) {
  return (
    <>
      {panah && <Ikon nama="panah" ukuran={22} />}
      {children}
    </>
  )
}

function PetakRisiko({ ikon, n, label }: { ikon: string; n: number; label: string }) {
  return (
    <div className={`petak-risiko ${n ? '' : 'nol'}`}>
      <span className="ik"><Ikon nama={ikon} ukuran={20} /></span>
      <div><b><Angka nilai={n} /></b><span>{label}</span></div>
    </div>
  )
}
