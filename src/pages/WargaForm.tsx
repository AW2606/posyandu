import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import fotoTips from '../assets/foto/ibu-bayi-2.jpg'
import { Bangau, Field, Ikon, KepalaHalaman, useToast } from '../components/ui'
import { formatUmur, todayISO, umurTahun } from '../lib/age'
import { petunjukDigit, validasiNIK } from '../lib/csv'
import { catat, db, type Warga } from '../lib/db'
import { useKategori, usePengaturan } from '../lib/hooks'
import { daftarkan } from '../lib/layanan'
import { kategoriDari } from '../lib/age'

type Form = Omit<Warga, 'id' | 'dibuat' | 'diubah'>

const KOSONG: Form = {
  nama: '', nik: '', noKK: '', tanggalLahir: '', jk: 'P', rt: '22', dusun: 'Dusun 5', alamat: '', namaOrtu: '', nikOrtu: '', aktif: true,
}

/** Penghitung digit di bawah isian 16 digit. Hijau dan bercentang saat sudah lengkap. */
function HitungDigit({ nilai }: { nilai: string }) {
  if (!nilai) return null
  const { teks, lengkap } = petunjukDigit(nilai)
  return (
    <span className={`hitung-digit ${lengkap ? 'lengkap' : ''}`} aria-live="polite">
      {lengkap && <Ikon nama="centang" ukuran={15} tebal={3} />} {teks}
    </span>
  )
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
  // NIK orang tua hanya relevan untuk anak (di bawah 18 th); tetap tampil bila sudah pernah diisi.
  const tampilNikOrtu = !!f.nikOrtu || (!!f.tanggalLahir && umurTahun(f.tanggalLahir, todayISO()) < 18)

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
    const nikOrtu = (f.nikOrtu ?? '').replace(/\s/g, '')
    if (nikOrtu && !/^\d{16}$/.test(nikOrtu)) g.nikOrtu = 'NIK orang tua harus 16 digit angka.'
    else if (nikOrtu && nikOrtu === nik) g.nikOrtu = 'NIK orang tua tidak boleh sama dengan NIK anak.'
    if (!f.tanggalLahir) g.tanggalLahir = 'Tanggal lahir wajib diisi.'
    else if (f.tanggalLahir > todayISO()) g.tanggalLahir = 'Tanggal lahir tidak boleh di masa depan.'
    setGalat(g)
    if (Object.keys(g).length) return

    setSimpan(true)
    const now = Date.now()
    const data = { ...f, nama: f.nama.trim(), nik, noKK: kk, nikOrtu }
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

  const judul = id ? 'Ubah data warga' : daftarKe ? 'Warga baru & daftarkan' : 'Tambah warga'

  return (
    <form onSubmit={kirim}>
      <KepalaHalaman
        kembali={{ onClick: () => nav(-1), label: id ? 'Data warga' : daftarKe ? 'Meja layanan' : 'Warga' }}
        label="Data sasaran"
        judul={judul}
        sub="Isi data sesuai KTP atau Kartu Keluarga."
      />
      <div className="dua-kolom">
        <div className="kartu">
          <h3 className="bagian-form"><span>1</span> Data diri</h3>
          <div className="grid2 tumpuk">
            <Field label="Nama lengkap" galat={galat.nama}>
              <input className={`input ${galat.nama ? 'salah' : ''}`} value={f.nama} onChange={(e) => set('nama', e.target.value)} autoComplete="off" autoFocus={!id} />
            </Field>
            <Field label="Tanggal lahir" galat={galat.tanggalLahir} petunjuk={f.tanggalLahir ? `Umur ${formatUmur(f.tanggalLahir, todayISO())}${kat ? ` · otomatis masuk ${kat.nama}` : ''}` : undefined}>
              <input className={`input ${galat.tanggalLahir ? 'salah' : ''}`} type="date" value={f.tanggalLahir} onChange={(e) => set('tanggalLahir', e.target.value)} />
            </Field>
          </div>
          <div className="field">
            <span className="lbl">Jenis kelamin</span>
            <div className="pilih-kartu" role="radiogroup" aria-label="Jenis kelamin">
              {(['L', 'P'] as const).map((j) => (
                <button key={j} type="button" role="radio" aria-checked={f.jk === j} className={f.jk === j ? 'aktif' : ''} onClick={() => set('jk', j)}>
                  <i>{f.jk === j && <Ikon nama="centang" ukuran={14} tebal={3} />}</i>
                  {j === 'L' ? 'Laki-laki' : 'Perempuan'}
                </button>
              ))}
            </div>
          </div>

          <h3 className="bagian-form"><span>2</span> Alamat & keluarga</h3>
          <div className="grid2 tumpuk">
            <Field label="RT">
              <select className="input" value={f.rt} onChange={(e) => set('rt', e.target.value)}>
                {p.rtDaftar.map((r) => <option key={r} value={r}>RT {r}</option>)}
              </select>
            </Field>
            <Field label="Dusun">
              <input className="input" value={f.dusun} onChange={(e) => set('dusun', e.target.value)} />
            </Field>
            <Field label="Nama orang tua / wali" petunjuk="Untuk balita dan anak.">
              <input className="input" value={f.namaOrtu} onChange={(e) => set('namaOrtu', e.target.value)} />
            </Field>
            <Field label="Alamat singkat (opsional)">
              <input className="input" placeholder="mis. Perum. BW Blok C" value={f.alamat} onChange={(e) => set('alamat', e.target.value)} />
            </Field>
          </div>

          <h3 className="bagian-form"><span>3</span> Nomor identitas</h3>
          <div className="grid2 tumpuk">
            <Field label="NIK (16 digit)" galat={galat.nik} petunjuk={f.nik ? undefined : 'Boleh dikosongkan jika belum punya NIK.'}>
              <input className={`input ${galat.nik ? 'salah' : ''}`} inputMode="numeric" maxLength={16} value={f.nik} onChange={(e) => set('nik', e.target.value.replace(/\D/g, ''))} />
              {!galat.nik && <HitungDigit nilai={f.nik} />}
            </Field>
            <Field label="Nomor KK (16 digit)" galat={galat.noKK}>
              <input className={`input ${galat.noKK ? 'salah' : ''}`} inputMode="numeric" maxLength={16} value={f.noKK} onChange={(e) => set('noKK', e.target.value.replace(/\D/g, ''))} />
              {!galat.noKK && <HitungDigit nilai={f.noKK} />}
            </Field>
            {tampilNikOrtu && (
              <Field label="NIK orang tua / wali (16 digit)" galat={galat.nikOrtu} petunjuk={f.nikOrtu ? undefined : 'Untuk balita dan anak. Boleh dikosongkan.'}>
                <input className={`input ${galat.nikOrtu ? 'salah' : ''}`} inputMode="numeric" maxLength={16} value={f.nikOrtu ?? ''} onChange={(e) => set('nikOrtu', e.target.value.replace(/\D/g, ''))} />
                {!galat.nikOrtu && <HitungDigit nilai={f.nikOrtu ?? ''} />}
              </Field>
            )}
          </div>

          <div className="aksi-form">
            <button type="button" className="btn" onClick={() => nav(-1)}>Batal</button>
            <button className="btn utama" disabled={simpan}><Ikon nama="centang" ukuran={20} tebal={2.4} /> {id ? 'Simpan perubahan' : 'Simpan warga'}</button>
          </div>
        </div>

        <aside className="no-print">
          <div className="kartu kartu-tips">
            <Bangau className="tips-bangau" kaki="#E09A1B" />
            <span className="petak-ikon" style={{ background: 'var(--amber)', color: '#fff', width: 48, height: 48 }}><Ikon nama="info" ukuran={24} /></span>
            <h3>Tips mengisi</h3>
            <ul>
              <li><Ikon nama="centang" ukuran={14} tebal={3} /> Salin nama persis seperti di KTP atau KK.</li>
              <li><Ikon nama="centang" ukuran={14} tebal={3} /> NIK boleh dikosongkan bila belum punya.</li>
              <li><Ikon nama="centang" ukuran={14} tebal={3} /> Kategori umur dihitung otomatis dari tanggal lahir.</li>
            </ul>
          </div>
          <img className="foto-samping" src={fotoTips} alt="Kader memeriksa catatan kesehatan bersama ibu dan anak" />
        </aside>
      </div>
    </form>
  )
}
