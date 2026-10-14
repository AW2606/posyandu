import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Field, useToast } from '../components/ui'
import { formatUmur, todayISO } from '../lib/age'
import { validasiNIK } from '../lib/csv'
import { catat, db, type Warga } from '../lib/db'
import { useKategori, usePengaturan } from '../lib/hooks'
import { daftarkan } from '../lib/layanan'
import { kategoriDari } from '../lib/age'

type Form = Omit<Warga, 'id' | 'dibuat' | 'diubah'>

const KOSONG: Form = {
  nama: '', nik: '', noKK: '', tanggalLahir: '', jk: 'P', rt: '22', dusun: 'Dusun 5', alamat: '', namaOrtu: '', aktif: true,
}

export default function WargaForm() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const p = usePengaturan()
  const kategori = useKategori()
  const [f, setF] = useState<Form>({ ...KOSONG, nama: sp.get('nama') ?? '' })
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [simpan, setSimpan] = useState(false)
  const daftarKe = Number(sp.get('daftarKe')) || undefined

  useEffect(() => {
    if (!id) return
    db.warga.get(Number(id)).then((w) => w && setF(w))
  }, [id])

  useEffect(() => {
    if (!id && p.rtDaftar.length && !p.rtDaftar.includes(f.rt)) setF((x) => ({ ...x, rt: p.rtDaftar[0] }))
  }, [p.rtDaftar, id, f.rt])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const kat = f.tanggalLahir ? kategoriDari(f.tanggalLahir, todayISO(), kategori) : undefined

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const g: Record<string, string> = {}
    if (!f.nama.trim()) g.nama = 'Nama wajib diisi.'
    const nik = f.nik.replace(/\s/g, '')
    const gn = validasiNIK(nik)
    if (gn) g.nik = gn
    else if (nik) {
      const dup = await db.warga.where('nik').equals(nik).first()
      if (dup && String(dup.id) !== id) g.nik = `NIK sudah dipakai oleh ${dup.nama}.`
    }
    const kk = f.noKK.replace(/\s/g, '')
    if (kk && !/^\d{16}$/.test(kk)) g.noKK = 'Nomor KK harus 16 digit angka.'
    if (!f.tanggalLahir) g.tanggalLahir = 'Tanggal lahir wajib diisi.'
    else if (f.tanggalLahir > todayISO()) g.tanggalLahir = 'Tanggal lahir tidak boleh di masa depan.'
    setGalat(g)
    if (Object.keys(g).length) return

    setSimpan(true)
    const now = Date.now()
    const data = { ...f, nama: f.nama.trim(), nik, noKK: kk }
    let wargaId: number
    if (id) {
      wargaId = Number(id)
      await db.warga.update(wargaId, { ...data, diubah: now })
      await catat('ubah', 'warga', data.nama)
    } else {
      wargaId = (await db.warga.add({ ...data, dibuat: now, diubah: now })) as number
      await catat('tambah', 'warga', data.nama)
    }
    if (daftarKe) {
      const r = await daftarkan(daftarKe, wargaId)
      toast(r.ok ? `${data.nama} didaftarkan` : (r.pesan ?? ''))
      nav(`/kegiatan/${daftarKe}`, { replace: true })
    } else {
      toast('Data warga disimpan')
      nav(`/warga/${wargaId}`, { replace: true })
    }
  }

  return (
    <form onSubmit={kirim}>
      <div className="judul-halaman">
        <h2>{id ? 'Ubah data warga' : daftarKe ? 'Warga baru & daftarkan' : 'Tambah warga'}</h2>
      </div>
      <div className="kartu">
        <Field label="Nama lengkap" galat={galat.nama}>
          <input className={`input ${galat.nama ? 'salah' : ''}`} value={f.nama} onChange={(e) => set('nama', e.target.value)} autoComplete="off" autoFocus={!id} />
        </Field>
        <Field label="Tanggal lahir" galat={galat.tanggalLahir} petunjuk={f.tanggalLahir ? `${formatUmur(f.tanggalLahir, todayISO())} · ${kat?.nama ?? ''}` : undefined}>
          <input className={`input ${galat.tanggalLahir ? 'salah' : ''}`} type="date" value={f.tanggalLahir} onChange={(e) => set('tanggalLahir', e.target.value)} />
        </Field>
        <div className="field">
          <span className="lbl">Jenis kelamin</span>
          <div className="tab" style={{ marginBottom: 0 }}>
            <button type="button" className={f.jk === 'L' ? 'aktif' : ''} onClick={() => set('jk', 'L')}>Laki-laki</button>
            <button type="button" className={f.jk === 'P' ? 'aktif' : ''} onClick={() => set('jk', 'P')}>Perempuan</button>
          </div>
        </div>
        <div className="grid2">
          <Field label="RT">
            <select className="input" value={f.rt} onChange={(e) => set('rt', e.target.value)}>
              {p.rtDaftar.map((r) => <option key={r} value={r}>RT {r}</option>)}
            </select>
          </Field>
          <Field label="Dusun">
            <input className="input" value={f.dusun} onChange={(e) => set('dusun', e.target.value)} />
          </Field>
        </div>
        <Field label="NIK (16 digit)" galat={galat.nik} petunjuk="Boleh dikosongkan jika belum punya NIK.">
          <input className={`input ${galat.nik ? 'salah' : ''}`} inputMode="numeric" maxLength={16} value={f.nik} onChange={(e) => set('nik', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Nomor KK (16 digit)" galat={galat.noKK}>
          <input className={`input ${galat.noKK ? 'salah' : ''}`} inputMode="numeric" maxLength={16} value={f.noKK} onChange={(e) => set('noKK', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Nama orang tua / wali" petunjuk="Untuk balita dan anak.">
          <input className="input" value={f.namaOrtu} onChange={(e) => set('namaOrtu', e.target.value)} />
        </Field>
        <Field label="Alamat singkat (opsional)">
          <input className="input" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} />
        </Field>
      </div>
      <div className="aksi-bawah">
        <button type="button" className="btn" onClick={() => nav(-1)}>Batal</button>
        <button className="btn utama" disabled={simpan}>Simpan</button>
      </div>
    </form>
  )
}
