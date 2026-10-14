import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Field, Konfirmasi, Sheet, useToast } from '../components/ui'
import { FormServer } from '../components/FormServer'
import { buatUser, gantiPassword, gantiPasswordCloud, useAuth } from '../lib/auth'
import { buatAkunKader, buatTautan, getKlien, getSinkron, useStatusSinkron, type Profil } from '../lib/cloud'
import { db, eksporSemua, impor, inisialisasi, simpanPengaturan, type Pengaturan as TPengaturan, type Role } from '../lib/db'
import { unduhTeks } from '../lib/csv'
import { usePengaturan, useKategori } from '../lib/hooks'
import { muatDataContoh } from '../lib/seed'
import { KATEGORI_DEFAULT } from '../lib/age'
import { AMBANG_DEFAULT } from '../lib/health'

export default function Pengaturan() {
  const { user, isAdmin, cloud } = useAuth()
  return (
    <>
      <div className="judul-halaman"><h2>Lainnya</h2></div>
      <KataSandi id={user!.id} />
      {isAdmin ? (
        <>
          <Identitas />
          <Kategori />
          <Ambang />
          <Server />
          {cloud ? <ProfilCloud /> : <Akun />}
          <Data />
          <Audit />
        </>
      ) : (
        <p className="petunjuk">Pengaturan lain hanya bisa diubah Admin.</p>
      )}
      <p className="petunjuk" style={{ textAlign: 'center', marginTop: 20 }}>Posyandu Bangau · Portal Kader v0.1 (tahap front end)</p>
    </>
  )
}

function KataSandi({ id }: { id?: number }) {
  const toast = useToast()
  const { cloud } = useAuth()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const galat = a && a.length < 6 ? 'Minimal 6 karakter.' : b && a !== b ? 'Kata sandi tidak sama.' : null
  return (
    <div className="kartu">
      <h3>Ganti kata sandi</h3>
      <Field label="Kata sandi baru" galat={galat}>
        <input className="input" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </Field>
      <Field label="Ulangi kata sandi baru">
        <input className="input" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </Field>
      <button className="btn utama" disabled={a.length < 6 || a !== b} onClick={async () => {
        if (cloud) {
          const g = await gantiPasswordCloud(a)
          if (g) return toast(g)
        } else await gantiPassword(id!, a)
        setA(''); setB(''); toast('Kata sandi diganti')
      }}>
        Simpan kata sandi
      </button>
    </div>
  )
}

function useDraft() {
  const p = usePengaturan()
  const [d, setD] = useState<TPengaturan>(p)
  const [muat, setMuat] = useState(false)
  useEffect(() => {
    if (!muat) { setD(p); setMuat(true) }
  }, [p, muat])
  return [d, setD] as const
}

function Identitas() {
  const toast = useToast()
  const [d, setD] = useDraft()
  const set = <K extends keyof TPengaturan>(k: K, v: TPengaturan[K]) => setD((x) => ({ ...x, [k]: v }))
  const teks = (k: 'namaPosyandu' | 'dusun' | 'desa' | 'kecamatan' | 'puskesmas' | 'ketua' | 'kader' | 'bidan', label: string) => (
    <Field label={label}>
      <input className="input" value={d[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  )
  return (
    <div className="kartu">
      <h3>Identitas, kop, dan penandatangan laporan</h3>
      {teks('namaPosyandu', 'Nama Posyandu (baris kop)')}
      <div className="grid2 tumpuk">{teks('dusun', 'Dusun')}{teks('desa', 'Desa')}</div>
      {teks('kecamatan', 'Kecamatan (baris kop)')}
      {teks('puskesmas', 'Puskesmas')}
      <Field label="Alamat di kartu hasil pemeriksaan (satu baris per baris cetak)">
        <textarea className="input" value={d.alamatKop} onChange={(e) => set('alamatKop', e.target.value)} />
      </Field>
      <Field label="Daftar RT (pisahkan dengan koma)">
        <input className="input" value={d.rtDaftar.join(', ')} onChange={(e) => set('rtDaftar', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
      </Field>
      <Field label="Tanggal kegiatan rutin tiap bulan">
        <input className="input" type="number" min={1} max={31} value={d.tanggalKegiatan} onChange={(e) => set('tanggalKegiatan', Number(e.target.value))} />
      </Field>
      <Field label="Daftar imunisasi dasar (urut, pisahkan dengan koma)" petunjuk="Cocokkan dengan buku KIA. Bayi dianggap lengkap bila semuanya tercatat.">
        <textarea className="input" value={d.imunisasiDasar.join(', ')} onChange={(e) => set('imunisasiDasar', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
      </Field>
      <Field label="Jenis obat/vitamin (pisahkan dengan koma)">
        <input className="input" value={d.jenisObat.join(', ')} onChange={(e) => set('jenisObat', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
      </Field>
      {teks('ketua', 'Nama Ketua Posyandu')}
      {teks('kader', 'Nama Kader penandatangan')}
      {teks('bidan', 'Nama Bidan')}
      <button className="btn utama" onClick={async () => { await simpanPengaturan(d); toast('Pengaturan disimpan') }}>Simpan</button>
    </div>
  )
}

function Kategori() {
  const toast = useToast()
  const asli = useKategori()
  const [d, setD] = useState(asli)
  const [muat, setMuat] = useState(false)
  useEffect(() => { if (!muat) { setD(asli); setMuat(true) } }, [asli, muat])
  const ubah = (i: number, k: 'umurMin' | 'umurMax', v: string) =>
    setD((x) => x.map((c, j) => (j === i ? { ...c, [k]: v === '' ? (k === 'umurMax' ? null : 0) : Number(v) } : c)))
  const urut = [...d].sort((a, b) => a.urutan - b.urutan)
  // tumpang tindih: batas bawah kategori berikutnya harus sama dengan batas atas sebelumnya
  const galat = urut.some((c, i) => i > 0 && urut[i - 1].umurMax !== c.umurMin)
    ? 'Rentang harus berurutan tanpa celah atau tumpang tindih (batas atas = batas bawah kategori berikutnya).'
    : null
  return (
    <div className="kartu">
      <h3>Kategori sasaran dan batas umur</h3>
      <p className="petunjuk">Umur dalam tahun penuh. Batas bawah termasuk, batas atas tidak. Contoh: Balita 0 sampai 6 berarti 0–5 tahun.</p>
      {urut.map((c) => {
        const i = d.indexOf(c)
        return (
          <div key={c.kode} className="baris" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
            <span style={{ flex: 1, fontWeight: 650 }}>{c.nama}</span>
            <input className="input" style={{ width: 76 }} inputMode="numeric" aria-label={`${c.nama} dari`} value={c.umurMin} onChange={(e) => ubah(i, 'umurMin', e.target.value)} />
            <span>s/d</span>
            <input className="input" style={{ width: 76 }} inputMode="numeric" placeholder="∞" aria-label={`${c.nama} sampai`} value={c.umurMax ?? ''} onChange={(e) => ubah(i, 'umurMax', e.target.value)} />
          </div>
        )
      })}
      {galat && <div className="banner peringatan">{galat}</div>}
      <div className="baris">
        <button className="btn utama" disabled={!!galat} onClick={async () => { await db.kategori.bulkPut(d); toast('Kategori disimpan') }}>Simpan</button>
        <button className="btn" onClick={() => setD(KATEGORI_DEFAULT)}>Kembalikan bawaan</button>
      </div>
    </div>
  )
}

function Ambang() {
  const toast = useToast()
  const [d, setD] = useDraft()
  const lab: Array<[keyof typeof AMBANG_DEFAULT, string]> = [
    ['imtKurus', 'IMT: di bawah ini berisiko kurang'],
    ['imtGemuk', 'IMT: ini atau lebih berisiko lebih'],
    ['lingkarPerutL', 'Lingkar perut laki-laki berisiko jika > (cm)'],
    ['lingkarPerutP', 'Lingkar perut perempuan berisiko jika > (cm)'],
    ['tdSistol', 'Tensi sistol berisiko jika ≥ (penanda T)'],
    ['tdDiastol', 'Tensi diastol berisiko jika ≥ (penanda T)'],
    ['gulaDarahMax', 'Gula darah tinggi jika ≥ (mg/dl)'],
    ['kolesterolMax', 'Kolesterol tinggi jika ≥ (mg/dl)'],
    ['asamUratL', 'Asam urat laki-laki tinggi jika > (mg/dl)'],
    ['asamUratP', 'Asam urat perempuan tinggi jika > (mg/dl)'],
  ]
  return (
    <div className="kartu">
      <h3>Ambang batas pemeriksaan</h3>
      <p className="petunjuk">Angka bawaan perlu dikonfirmasi ke bidan Puskesmas. Sistem hanya memberi penanda, bukan diagnosis.</p>
      {lab.map(([k, l]) => (
        <Field key={k} label={l}>
          <input className="input" inputMode="decimal" value={d.ambang[k]} onChange={(e) => setD((x) => ({ ...x, ambang: { ...x.ambang, [k]: Number(e.target.value.replace(',', '.')) || 0 } }))} />
        </Field>
      ))}
      <div className="baris">
        <button className="btn utama" onClick={async () => { await simpanPengaturan(d); toast('Ambang disimpan') }}>Simpan</button>
        <button className="btn" onClick={() => setD((x) => ({ ...x, ambang: AMBANG_DEFAULT }))}>Kembalikan bawaan</button>
      </div>
    </div>
  )
}

function Akun() {
  const toast = useToast()
  const { user } = useAuth()
  const users = useLiveQuery(() => db.users.toArray()) ?? []
  const [baru, setBaru] = useState(false)
  const [f, setF] = useState({ nama: '', username: '', password: '', role: 'kader' as Role })
  const [galat, setGalat] = useState<string | null>(null)
  const [reset, setReset] = useState<number | null>(null)
  const [sandi, setSandi] = useState('')

  async function tambah() {
    if (!f.nama.trim() || !f.username.trim() || f.password.length < 6) return setGalat('Lengkapi data. Kata sandi minimal 6 karakter.')
    if (await db.users.where('username').equals(f.username.trim().toLowerCase()).first()) return setGalat('Nama pengguna sudah dipakai.')
    await buatUser(f.nama.trim(), f.username, f.password, f.role)
    setBaru(false); setF({ nama: '', username: '', password: '', role: 'kader' }); setGalat(null)
    toast('Akun dibuat')
  }

  return (
    <div className="kartu">
      <h3>Akun pengguna</h3>
      <div className="daftar" style={{ marginBottom: 12 }}>
        {users.map((u) => (
          <div key={u.id} className="item" style={{ cursor: 'default' }}>
            <div className="isi">
              <div className="nama">{u.nama}</div>
              <div className="sub"><span>{u.username}</span><Chip warna={u.role === 'admin' ? 'biru' : 'abu'}>{u.role === 'admin' ? 'Admin' : 'Kader'}</Chip>{!u.aktif && <Chip warna="merah">Nonaktif</Chip>}</div>
            </div>
            <button className="btn kecil" onClick={() => { setReset(u.id!); setSandi('') }}>Reset</button>
            {u.id !== user?.id && (
              <button className="btn kecil" onClick={() => db.users.update(u.id!, { aktif: !u.aktif })}>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
            )}
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setBaru(true)}>Tambah akun kader</button>

      {baru && (
        <Sheet judul="Akun baru" onTutup={() => setBaru(false)}>
          <Field label="Nama"><input className="input" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field>
          <Field label="Nama pengguna"><input className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Kata sandi awal"><input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Peran">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="kader">Kader</option><option value="admin">Admin</option>
            </select>
          </Field>
          {galat && <div className="banner bahaya">{galat}</div>}
          <div className="aksi-bawah"><button className="btn" onClick={() => setBaru(false)}>Batal</button><button className="btn utama" onClick={tambah}>Buat akun</button></div>
        </Sheet>
      )}
      {reset !== null && (
        <Sheet judul="Reset kata sandi" onTutup={() => setReset(null)}>
          <Field label="Kata sandi baru"><input className="input" type="text" value={sandi} onChange={(e) => setSandi(e.target.value)} /></Field>
          <div className="aksi-bawah">
            <button className="btn" onClick={() => setReset(null)}>Batal</button>
            <button className="btn utama" disabled={sandi.length < 6} onClick={async () => { await gantiPassword(reset, sandi); setReset(null); toast('Kata sandi direset') }}>Simpan</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function Data() {
  const toast = useToast()
  const { cloud } = useAuth()
  const jumlah = useLiveQuery(() => db.warga.count()) ?? 0
  const [konf, setKonf] = useState<null | 'contoh' | 'hapus' | { json: string }>(null)
  const [sibuk, setSibuk] = useState(false)

  async function cadangan() {
    const tgl = new Date().toISOString().slice(0, 10)
    unduhTeks(`cadangan-posyandu-${tgl}.json`, await eksporSemua(), 'application/json')
  }
  async function pilihPulihkan(f?: File) {
    if (f) setKonf({ json: await f.text() })
  }

  return (
    <div className="kartu">
      <h3>Data dan cadangan</h3>
      <div className="banner info kecil">
        {cloud
          ? 'Data tersinkron ke server bersama dan tetap tersimpan di perangkat ini. Cadangan JSON tetap disarankan.'
          : 'Data tersimpan di browser perangkat ini, belum otomatis tersinkron ke HP lain. Unduh cadangan secara berkala dan simpan di tempat aman.'}
      </div>
      <div className="daftar">
        <button className="btn penuh" onClick={cadangan}>Unduh cadangan (JSON)</button>
        <Link className="btn penuh" to="/warga/impor">Impor data warga (CSV)</Link>
        {cloud ? (
          <p className="petunjuk">Pulihkan cadangan, data contoh, dan hapus massal dimatikan saat terhubung ke server bersama, supaya data nyata tidak tertimpa atau tercampur data uji.</p>
        ) : (
          <>
            <label className="btn penuh" style={{ cursor: 'pointer' }}>
              Pulihkan dari cadangan
              <input type="file" accept="application/json,.json" hidden onChange={(e) => pilihPulihkan(e.target.files?.[0])} />
            </label>
            <button className="btn penuh" onClick={() => setKonf('contoh')} disabled={jumlah > 0}>Muat data contoh (fiktif)</button>
            <button className="btn penuh bahaya" onClick={() => setKonf('hapus')}>Hapus semua data warga dan kegiatan</button>
          </>
        )}
      </div>

      {konf === 'contoh' && (
        <Konfirmasi judul="Muat data contoh?" teks="Menambahkan sekitar 60 warga fiktif dan kegiatan Januari–Oktober 2026 untuk latihan dan uji laporan."
          onYa={async () => { setSibuk(true); const r = await muatDataContoh(); setSibuk(false); setKonf(null); toast(`${r.warga} warga dan ${r.kegiatan} kegiatan contoh dimuat`) }} onBatal={() => setKonf(null)} labelYa={sibuk ? 'Memuat…' : 'Muat'} />
      )}
      {konf === 'hapus' && (
        <Konfirmasi judul="Hapus semua data?" bahaya labelYa="Hapus permanen"
          teks="Seluruh warga, kegiatan, pemeriksaan, dan catatan akan dihapus. Akun pengguna dan pengaturan tetap ada. Unduh cadangan dulu bila ragu."
          onYa={async () => {
            await db.transaction('rw', [db.warga, db.kegiatan, db.kunjungan, db.pemeriksaan, db.statusKhusus, db.layananObat, db.imunisasi, db.kehamilan], async () => {
              await Promise.all([db.warga.clear(), db.kegiatan.clear(), db.kunjungan.clear(), db.pemeriksaan.clear(), db.statusKhusus.clear(), db.layananObat.clear(), db.imunisasi.clear(), db.kehamilan.clear()])
            })
            setKonf(null); toast('Data dihapus')
          }} onBatal={() => setKonf(null)} />
      )}
      {konf && typeof konf === 'object' && (
        <Konfirmasi judul="Pulihkan dari cadangan?" bahaya labelYa="Timpa semua data"
          teks="Semua data di perangkat ini akan diganti dengan isi berkas cadangan, termasuk akun pengguna."
          onYa={async () => {
            try { await impor(konf.json); await inisialisasi(); toast('Cadangan dipulihkan'); setKonf(null) }
            catch (e) { setKonf(null); toast(e instanceof Error ? e.message : 'Gagal memulihkan') }
          }} onBatal={() => setKonf(null)} />
      )}
    </div>
  )
}

function Audit() {
  const log = useLiveQuery(() => db.audit.orderBy('waktu').reverse().limit(30).toArray()) ?? []
  return (
    <div className="kartu">
      <h3>Riwayat perubahan (30 terakhir)</h3>
      {log.length === 0 ? <p className="redup">Belum ada catatan.</p> : (
        <div className="tabel-gulir">
          <table className="tabel">
            <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Keterangan</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{l.user}</td><td>{l.aksi} {l.entitas}</td><td>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Server() {
  const { cloud } = useAuth()
  const toast = useToast()
  const st = useStatusSinkron()
  const [konf, setKonf] = useState(false)
  return (
    <div className="kartu">
      <h3>Server bersama (sinkronisasi)</h3>
      {!cloud ? (
        <>
          <p className="petunjuk">Hubungkan ke proyek Supabase agar beberapa kader memakai data yang sama dari HP masing-masing. Langkah pembuatan proyek ada di docs/supabase.md.</p>
          <FormServer />
        </>
      ) : (
        <>
          <div className="banner sukses kecil">Terhubung ke server.</div>
          {st && (
            <p className="kecil">
              {st.tunggu} perubahan menunggu dikirim
              {st.terakhir ? ` · sinkron terakhir ${new Date(st.terakhir).toLocaleTimeString('id-ID', { timeStyle: 'short' })}` : ''}
              {st.ditolak ? ` · ${st.ditolak} ditolak server` : ''}
              {st.dilewati ? ` · ${st.dilewati} baris bentrok dilewati` : ''}
              {st.galat ? ` · galat: ${st.galat}` : ''}
            </p>
          )}
          <div className="baris">
            <button className="btn" onClick={async () => { await getSinkron()?.jalankan(); toast('Sinkron selesai') }}>Sinkron sekarang</button>
            <button className="btn" onClick={() => setKonf(true)}>Unggah semua data perangkat ini</button>
          </div>
          <p className="petunjuk">Gunakan "Unggah semua" hanya di <b>satu</b> perangkat yang sudah berisi data lama, sekali saja, saat pertama menghubungkan. Perangkat lain sebaiknya mulai kosong dan mengambil data dari server.</p>
          <div className="baris" style={{ marginTop: 10 }}>
            <button className="btn" onClick={async () => {
              const t = buatTautan()
              if (!t) return
              try { await navigator.clipboard.writeText(t); toast('Tautan disalin. Kirim ke kader lewat WhatsApp.') }
              catch { window.prompt('Salin tautan ini lalu kirim ke kader:', t) }
            }}>Salin tautan untuk HP kader</button>
          </div>
          <p className="petunjuk">Kader cukup membuka tautan itu di HP-nya, menyetujui, lalu masuk dengan akunnya. Tidak perlu mengetik alamat server.</p>
          <details style={{ marginTop: 10 }}>
            <summary>Ubah atau putuskan server</summary>
            <div style={{ marginTop: 10 }}><FormServer /></div>
          </details>
          {konf && (
            <Konfirmasi judul="Unggah semua data?" teks="Seluruh warga, kegiatan, dan pemeriksaan di perangkat ini dikirim ke server. Data dengan id yang sama akan ditimpa."
              labelYa="Unggah" onYa={async () => { const n = await getSinkron()!.unggahSemua(); setKonf(false); toast(`${n} baris diantrekan`); void getSinkron()?.jalankan() }} onBatal={() => setKonf(false)} />
          )}
        </>
      )}
    </div>
  )
}

function ProfilCloud() {
  const { user } = useAuth()
  const toast = useToast()
  const [daftar, setDaftar] = useState<Profil[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [baru, setBaru] = useState(false)
  const [f, setF] = useState({ nama: '', username: '', password: '', role: 'kader' as 'admin' | 'kader' })
  const [galatForm, setGalatForm] = useState<string | null>(null)
  const [proses, setProses] = useState(false)
  async function buat() {
    if (!f.nama.trim()) return setGalatForm('Nama wajib diisi.')
    setProses(true)
    const g = await buatAkunKader(f.nama, f.username, f.password, f.role)
    setProses(false)
    if (g) return setGalatForm(g)
    setBaru(false)
    setGalatForm(null)
    setF({ nama: '', username: '', password: '', role: 'kader' })
    toast('Akun dibuat dan diaktifkan')
    await muat()
  }
  const muat = async () => {
    const { data, error } = await getKlien().from('profiles').select('*').order('username')
    if (error) setGalat(error.message)
    else setDaftar(data as Profil[])
  }
  useEffect(() => { void muat() }, [])
  async function ubah(p: Profil, patch: Partial<Profil>) {
    const { error } = await getKlien().from('profiles').update(patch).eq('id', p.id)
    if (error) toast(error.message)
    else await muat()
  }
  return (
    <div className="kartu">
      <h3>Akun kader</h3>
      {galat && <div className="banner bahaya">{galat}</div>}
      <button className="btn utama" style={{ marginBottom: 12 }} onClick={() => setBaru(true)}>Buat akun kader</button>
      <div className="daftar">
        {(daftar ?? []).map((p) => (
          <div key={p.id} className="item" style={{ cursor: 'default', flexWrap: 'wrap' }}>
            <div className="isi">
              <div className="nama">{p.nama || p.username}</div>
              <div className="sub"><span>{p.username}</span><Chip warna={p.role === 'admin' ? 'biru' : 'abu'}>{p.role === 'admin' ? 'Admin' : 'Kader'}</Chip>{!p.aktif && <Chip warna="merah">Nonaktif</Chip>}</div>
            </div>
            {p.username !== user?.username && (
              <>
                <button className="btn kecil" onClick={() => ubah(p, { role: p.role === 'admin' ? 'kader' : 'admin' })}>{p.role === 'admin' ? 'Jadikan Kader' : 'Jadikan Admin'}</button>
                <button className="btn kecil" onClick={() => ubah(p, { aktif: !p.aktif })}>{p.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
              </>
            )}
          </div>
        ))}
      </div>
      {baru && (
        <Sheet judul="Akun baru" onTutup={() => setBaru(false)}>
          <Field label="Nama lengkap"><input className="input" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field>
          <Field label="Nama pengguna" petunjuk="Dipakai untuk masuk. Huruf kecil, angka, titik, garis bawah, strip."><input className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
          <Field label="Kata sandi awal" petunjuk="Minimal 6 karakter. Kader bisa menggantinya sendiri di menu Lainnya."><input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Peran">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'admin' | 'kader' })}>
              <option value="kader">Kader</option><option value="admin">Admin</option>
            </select>
          </Field>
          {galatForm && <div className="banner bahaya">{galatForm}</div>}
          <div className="aksi-bawah"><button className="btn" onClick={() => setBaru(false)}>Batal</button><button className="btn utama" onClick={buat} disabled={proses}>{proses ? 'Membuat…' : 'Buat akun'}</button></div>
        </Sheet>
      )}
    </div>
  )
}
