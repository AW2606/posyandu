import { useRef, useState } from 'react'
import { AvatarAkun, Chip, Daun, Field, Ikon, JudulKartu, KepalaHalaman, Konfirmasi, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import AturFoto from '../components/AturFoto'
import { cekBerkasFoto } from '../lib/foto'
import { NAMA_PERAN } from '../lib/peran'
import { gantiSandiSendiri, simpanProfil, validasiProfil, validasiSandi } from '../lib/profil'

const WARNA_PERAN = { superadmin: 'ungu', admin: 'biru', kader: 'mint' } as const

/** Profil akun sendiri: foto, nama, nama pengguna, dan kata sandi. */
export default function Profil() {
  const { user, cloud, perbaruiSesi } = useAuth()
  const toast = useToast()
  const u = user!
  const akun = { cloud, id: u.id, username: u.username }

  // ---- foto
  const pilihBerkas = useRef<HTMLInputElement>(null)
  const [prosesFoto, setProsesFoto] = useState(false)
  const [konfHapusFoto, setKonfHapusFoto] = useState(false)
  async function simpanFoto(foto: string | null): Promise<boolean> {
    setProsesFoto(true)
    const g = await simpanProfil(akun, { nama: u.nama, username: u.username, foto })
    setProsesFoto(false)
    if (g) { toast(g); return false }
    perbaruiSesi({ foto })
    toast(foto ? 'Foto profil diganti' : 'Foto profil dihapus')
    return true
  }
  // berkas terpilih dibuka di pratinjau dulu; baru disimpan setelah posisinya diatur
  const [berkas, setBerkas] = useState<File | null>(null)
  function saatPilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // supaya berkas yang sama bisa dipilih lagi
    if (!f) return
    const g = cekBerkasFoto(f)
    if (g) return toast(g)
    setBerkas(f)
  }
  async function pakaiFoto(url: string): Promise<boolean> {
    const ok = await simpanFoto(url)
    if (ok) setBerkas(null) // gagal: pratinjau tetap terbuka supaya bisa dicoba lagi
    return ok
  }

  // ---- data akun
  const [nama, setNama] = useState(u.nama)
  const [username, setUsername] = useState(u.username)
  const [galat, setGalat] = useState<Partial<Record<'nama' | 'username', string>>>({})
  const [simpanData, setSimpanData] = useState(false)
  const berubah = nama.trim() !== u.nama || username.trim().toLowerCase() !== u.username
  const gantiUsername = username.trim().toLowerCase() !== u.username
  async function kirimData(e: React.FormEvent) {
    e.preventDefault()
    const g = validasiProfil({ nama, username })
    setGalat(g)
    if (Object.keys(g).length) return
    setSimpanData(true)
    const pesan = await simpanProfil(akun, { nama, username, foto: u.foto ?? null })
    setSimpanData(false)
    if (pesan) return setGalat(/nama pengguna/i.test(pesan) ? { username: pesan } : { nama: pesan })
    perbaruiSesi({ nama: nama.trim(), username: username.trim().toLowerCase() })
    toast(gantiUsername ? 'Profil disimpan. Masuk berikutnya pakai nama pengguna baru.' : 'Profil disimpan')
  }

  // ---- kata sandi
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [lihat, setLihat] = useState(false)
  const [galatSandi, setGalatSandi] = useState<string | null>(null)
  const [simpanSandi, setSimpanSandi] = useState(false)
  async function kirimSandi(e: React.FormEvent) {
    e.preventDefault()
    const g = !lama ? 'Isi kata sandi lama.' : validasiSandi(baru, ulang)
    setGalatSandi(g)
    if (g) return
    setSimpanSandi(true)
    const pesan = await gantiSandiSendiri(akun, lama, baru)
    setSimpanSandi(false)
    if (pesan) return setGalatSandi(pesan)
    setLama(''); setBaru(''); setUlang('')
    toast('Kata sandi diganti')
  }
  const tipe = lihat ? 'text' : 'password'

  return (
    <>
      <KepalaHalaman label="Akun" judul="Profil saya" sub="Foto, nama, nama pengguna, dan kata sandi akun Anda." />
      <div className="dua-kolom profil">
        <div>
          <div className="kartu kartu-profil">
            <div className="sampul" aria-hidden><Daun className="sampul-daun" /></div>
            <div className="profil-atas">
              <div className="foto-profil">
                <AvatarAkun nama={u.nama} foto={u.foto} className={`avatar besar ${WARNA_PERAN[u.role]}`} />
                <button type="button" className="tombol-kamera" onClick={() => pilihBerkas.current?.click()} disabled={prosesFoto} aria-label="Ganti foto profil" title="Ganti foto profil">
                  <Ikon nama="kamera" ukuran={18} />
                </button>
              </div>
              <div style={{ minWidth: 0 }}>
                <h2>{u.nama}</h2>
                <div className="baris" style={{ gap: 6, marginTop: 8 }}>
                  <Chip warna={WARNA_PERAN[u.role]}>{NAMA_PERAN[u.role]}</Chip>
                  <Chip>@{u.username}</Chip>
                </div>
              </div>
            </div>
            <input ref={pilihBerkas} type="file" accept="image/*" hidden onChange={saatPilih} />
            <div className="baris">
              <button type="button" className="btn kecil utama" onClick={() => pilihBerkas.current?.click()} disabled={prosesFoto}>
                <Ikon nama="kamera" ukuran={17} /> {prosesFoto ? 'Memproses…' : u.foto ? 'Ganti foto' : 'Pasang foto'}
              </button>
              {u.foto && (
                <button type="button" className="btn kecil" onClick={() => setKonfHapusFoto(true)} disabled={prosesFoto}>
                  <Ikon nama="tutup" ukuran={17} /> Hapus foto
                </button>
              )}
            </div>
            <p className="petunjuk">Bisa dari galeri atau kamera. Sebelum disimpan, posisi dan ukuran foto bisa diatur dulu.</p>
          </div>
        </div>

        <div>
          <form className="kartu" onSubmit={kirimData}>
            <JudulKartu ikon="orang">Data akun</JudulKartu>
            <Field label="Nama lengkap" galat={galat.nama}>
              <input className={`input ${galat.nama ? 'salah' : ''}`} value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" />
            </Field>
            <Field
              label="Nama pengguna"
              galat={galat.username}
              petunjuk={gantiUsername ? 'Setelah disimpan, masuk berikutnya memakai nama pengguna baru ini.' : 'Dipakai untuk masuk. Huruf kecil, angka, titik, garis bawah, strip.'}
            >
              <input className={`input ${galat.username ? 'salah' : ''}`} value={username} autoCapitalize="none" autoComplete="username" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} />
            </Field>
            <div className="baris">
              <button className="btn utama" disabled={!berubah || simpanData}><Ikon nama="centang" ukuran={18} tebal={2.4} /> {simpanData ? 'Menyimpan…' : 'Simpan profil'}</button>
              {berubah && <button type="button" className="btn" onClick={() => { setNama(u.nama); setUsername(u.username); setGalat({}) }}>Batal</button>}
            </div>
          </form>

          <form className="kartu" onSubmit={kirimSandi}>
            <JudulKartu ikon="kunci" warna="kuning">Ganti kata sandi</JudulKartu>
            <Field label="Kata sandi lama">
              <input className="input" type={tipe} autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} />
            </Field>
            <div className="grid2 tumpuk">
              <Field label="Kata sandi baru" petunjuk="Minimal 6 karakter.">
                <input className="input" type={tipe} autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} />
              </Field>
              <Field label="Ulangi kata sandi baru">
                <input className="input" type={tipe} autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} />
              </Field>
            </div>
            <label className="kotak-centang">
              <input type="checkbox" checked={lihat} onChange={(e) => setLihat(e.target.checked)} /> Tampilkan kata sandi
            </label>
            {galatSandi && <div className="banner bahaya"><Ikon nama="peringatan" ukuran={20} /> {galatSandi}</div>}
            <button className="btn utama" disabled={simpanSandi || !lama || !baru || !ulang}><Ikon nama="kunci" ukuran={18} /> {simpanSandi ? 'Menyimpan…' : 'Ganti kata sandi'}</button>
          </form>
        </div>
      </div>

      {berkas && (
        <AturFoto
          file={berkas}
          onBatal={() => setBerkas(null)}
          onPakai={pakaiFoto}
          onGanti={() => pilihBerkas.current?.click()}
        />
      )}

      {konfHapusFoto && (
        <Konfirmasi
          judul="Hapus foto profil?"
          teks="Foto diganti dengan inisial nama Anda. Anda bisa memasang foto lagi kapan saja."
          labelYa="Hapus foto"
          onYa={() => { setKonfHapusFoto(false); void simpanFoto(null) }}
          onBatal={() => setKonfHapusFoto(false)}
        />
      )}
    </>
  )
}
