import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Chip, GrafikGaris, Konfirmasi, Kosong, inisial, useToast } from '../components/ui'
import { formatUmur, kategoriDari, tglId, tglPanjang, todayISO } from '../lib/age'
import { useAuth } from '../lib/auth'
import { catat, db } from '../lib/db'
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

  const balita = kat?.kode === 'balita'
  const grafikBB = periksa.filter((x) => x.bb !== undefined).slice(-8).map((x) => ({ x: tglId(x.tanggal, '/').slice(0, 5), y: x.bb! }))
  const grafikTB = periksa.filter((x) => x.tb !== undefined).slice(-8).map((x) => ({ x: tglId(x.tanggal, '/').slice(0, 5), y: x.tb! }))

  return (
    <>
      <div className="kartu">
        <div className="baris" style={{ flexWrap: 'nowrap' }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{inisial(w.nama)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20 }}>{w.nama}</h2>
            <div className="baris" style={{ gap: 6, marginTop: 4 }}>
              <Chip warna="biru">{kat?.nama}</Chip>
              <Chip>{w.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</Chip>
              <Chip>RT {w.rt}</Chip>
              {!w.aktif && <Chip warna="merah">Diarsipkan</Chip>}
              {aktifStatus('hamil') && <Chip warna="kuning">Hamil</Chip>}
              {aktifStatus('menyusui') && <Chip warna="kuning">Menyusui</Chip>}
            </div>
          </div>
        </div>
        <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px' }}>
          <dt className="redup">Tanggal lahir</dt><dd style={{ margin: 0 }}>{tglPanjang(w.tanggalLahir)} ({formatUmur(w.tanggalLahir, ref)})</dd>
          <dt className="redup">NIK</dt><dd style={{ margin: 0 }}>{w.nik || <span className="redup">Belum ada</span>}</dd>
          <dt className="redup">No. KK</dt><dd style={{ margin: 0 }}>{w.noKK || '-'}</dd>
          {w.namaOrtu && (<><dt className="redup">Orang tua</dt><dd style={{ margin: 0 }}>{w.namaOrtu}</dd></>)}
          <dt className="redup">Alamat</dt><dd style={{ margin: 0 }}>{[w.alamat, w.dusun, `RT ${w.rt}`].filter(Boolean).join(', ')}</dd>
          <dt className="redup">Kunjungan</dt><dd style={{ margin: 0 }}>{kunj} kali</dd>
        </dl>
        <div className="baris" style={{ marginTop: 14 }}>
          <Link className="btn" to={`/warga/${wid}/ubah`}>Ubah data</Link>
          {w.jk === 'P' && kat && ['dewasa', 'remaja'].includes(kat.kode) && (
            <>
              <button className="btn" onClick={() => setStatus('hamil')}>{aktifStatus('hamil') ? 'Akhiri hamil' : 'Tandai hamil'}</button>
              <button className="btn" onClick={() => setStatus('menyusui')}>{aktifStatus('menyusui') ? 'Akhiri menyusui' : 'Tandai menyusui'}</button>
            </>
          )}
          {isAdmin && <button className="btn bahaya" onClick={() => setArsip(true)}>{w.aktif ? 'Arsipkan' : 'Pulihkan'}</button>}
        </div>
      </div>

      {umurBulan(w.tanggalLahir, ref) < 36 && <KartuImunisasi w={w} />}
      {w.jk === 'P' && kat && ['dewasa', 'remaja'].includes(kat.kode) && <KartuKehamilan w={w} />}

      <div className="kartu">
        <h3>Grafik {balita ? 'pertumbuhan' : 'berat badan'}</h3>
        <p className="kecil redup" style={{ margin: '0 0 4px' }}>Berat badan (kg)</p>
        <GrafikGaris titik={grafikBB} satuan="berat badan" />
        {balita && (
          <>
            <p className="kecil redup" style={{ margin: '10px 0 4px' }}>Panjang/tinggi badan (cm)</p>
            <GrafikGaris titik={grafikTB} satuan="tinggi badan" />
          </>
        )}
      </div>

      <div className="kartu">
        <h3>Riwayat pemeriksaan</h3>
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
    </>
  )
}
