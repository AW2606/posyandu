import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ikon, JudulKartu, KepalaHalaman, useToast } from '../components/ui'
import { CONTOH_CSV, parseCSV, siapkanImpor, unduhTeks, type BarisImpor } from '../lib/csv'
import { catat, db } from '../lib/db'
import { usePengaturan } from '../lib/hooks'

export default function WargaImpor() {
  const p = usePengaturan()
  const toast = useToast()
  const [hasil, setHasil] = useState<BarisImpor[] | null>(null)
  const [selesai, setSelesai] = useState<number | null>(null)

  async function pilihBerkas(f: File | undefined) {
    if (!f) return
    setSelesai(null)
    const rows = parseCSV(await f.text())
    const ada = new Set((await db.warga.toArray()).map((w) => w.nik).filter(Boolean))
    setHasil(siapkanImpor(rows, p.rtDaftar, ada))
  }

  const ok = hasil?.filter((x) => x.data) ?? []
  const gagal = hasil?.filter((x) => x.galat) ?? []

  async function simpan() {
    const now = Date.now()
    await db.warga.bulkAdd(ok.map((x) => ({ ...x.data!, dibuat: now, diubah: now })))
    await catat('impor', 'warga', `${ok.length} baris`)
    setSelesai(ok.length)
    setHasil(null)
    toast(`${ok.length} warga diimpor`)
  }

  return (
    <>
      <KepalaHalaman kembali={{ to: '/pengaturan', label: 'Lainnya' }} label="Data sasaran" judul="Impor data warga" sub="Pindahkan data dari buku besar atau Excel sekaligus." />
      <div className="kartu">
        <JudulKartu ikon="unggah">Pilih berkas CSV</JudulKartu>
        <p style={{ marginTop: 0 }}>Simpan berkas Excel sebagai <b>CSV</b>, lalu pilih di sini.</p>
        <p className="petunjuk">Kolom: nama, nik, no_kk, tanggal_lahir (dd-mm-yyyy), jenis_kelamin (L/P), rt, alamat, nama_ortu. NIK boleh kosong.</p>
        <div className="baris">
          <button className="btn" onClick={() => unduhTeks('contoh-impor-warga.csv', CONTOH_CSV, 'text/csv')}><Ikon nama="unduh" ukuran={20} /> Unduh contoh CSV</button>
          <label className="btn utama" style={{ cursor: 'pointer' }}>
            <Ikon nama="unggah" ukuran={20} /> Pilih berkas CSV
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => pilihBerkas(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      {selesai !== null && (
        <div className="banner sukses">
          <Ikon nama="centang" ukuran={22} />
          {selesai} warga berhasil diimpor. <Link to="/warga">Lihat daftar warga</Link>
        </div>
      )}

      {hasil && (
        <div className="kartu">
          <JudulKartu ikon="layanan" warna="biru">Hasil pemeriksaan berkas</JudulKartu>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="stat warna mint"><div className="angka">{ok.length}</div><div className="lbl">baris siap diimpor</div></div>
            <div className={`stat warna ${gagal.length ? 'koral' : 'mint'}`}><div className="angka">{gagal.length}</div><div className="lbl">baris gagal</div></div>
          </div>
          {gagal.length > 0 && (
            <div className="tabel-gulir" style={{ marginBottom: 12 }}>
              <table className="tabel">
                <thead><tr><th>Baris</th><th>Masalah</th></tr></thead>
                <tbody>{gagal.map((g) => <tr key={g.baris}><td>{g.baris}</td><td style={{ whiteSpace: 'normal' }}>{g.galat}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <button className="btn utama penuh" disabled={!ok.length} onClick={simpan}>
            Impor {ok.length} warga{gagal.length ? ' (lewati yang gagal)' : ''}
          </button>
        </div>
      )}
    </>
  )
}
