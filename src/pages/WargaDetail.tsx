import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Chip, ChipKategori, Daun, GrafikGaris, Ikon, JudulKartu, Konfirmasi, Kosong, inisial, useToast, warnaKategori } from '../components/ui'
import { formatUmur, kategoriDari, tglId, tglPanjang, todayISO } from '../lib/age'
import { useAuth } from '../lib/auth'
import { catat, db, hapusWargaPermanen, hitungDataWarga } from '../lib/db'
import { angkaId, hitungIMT, lingkarPerutBerisiko, statusGizi, tekananDarahBerisiko } from '../lib/health'
import { useKategori, usePengaturan } from '../lib/hooks'
import { KartuImunisasi, KartuKehamilan } from '../components/KartuKhusus'
import { umurBulan } from '../lib/age'

export default function WargaDetail() {
  const { id } = useParams()
  const wid = Number(id)
  const nav = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()
  const p = usePengaturan()
  const kategori = useKategori()
  const [arsip, setArsip] = useState(false)
  const [hapus, setHapus] = useState<string | null>(null)
  const [menghapus, setMenghapus] = useState(false)
  const w = useLiveQuery(() => db.warga.get(wid), [wid])
  const periksa = useLiveQuery(() => db.pemeriksaan.where('wargaId').equals(wid).sortBy('tanggal'), [wid]) ?? []
  const status = useLiveQuery(() => db.statusKhusus.where('wargaId').equals(wid).toArray(), [wid]) ?? []
  const kunj = useLiveQuery(() => db.kunjungan.where('wargaId').equals(wid).count(), [wid]) ?? 0

  if (w === undefined) return null
  if (!w) return <Kosong judul="Warga tidak ditemukan" />

  const ref = todayISO()
  const kat = kategoriDari(w.tanggalLahir, ref, kategori)
  const aktifStatus = (j: 'hamil' | 'menyusui') => status.find((s) => s.jenis === j && !s.selesai)

  async function setStatus(j: 'hamil' | 'menyusui') {
    const a = aktifStatus(j)
    if (a?.id) {
      await db.statusKhusus.update(a.id, { selesai: ref })
      toast(`Status ${j} diakhiri`)
    } else {
      await db.statusKhusus.add({ wargaId: wid, jenis: j, mulai: ref })
      toast(`Ditandai ${j}`)
    }
    await catat('ubah', 'status', `${w!.nama}: ${j}`)
  }

  async function arsipkan() {
    await db.warga.update(wid, { aktif: !w!.aktif, diubah: Date.now() })
    await catat(w!.aktif ? 'arsip' : 'pulihkan', 'warga', w!.nama)
    setArsip(false)
    toast(w!.aktif ? 'Warga diarsipkan' : 'Warga dipulihkan')
    if (w!.aktif) nav('/warga')
  }

  async function mintaHapus() {
    const n = await hitungDataWarga(wid)
    const ikut = [n.kunjungan && `${n.kunjungan} kunjungan`, n.pemeriksaan && `${n.pemeriksaan} hasil pemeriksaan`, n.lain && `${n.lain} catatan lain`].filter(Boolean).join(', ')
    setHapus(`${w!.nama} akan dihapus permanen${ikut ? ` beserta ${ikut}` : ''}. Data yang dihapus tidak bisa dikembalikan dan juga hilang dari laporan bulan-bulan sebelumnya. Jika hanya ingin menyembunyikan, pakai Arsipkan.`)
  }

  async function hapusPermanen() {
    if (menghapus) return
    setMenghapus(true)
    const tujuan = w!.aktif ? '/warga' : '/warga/arsip'
    await hapusWargaPermanen(wid)
    toast(`${w!.nama} dihapus`)
    nav(tujuan, { replace: true })
  }

  const balita = kat?.kode === 'balita'
  const grafikBB = periksa.filter((x) => x.bb !== undefined).slice(-8).map((x) => ({ x: tglId(x.tanggal, '/').slice(0, 5), y: x.bb! }))
  const grafikTB = periksa.filter((x) => x.tb !== undefined).slice(-8).map((x) => ({ x: tglId(x.tanggal, '/').slice(0, 5), y: x.tb! }))

  const bbSemua = periksa.filter((x) => x.bb !== undefined)
  const selisihBB = bbSemua.length >= 2 ? bbSemua[bbSemua.length - 1].bb! - bbSemua[Math.max(0, bbSemua.length - 8)].bb! : undefined
  const warna = warnaKategori(kat?.kode)
  const info = (ikon: string, label: string, isi: React.ReactNode, sub?: string) => (
    <div className="petak-info">
      <Ikon nama={ikon} ukuran={20} />
      <div><small>{label}</small><b>{isi}</b>{sub && <span>{sub}</span>}</div>
    </div>
  )
  const perempuanSubur = w.jk === 'P' && kat && ['dewasa', 'remaja'].includes(kat.kode)

  return (
    <>
      <div className="remah no-print">
        {w.aktif || !isAdmin
          ? <Link className="pil-kembali terang" to="/warga"><Ikon nama="kiri" ukuran={16} /> Warga</Link>
          : <Link className="pil-kembali terang" to="/warga/arsip"><Ikon nama="kiri" ukuran={16} /> Arsip warga</Link>}
        <span>Data warga</span>
      </div>

      <div className="dua-kolom profil">
        <div>
          <div className="kartu kartu-profil">
            <div className="sampul" aria-hidden><Daun className="sampul-daun" /></div>
            <div className="profil-atas">
              <div className={`avatar besar ${warna}`}>{inisial(w.nama)}</div>
              <div style={{ minWidth: 0 }}>
                <h2>{w.nama}</h2>
                <div className="baris" style={{ gap: 6, marginTop: 8 }}>
                  <ChipKategori kode={kat?.kode} nama={kat?.nama} />
                  <Chip>{w.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</Chip>
                  <Chip warna="biru">RT {w.rt}</Chip>
                  {!w.aktif && <Chip warna="merah">Diarsipkan</Chip>}
                  {aktifStatus('hamil') && <Chip warna="koral"><Ikon nama="hati" ukuran={14} /> Hamil</Chip>}
                  {aktifStatus('menyusui') && <Chip warna="koral">Menyusui</Chip>}
                </div>
              </div>
            </div>
            <div className="grid-info">
              {info('kalender', 'Tanggal lahir', tglPanjang(w.tanggalLahir), formatUmur(w.tanggalLahir, ref))}
              {info('kunci', 'NIK', w.nik || <span className="redup">Belum ada</span>)}
              {info('warga', 'No. KK', w.noKK || '-')}
              {info('lokasi', 'Alamat', [w.alamat, w.dusun, `RT ${w.rt}`].filter(Boolean).join(', '))}
              {w.namaOrtu && info('orang', 'Orang tua / wali', w.namaOrtu)}
              {info('riwayat', 'Kunjungan', `${kunj} kali`, periksa[0] ? `sejak ${tglId(periksa[0].tanggal)}` : undefined)}
            </div>
            <div className="baris" style={{ marginTop: 20 }}>
              <Link className="btn utama kecil" to={`/warga/${wid}/ubah`}><Ikon nama="pensil" ukuran={17} /> Ubah data</Link>
              {perempuanSubur && (
                <>
                  <button className="btn kecil" onClick={() => setStatus('hamil')}>{aktifStatus('hamil') ? 'Akhiri hamil' : 'Tandai hamil'}</button>
                  <button className="btn kecil" onClick={() => setStatus('menyusui')}>{aktifStatus('menyusui') ? 'Akhiri menyusui' : 'Tandai menyusui'}</button>
                </>
              )}
              {isAdmin && (w.aktif
                ? <button className="btn bahaya kecil" onClick={() => setArsip(true)}><Ikon nama="arsip" ukuran={17} /> Arsipkan</button>
                : <button className="btn lembut kecil" onClick={() => setArsip(true)}><Ikon nama="ulang" ukuran={17} /> Pulihkan</button>)}
              {isAdmin && <button className="btn bahaya kecil" onClick={mintaHapus}><Ikon nama="tutup" ukuran={17} /> Hapus permanen</button>}
            </div>
          </div>

          {umurBulan(w.tanggalLahir, ref) < 36 && <KartuImunisasi w={w} />}
          {perempuanSubur && <KartuKehamilan w={w} />}
        </div>

        <div>
      <div className="kartu">
        <JudulKartu ikon="grafik" ekor={selisihBB !== undefined && selisihBB !== 0 ? (
          <Chip warna={selisihBB > 0 ? 'hijau' : 'koral'}><Ikon nama="serong" ukuran={14} tebal={2.4} /> {selisihBB > 0 ? '+' : ''}{angkaId(selisihBB)} kg</Chip>
        ) : undefined}>Grafik {balita ? 'pertumbuhan' : 'berat badan'}</JudulKartu>
        <p className="kecil redup" style={{ margin: '-8px 0 8px' }}>Berat badan (kg) · {grafikBB.length} kunjungan terakhir</p>
        <GrafikGaris titik={grafikBB} satuan="berat badan" />
        {balita && (
          <>
            <p className="kecil redup" style={{ margin: '14px 0 8px' }}>Panjang/tinggi badan (cm)</p>
            <GrafikGaris titik={grafikTB} satuan="tinggi badan" />
          </>
        )}
      </div>

      <div className="kartu">
        <JudulKartu ikon="riwayat" warna="biru">Riwayat pemeriksaan</JudulKartu>
        {periksa.length === 0 ? (
          <Kosong judul="Belum ada pemeriksaan" teks="Hasil akan muncul setelah warga diperiksa di hari Posyandu." />
        ) : (
          <div className="tabel-gulir">
            <table className="tabel">
              <thead>
                <tr><th>Tanggal</th><th>BB</th><th>TB</th><th>IMT</th><th>LILA</th><th>L. perut</th><th>Tensi</th><th>Gula</th></tr>
              </thead>
              <tbody>
                {[...periksa].reverse().map((x) => {
                  const imt = hitungIMT(x.bb, x.tb)
                  const g = statusGizi(imt, p.ambang)
                  return (
                    <tr key={x.id}>
                      <td>{tglId(x.tanggal)}</td>
                      <td>{angkaId(x.bb)}</td>
                      <td>{angkaId(x.tb, 0)}</td>
                      <td>{imt !== undefined ? <>{angkaId(imt)} {g && g !== 'Normal' && <Chip warna="merah">{g}</Chip>}</> : ''}</td>
                      <td>{angkaId(x.lila)}</td>
                      <td>{angkaId(x.lingkarPerut, 0)} {lingkarPerutBerisiko(x.lingkarPerut, w.jk, p.ambang) && <Chip warna="merah">!</Chip>}</td>
                      <td>{x.sistol !== undefined && x.diastol !== undefined ? <>{x.sistol}/{x.diastol} {tekananDarahBerisiko(x.sistol, x.diastol, p.ambang) && <Chip warna="merah">T</Chip>}</> : ''}</td>
                      <td>{angkaId(x.gulaDarah, 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      </div>

      {arsip && (
        <Konfirmasi
          judul={w.aktif ? 'Arsipkan warga?' : 'Pulihkan warga?'}
          teks={w.aktif ? `${w.nama} tidak akan muncul di daftar dan laporan. Riwayat tetap tersimpan dan bisa dipulihkan.` : `${w.nama} akan muncul kembali di daftar dan laporan.`}
          labelYa={w.aktif ? 'Arsipkan' : 'Pulihkan'}
          bahaya={w.aktif}
          onYa={arsipkan}
          onBatal={() => setArsip(false)}
        />
      )}
      {hapus && (
        <Konfirmasi
          judul="Hapus permanen?"
          teks={hapus}
          labelYa={menghapus ? 'Menghapus…' : 'Hapus permanen'}
          bahaya
          onYa={hapusPermanen}
          onBatal={() => setHapus(null)}
        />
      )}
    </>
  )
}
