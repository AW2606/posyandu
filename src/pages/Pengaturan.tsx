import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarAkun, Chip, Field, Ikon, JudulKartu, KepalaHalaman, Konfirmasi, Logo, Sheet, useToast } from '../components/ui'
import { FormServer } from '../components/FormServer'
import { buatUser, gantiPassword, useAuth } from '../lib/auth'
import { buatAkunKader, buatTautan, getKlien, getSinkron, hapusAkun, pesanServer, useStatusSinkron, type Profil } from '../lib/cloud'
import { BATAS_AUDIT, catat, db, eksporSemua, getPengaturan, impor, inisialisasi, simpanPengaturan, type AuditLog, type Pengaturan as TPengaturan, type Role } from '../lib/db'
import { bolehKelolaAkun, bolehLepasSuperAdmin, NAMA_PERAN, peranBolehDiberi } from '../lib/peran'
import { unduhTeks } from '../lib/csv'
import { usePengaturan, useKategori } from '../lib/hooks'
import { muatDataContoh } from '../lib/seed'
import { hexKategori } from '../components/ui'
import { KATEGORI_DEFAULT } from '../lib/age'
import { AMBANG_DEFAULT } from '../lib/health'

export default function Pengaturan() {
  const { user, isAdmin, isSuper, cloud } = useAuth()
  const sub = isSuper
    ? 'Kata sandi, akun, identitas Posyandu, ambang batas, server, cadangan data, dan riwayat perubahan.'
    : isAdmin
      ? 'Kata sandi, akun kader, identitas Posyandu, kategori umur, dan ambang batas.'
      : 'Ganti kata sandi akun Anda.'
  return (
    <>
      <KepalaHalaman label="Pengaturan" judul="Lainnya" sub={sub} />
      <div className="kolom-masonry">
        <Link to="/profil" className="kartu kartu-profil-tautan">
          <AvatarAkun nama={user!.nama} foto={user!.foto} className={`avatar ${user!.role === 'superadmin' ? 'ungu' : user!.role === 'admin' ? 'biru' : ''}`} />
          <div>
            <b>{user!.nama}</b>
            <small>{NAMA_PERAN[user!.role]} · @{user!.username}</small>
            <small>Ubah foto, nama, nama pengguna, dan kata sandi</small>
          </div>
          <span className="btn-ikon"><Ikon nama="panah" ukuran={18} /></span>
        </Link>
        {isAdmin ? (
          <>
            {cloud ? <ProfilCloud /> : <Akun />}
            <Identitas />
            <Kategori />
            <Ambang />
            {/* khusus super admin (pengelola sistem): server, cadangan data, riwayat perubahan */}
            {isSuper && (
              <>
                <Data />
                <Server />
                <Audit />
              </>
            )}
            {!isSuper && (
              <div className="banner info"><Ikon nama="info" ukuran={22} /> Server, cadangan data, dan riwayat perubahan diatur oleh Super admin (pengelola sistem).</div>
            )}
          </>
        ) : (
          <div className="banner info"><Ikon nama="info" ukuran={22} /> Pengaturan lain hanya bisa diubah Admin.</div>
        )}
      </div>
      <p className="kaki-versi"><Logo ukuran={26} /> Posyandu Bangau · Portal Kader v0.1</p>
    </>
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
      <JudulKartu ikon="rumah">Identitas Posyandu</JudulKartu>
      <p className="petunjuk" style={{ marginTop: -8 }}>Dipakai di kop dan kolom tanda tangan laporan.</p>
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
      <button className="btn utama" onClick={async () => {
        // simpan identitas saja; ambang memakai nilai terbaru supaya tidak tertimpa salinan lama
        const kini = await getPengaturan()
        await simpanPengaturan({ ...d, ambang: kini.ambang })
        toast('Pengaturan disimpan')
      }}>Simpan</button>
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
      <JudulKartu ikon="warga" warna="koral">Kategori sasaran</JudulKartu>
      <p className="petunjuk">Umur dalam tahun penuh. Batas bawah termasuk, batas atas tidak. Contoh: Balita 0 sampai 6 berarti 0-5 tahun.</p>
      {urut.map((c, j) => {
        const i = d.indexOf(c)
        return (
          <div key={c.kode} className="baris-kategori">
            <i style={{ background: hexKategori(c.kode, j) }} />
            <b>{c.nama}</b>
            <input className="input" inputMode="numeric" aria-label={`${c.nama} dari`} value={c.umurMin} onChange={(e) => ubah(i, 'umurMin', e.target.value)} />
            <span>s/d</span>
            <input className="input" inputMode="numeric" placeholder="∞" aria-label={`${c.nama} sampai`} value={c.umurMax ?? ''} onChange={(e) => ubah(i, 'umurMax', e.target.value)} />
          </div>
        )
      })}
      {galat && <div className="banner peringatan">{galat}</div>}
      <div className="baris">
        <button className="btn utama" disabled={!!galat} onClick={async () => { await db.kategori.bulkPut(d); await catat('ubah', 'kategori', 'Batas umur kategori diubah'); toast('Kategori disimpan') }}>Simpan</button>
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
    ['imtSangatKurus', 'IMT dewasa: di bawah ini sangat kurus'],
    ['imtObesitas', 'IMT dewasa: di atas ini obesitas'],
    ['tdRendahSistol', 'Tensi rendah jika sistol < (mmHg)'],
    ['tdRendahDiastol', 'Tensi rendah jika diastol < (mmHg)'],
    ['gulaDarahRendah', 'Gula darah rendah jika < (mg/dl)'],
    ['lilaKek', 'LILA ibu hamil KEK jika < (cm)'],
    ['lilaBalitaBuruk', 'LILA balita 6-59 bln gizi buruk jika < (cm)'],
    ['lilaBalitaKurang', 'LILA balita 6-59 bln gizi kurang jika < (cm)'],
    ['hbAnemiaRemaja', 'Hb remaja putri anemia jika < (g/dl)'],
    ['hbAnemiaHamil', 'Hb ibu hamil anemia jika < (g/dl)'],
    ['pumaTinggi', 'Skor PUMA berisiko PPOK jika ≥'],
  ]
  return (
    <div className="kartu">
      <JudulKartu ikon="timbangan" warna="biru">Ambang batas pemeriksaan</JudulKartu>
      <p className="petunjuk">Angka bawaan perlu dikonfirmasi ke bidan Puskesmas. Sistem hanya memberi penanda, bukan diagnosis. Status gizi balita dan anak di bawah 18 tahun dihitung dengan standar WHO (Permenkes 2/2020), bukan dengan IMT dewasa.</p>
      {lab.map(([k, l]) => (
        <Field key={k} label={l}>
          <input className="input" inputMode="decimal" value={d.ambang[k]} onChange={(e) => setD((x) => ({ ...x, ambang: { ...x.ambang, [k]: Number(e.target.value.replace(',', '.')) || 0 } }))} />
        </Field>
      ))}
      <div className="baris">
        <button className="btn utama" onClick={async () => {
          // simpan ambang saja di atas pengaturan terbaru
          const kini = await getPengaturan()
          await simpanPengaturan({ ...kini, ambang: d.ambang })
          await catat('ubah', 'ambang batas', 'Ambang batas pemeriksaan diubah')
          toast('Ambang disimpan')
        }}>Simpan</button>
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
  const [hapus, setHapus] = useState<{ id: number; nama: string } | null>(null)

  const pilihanPeran = peranBolehDiberi(user?.role)
  const lepasAman = (id: number) => bolehLepasSuperAdmin(users.map((u) => ({ id: u.id!, role: u.role, aktif: u.aktif })), id)

  async function tambah() {
    if (!f.nama.trim() || !f.username.trim() || f.password.length < 6) return setGalat('Lengkapi data. Kata sandi minimal 6 karakter.')
    if (!pilihanPeran.includes(f.role)) return setGalat('Anda tidak boleh membuat akun dengan peran itu.')
    if (await db.users.where('username').equals(f.username.trim().toLowerCase()).first()) return setGalat('Nama pengguna sudah dipakai.')
    await buatUser(f.nama.trim(), f.username, f.password, f.role)
    await catat('tambah', 'akun', `@${f.username.trim().toLowerCase()} (${NAMA_PERAN[f.role]})`)
    setBaru(false); setF({ nama: '', username: '', password: '', role: 'kader' }); setGalat(null)
    toast('Akun dibuat')
  }

  return (
    <div className="kartu">
      <JudulKartu ikon="warga" ekor={<button className="btn ajakan kecil" onClick={() => setBaru(true)}><Ikon nama="tambah" ukuran={18} /> Buat akun</button>}>{pilihanPeran.includes('admin') ? 'Akun pengguna' : 'Akun kader'}</JudulKartu>
      <div className="daftar-akun">
        {users.map((u) => {
          const sendiri = u.id === user?.id
          const boleh = !sendiri && bolehKelolaAkun(user?.role, u.role)
          return (
            <BarisAkun key={u.id} nama={u.nama} username={u.username} role={u.role} aktif={u.aktif} sendiri={sendiri} foto={u.foto}>
              {(sendiri || boleh) && <button className="btn kecil" onClick={() => { setReset(u.id!); setSandi('') }}><Ikon nama="kunci" ukuran={16} /> Reset sandi</button>}
              {boleh && (
                <>
                  <button className="btn kecil" onClick={async () => {
                    if (u.aktif && !lepasAman(u.id!)) return toast('Super admin terakhir tidak bisa dinonaktifkan')
                    await db.users.update(u.id!, { aktif: !u.aktif })
                    await catat(u.aktif ? 'arsip' : 'pulihkan', 'akun', `@${u.username} ${u.aktif ? 'dinonaktifkan' : 'diaktifkan'}`)
                  }}>{u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="btn kecil bahaya" onClick={() => setHapus({ id: u.id!, nama: u.nama })}><Ikon nama="arsip" ukuran={16} /> Hapus</button>
                </>
              )}
            </BarisAkun>
          )
        })}
      </div>
      {hapus && (
        <Konfirmasi
          judul="Hapus akun?"
          teks={`Akun ${hapus.nama} dihapus permanen dan tidak bisa dipakai masuk lagi. Data warga dan pemeriksaan yang pernah dicatatnya tetap ada.`}
          labelYa="Hapus akun"
          bahaya
          onYa={async () => {
            if (!lepasAman(hapus.id)) { setHapus(null); return toast('Super admin terakhir tidak bisa dihapus') }
            const u = users.find((x) => x.id === hapus.id)
            await db.users.delete(hapus.id)
            await catat('hapus', 'akun', `@${u?.username ?? hapus.nama}`)
            setHapus(null); toast('Akun dihapus')
          }}
          onBatal={() => setHapus(null)}
        />
      )}

      {baru && (
        <Sheet judul="Akun baru" sub="Akun untuk kader atau admin" ikon="orang" onTutup={() => setBaru(false)}>
          <Field label="Nama"><input className="input" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field>
          <Field label="Nama pengguna"><input className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Kata sandi awal"><input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          {pilihanPeran.length > 1 && (
            <Field label="Peran">
              <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
                {pilihanPeran.map((r) => <option key={r} value={r}>{NAMA_PERAN[r]}</option>)}
              </select>
            </Field>
          )}
          {galat && <div className="banner bahaya">{galat}</div>}
          <div className="aksi-bawah"><button className="btn" onClick={() => setBaru(false)}>Batal</button><button className="btn utama" onClick={tambah}>Buat akun</button></div>
        </Sheet>
      )}
      {reset !== null && (
        <Sheet judul="Reset kata sandi" ikon="kunci" onTutup={() => setReset(null)}>
          <Field label="Kata sandi baru"><input className="input" type="text" value={sandi} onChange={(e) => setSandi(e.target.value)} /></Field>
          <div className="aksi-bawah">
            <button className="btn" onClick={() => setReset(null)}>Batal</button>
            <button className="btn utama" disabled={sandi.length < 6} onClick={async () => {
              await gantiPassword(reset, sandi)
              await catat('ubah', 'akun', `Kata sandi @${users.find((x) => x.id === reset)?.username ?? ''} direset`)
              setReset(null); toast('Kata sandi direset')
            }}>Simpan</button>
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
      <JudulKartu ikon="basisdata" warna="ungu">Data dan cadangan</JudulKartu>
      <div className="banner info kecil">
        <Ikon nama="info" ukuran={20} />
        {cloud
          ? 'Data tersinkron ke server bersama dan tetap tersimpan di perangkat ini. Cadangan JSON tetap disarankan.'
          : 'Data tersimpan di browser perangkat ini, belum otomatis tersinkron ke HP lain. Unduh cadangan secara berkala dan simpan di tempat aman.'}
      </div>
      <div className="daftar">
        <button className="btn penuh" onClick={cadangan}><Ikon nama="unduh" ukuran={20} /> Unduh cadangan (JSON)</button>
        <Link className="btn penuh" to="/warga/impor"><Ikon nama="unggah" ukuran={20} /> Impor data warga (CSV)</Link>
        {cloud ? (
          <p className="petunjuk">Pulihkan cadangan, data contoh, dan hapus massal dimatikan saat terhubung ke server bersama, supaya data nyata tidak tertimpa atau tercampur data uji.</p>
        ) : (
          <>
            <label className="btn penuh" style={{ cursor: 'pointer' }}>
              <Ikon nama="riwayat" ukuran={20} /> Pulihkan dari cadangan
              <input type="file" accept="application/json,.json" hidden onChange={(e) => pilihPulihkan(e.target.files?.[0])} />
            </label>
            <button className="btn penuh" onClick={() => setKonf('contoh')} disabled={jumlah > 0}>Muat data contoh (fiktif)</button>
            <button className="btn penuh bahaya" onClick={() => setKonf('hapus')}>Hapus semua data warga dan kegiatan</button>
          </>
        )}
      </div>

      {konf === 'contoh' && (
        <Konfirmasi judul="Muat data contoh?" teks="Menambahkan sekitar 60 warga fiktif dan kegiatan Januari-Oktober 2026 untuk latihan dan uji laporan."
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

const PER_HALAMAN_AUDIT = 8
const WARNA_AKSI: Record<string, 'hijau' | 'biru' | 'merah' | 'kuning' | 'abu'> = {
  tambah: 'hijau', impor: 'hijau', catat: 'biru', ubah: 'kuning', hapus: 'merah', arsip: 'merah', pulihkan: 'hijau',
}

function Audit() {
  const log = useLiveQuery(() => db.audit.orderBy('waktu').reverse().limit(BATAS_AUDIT).toArray()) ?? []
  const jalur = useRef<HTMLDivElement>(null)
  const [hal, setHal] = useState(0)
  const halaman: AuditLog[][] = []
  for (let i = 0; i < log.length; i += PER_HALAMAN_AUDIT) halaman.push(log.slice(i, i + PER_HALAMAN_AUDIT))
  const total = halaman.length

  // catatan lama terpangkas atau bertambah: jaga nomor halaman tetap sah
  useEffect(() => {
    if (hal > 0 && hal >= total) ke(total - 1)
  }, [total])

  function ke(i: number) {
    const el = jalur.current
    const n = Math.max(0, Math.min(total - 1, i))
    setHal(n)
    el?.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  function gulir() {
    const el = jalur.current
    if (el && el.clientWidth) setHal(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="kartu">
      <JudulKartu ikon="riwayat" warna="krem" ekor={<Chip>{log.length}/{BATAS_AUDIT}</Chip>}>Riwayat perubahan</JudulKartu>
      <p className="petunjuk" style={{ marginTop: -8 }}>Menyimpan {BATAS_AUDIT} perubahan terakhir. Catatan yang lebih lama terhapus otomatis.</p>
      {log.length === 0 ? <p className="redup">Belum ada catatan.</p> : (
        <>
          <div className="carousel" ref={jalur} onScroll={gulir} aria-roledescription="carousel" aria-label="Riwayat perubahan">
            {halaman.map((isi, i) => (
              <ul key={i} className="carousel-slide" aria-roledescription="slide" aria-label={`Halaman ${i + 1} dari ${total}`}>
                {isi.map((l) => (
                  <li key={l.id} className="baris-audit">
                    <Chip warna={WARNA_AKSI[l.aksi] ?? 'abu'}>{l.aksi}</Chip>
                    <div>
                      <b>{l.entitas}{l.detail ? `: ${l.detail}` : ''}</b>
                      <small>{l.user || 'sistem'} · {new Date(l.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
          {total > 1 && (
            <div className="carousel-kendali">
              <button type="button" className="btn-ikon" onClick={() => ke(hal - 1)} disabled={hal === 0} aria-label="Halaman sebelumnya"><Ikon nama="kiri" ukuran={18} /></button>
              <span>Halaman <b>{hal + 1}</b> dari {total}</span>
              <button type="button" className="btn-ikon" onClick={() => ke(hal + 1)} disabled={hal >= total - 1} aria-label="Halaman berikutnya"><Ikon nama="kanan" ukuran={18} /></button>
            </div>
          )}
        </>
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
      <JudulKartu ikon="awan" warna="biru" ekor={cloud ? <Chip warna="hijau" titik>Terhubung</Chip> : <Chip titik>Belum terhubung</Chip>}>Server bersama</JudulKartu>
      {!cloud ? (
        <>
          <p className="petunjuk">Hubungkan ke proyek Supabase agar beberapa kader memakai data yang sama dari HP masing-masing. Langkah pembuatan proyek ada di docs/supabase.md.</p>
          <FormServer />
        </>
      ) : (
        <>
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
            <button className="btn lembut kecil" onClick={async () => { await getSinkron()?.jalankan(); toast('Sinkron selesai') }}><Ikon nama="ulang" ukuran={18} /> Sinkron sekarang</button>
            <button className="btn kecil" onClick={() => setKonf(true)}><Ikon nama="unggah" ukuran={18} /> Unggah semua data perangkat ini</button>
          </div>
          <p className="petunjuk">Gunakan "Unggah semua" hanya di <b>satu</b> perangkat yang sudah berisi data lama, sekali saja, saat pertama menghubungkan. Perangkat lain sebaiknya mulai kosong dan mengambil data dari server.</p>
          <div className="baris" style={{ marginTop: 10 }}>
            <button className="btn kecil" onClick={async () => {
              const t = buatTautan()
              if (!t) return
              try { await navigator.clipboard.writeText(t); toast('Tautan disalin. Kirim ke kader lewat WhatsApp.') }
              catch { window.prompt('Salin tautan ini lalu kirim ke kader:', t) }
            }}><Ikon nama="tautan" ukuran={18} /> Salin tautan untuk HP kader</button>
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

/** Satu akun: identitas di atas, tombol aksi di bawah supaya tetap rapi di layar HP. */
function BarisAkun({ nama, username, role, aktif, sendiri, foto, children }: { nama: string; username: string; role: string; aktif: boolean; sendiri: boolean; foto?: string | null; children?: React.ReactNode }) {
  return (
    <div className={`akun ${aktif ? '' : 'nonaktif'}`}>
      <div className="akun-atas">
        <AvatarAkun nama={nama} foto={foto} className={`avatar ${aktif ? (role === 'superadmin' ? 'ungu' : role === 'admin' ? 'biru' : '') : 'krem'}`} />
        <div className="akun-isi">
          <b>{nama}</b>
          <div className="akun-sub">
            <span>@{username}</span>
            <Chip warna={role === 'superadmin' ? 'ungu' : role === 'admin' ? 'biru' : 'mint'}>{NAMA_PERAN[role as Role] ?? 'Kader'}</Chip>
            {!aktif && <Chip warna="merah">Nonaktif</Chip>}
            {sendiri && <Chip warna="kuning">Anda</Chip>}
          </div>
        </div>
      </div>
      {children && <div className="akun-aksi">{children}</div>}
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
  const [hapus, setHapus] = useState<Profil | null>(null)
  const [menghapus, setMenghapus] = useState(false)
  const pilihanPeran = peranBolehDiberi(user?.role)
  async function buat() {
    if (!f.nama.trim()) return setGalatForm('Nama wajib diisi.')
    if (!pilihanPeran.includes(f.role)) return setGalatForm('Anda tidak boleh membuat akun dengan peran itu.')
    setProses(true)
    const g = await buatAkunKader(f.nama, f.username, f.password, f.role)
    setProses(false)
    if (g) return setGalatForm(g)
    await catat('tambah', 'akun', `@${f.username.trim().toLowerCase()} (${NAMA_PERAN[f.role]})`)
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
  async function ubah(p: Profil, patch: Partial<Profil>, keterangan: string) {
    // ditolak juga oleh server bila peran tidak berhak; pemeriksaan di sini hanya supaya pesannya jelas
    if ((patch.aktif === false || (patch.role && patch.role !== 'superadmin')) && !bolehLepasSuperAdmin(daftar ?? [], p.id))
      return toast('Super admin terakhir tidak bisa diturunkan atau dinonaktifkan')
    const { error } = await getKlien().from('profiles').update(patch).eq('id', p.id)
    if (error) return toast(pesanServer(error.message))
    await catat('ubah', 'akun', `@${p.username} ${keterangan}`)
    await muat()
  }
  return (
    <div className="kartu">
      <JudulKartu ikon="warga" ekor={<button className="btn ajakan kecil" onClick={() => setBaru(true)}><Ikon nama="tambah" ukuran={18} /> Buat akun</button>}>{pilihanPeran.includes('admin') ? 'Akun pengguna' : 'Akun kader'}</JudulKartu>
      {galat && <div className="banner bahaya">{galat}</div>}
      <div className="daftar-akun">
        {(daftar ?? []).map((p) => {
          const sendiri = p.username === user?.username
          const boleh = !sendiri && bolehKelolaAkun(user?.role, p.role)
          // hanya super admin yang bisa menaikkan/menurunkan antara kader dan admin
          const bolehGantiPeran = boleh && pilihanPeran.includes('admin') && p.role !== 'superadmin'
          return (
            <BarisAkun key={p.id} nama={p.nama || p.username} username={p.username} role={p.role} aktif={p.aktif} sendiri={sendiri} foto={p.foto}>
              {boleh && (
                <>
                  {bolehGantiPeran && (
                    <button className="btn kecil" onClick={() => {
                      const r: Role = p.role === 'admin' ? 'kader' : 'admin'
                      void ubah(p, { role: r }, `dijadikan ${NAMA_PERAN[r]}`)
                    }}>{p.role === 'admin' ? 'Jadikan Kader' : 'Jadikan Admin'}</button>
                  )}
                  <button className="btn kecil" onClick={() => ubah(p, { aktif: !p.aktif }, p.aktif ? 'dinonaktifkan' : 'diaktifkan')}>{p.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="btn kecil bahaya" onClick={() => setHapus(p)}><Ikon nama="arsip" ukuran={16} /> Hapus</button>
                </>
              )}
            </BarisAkun>
          )
        })}
      </div>
      {hapus && (
        <Konfirmasi
          judul="Hapus akun?"
          teks={`Akun ${hapus.nama || hapus.username} dihapus permanen dari server dan tidak bisa dipakai masuk lagi. Data warga dan pemeriksaan yang pernah dicatatnya tetap ada. Nama pengguna @${hapus.username} bisa dipakai lagi.`}
          labelYa={menghapus ? 'Menghapus…' : 'Hapus akun'}
          bahaya
          onYa={async () => {
            if (menghapus) return
            if (!bolehLepasSuperAdmin(daftar ?? [], hapus.id)) { setHapus(null); return toast('Super admin terakhir tidak bisa dihapus') }
            setMenghapus(true)
            const g = await hapusAkun(hapus.id)
            setMenghapus(false)
            setHapus(null)
            if (g) return toast(g)
            await catat('hapus', 'akun', `@${hapus.username}`)
            toast('Akun dihapus')
            await muat()
          }}
          onBatal={() => setHapus(null)}
        />
      )}
      {baru && (
        <Sheet judul="Akun baru" sub="Akun untuk kader atau admin" ikon="orang" onTutup={() => setBaru(false)}>
          <Field label="Nama lengkap"><input className="input" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field>
          <Field label="Nama pengguna" petunjuk="Dipakai untuk masuk. Huruf kecil, angka, titik, garis bawah, strip."><input className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
          <Field label="Kata sandi awal" petunjuk="Minimal 6 karakter. Kader bisa menggantinya sendiri di menu Lainnya."><input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          {pilihanPeran.length > 1 && (
            <Field label="Peran">
              <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as 'admin' | 'kader' })}>
                {pilihanPeran.map((r) => <option key={r} value={r}>{NAMA_PERAN[r]}</option>)}
              </select>
            </Field>
          )}
          {galatForm && <div className="banner bahaya">{galatForm}</div>}
          <div className="aksi-bawah"><button className="btn" onClick={() => setBaru(false)}>Batal</button><button className="btn utama" onClick={buat} disabled={proses}>{proses ? 'Membuat…' : 'Buat akun'}</button></div>
        </Sheet>
      )}
    </div>
  )
}
