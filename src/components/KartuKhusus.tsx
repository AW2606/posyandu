import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { perkiraanLahir, tglId, todayISO, umurBulan, usiaHamil } from '../lib/age'
import { catat, db, type Warga } from '../lib/db'
import { usePengaturan } from '../lib/hooks'
import { Chip, Field, Sheet, useToast } from './ui'

/** Imunisasi dasar: dipakai untuk bayi, lengkap bila semua jenis sudah tercatat. */
export function KartuImunisasi({ w }: { w: Warga }) {
  const p = usePengaturan()
  const toast = useToast()
  const catatan = useLiveQuery(() => db.imunisasi.where('wargaId').equals(w.id!).toArray(), [w.id]) ?? []
  const [pilih, setPilih] = useState<string | null>(null)
  const [tgl, setTgl] = useState(todayISO())
  const sudah = new Map(catatan.map((c) => [c.jenis, c]))
  const lengkap = p.imunisasiDasar.every((j) => sudah.has(j))

  async function simpan() {
    if (!pilih || !tgl) return
    if (tgl < w.tanggalLahir) return toast('Tanggal sebelum tanggal lahir')
    const lama = sudah.get(pilih)
    if (lama?.id) await db.imunisasi.update(lama.id, { tanggal: tgl })
    else await db.imunisasi.add({ wargaId: w.id!, jenis: pilih, tanggal: tgl })
    await catat('catat', 'imunisasi', `${w.nama}: ${pilih}`)
    setPilih(null)
  }
  async function hapus() {
    const lama = pilih ? sudah.get(pilih) : undefined
    if (lama?.id) await db.imunisasi.delete(lama.id)
    setPilih(null)
  }

  return (
    <div className="kartu">
      <div className="baris" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Imunisasi dasar</h3>
        <Chip warna={lengkap ? 'hijau' : 'kuning'}>
          {catatan.length}/{p.imunisasiDasar.length} {lengkap ? 'lengkap' : 'belum lengkap'}
        </Chip>
      </div>
      <div className="filter-baris" style={{ flexWrap: 'wrap', margin: '12px 0 0', padding: 0, overflow: 'visible' }}>
        {p.imunisasiDasar.map((j) => (
          <button key={j} className={`pil ${sudah.has(j) ? 'aktif' : ''}`} onClick={() => { setPilih(j); setTgl(sudah.get(j)?.tanggal ?? todayISO()) }}>
            {sudah.has(j) ? '✓ ' : ''}{j}
          </button>
        ))}
      </div>
      {pilih && (
        <Sheet judul={pilih} onTutup={() => setPilih(null)}>
          <Field label="Tanggal diberikan" petunjuk={`Umur saat itu: ${umurBulan(w.tanggalLahir, tgl)} bulan`}>
            <input className="input" type="date" value={tgl} max={todayISO()} onChange={(e) => setTgl(e.target.value)} />
          </Field>
          <div className="aksi-bawah">
            {sudah.has(pilih) && <button className="btn bahaya" onClick={hapus}>Hapus</button>}
            <button className="btn utama" onClick={simpan}>Simpan</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

/** Buku kesehatan ibu hamil digital: HPHT, taksiran lahir, persalinan. */
export function KartuKehamilan({ w }: { w: Warga }) {
  const toast = useToast()
  const daftar = useLiveQuery(() => db.kehamilan.where('wargaId').equals(w.id!).toArray(), [w.id]) ?? []
  const [form, setForm] = useState<null | { id?: number; hpht: string; catatan: string }>(null)
  const [lahir, setLahir] = useState<null | { id: number; tanggal: string; tempat: string; diFaskes: boolean }>(null)
  const ref = todayISO()
  const aktif = daftar.find((k) => !k.tanggalLahir)
  const riwayat = daftar.filter((k) => k.tanggalLahir).sort((a, b) => b.hpht.localeCompare(a.hpht))

  async function simpanHamil() {
    if (!form?.hpht) return
    if (form.hpht > ref) return toast('HPHT tidak boleh di masa depan')
    if (form.id) await db.kehamilan.update(form.id, { hpht: form.hpht, catatan: form.catatan })
    else await db.kehamilan.add({ wargaId: w.id!, hpht: form.hpht, catatan: form.catatan })
    await catat(form.id ? 'ubah' : 'tambah', 'kehamilan', w.nama)
    setForm(null)
  }
  async function simpanLahir() {
    if (!lahir?.tanggal) return
    const k = daftar.find((x) => x.id === lahir.id)
    if (k && lahir.tanggal < k.hpht) return toast('Tanggal persalinan sebelum HPHT')
    await db.kehamilan.update(lahir.id, { tanggalLahir: lahir.tanggal, tempat: lahir.tempat, diFaskes: lahir.diFaskes })
    // kehamilan selesai: akhiri penanda hamil bila masih aktif
    const st = await db.statusKhusus.where('wargaId').equals(w.id!).filter((s) => s.jenis === 'hamil' && !s.selesai).first()
    if (st?.id) await db.statusKhusus.update(st.id, { selesai: lahir.tanggal })
    await catat('catat', 'persalinan', w.nama)
    setLahir(null)
    toast('Persalinan dicatat')
  }

  return (
    <div className="kartu">
      <div className="baris" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Buku ibu hamil</h3>
        {!aktif && <button className="btn kecil utama" onClick={() => setForm({ hpht: '', catatan: '' })}>Kehamilan baru</button>}
      </div>
      {aktif ? (
        <div style={{ marginTop: 10 }}>
          <div className="grid2">
            <div className="stat"><div className="angka" style={{ fontSize: 17, whiteSpace: "nowrap" }}>{usiaHamil(aktif.hpht, ref)}</div><div className="lbl">Usia kehamilan</div></div>
            <div className="stat"><div className="angka" style={{ fontSize: 17, whiteSpace: "nowrap" }}>{tglId(perkiraanLahir(aktif.hpht))}</div><div className="lbl">Perkiraan lahir</div></div>
          </div>
          <p className="kecil redup">HPHT {tglId(aktif.hpht)}{aktif.catatan ? ` · ${aktif.catatan}` : ''}</p>
          <div className="baris">
            <button className="btn kecil" onClick={() => setForm({ id: aktif.id, hpht: aktif.hpht, catatan: aktif.catatan })}>Ubah</button>
            <button className="btn kecil utama" onClick={() => setLahir({ id: aktif.id!, tanggal: ref, tempat: '', diFaskes: true })}>Catat persalinan</button>
          </div>
          <p className="petunjuk">Hasil timbang dan tensi tiap bulan tampil di Riwayat pemeriksaan di bawah.</p>
        </div>
      ) : daftar.length === 0 ? (
        <p className="redup" style={{ marginBottom: 0 }}>Belum ada data kehamilan.</p>
      ) : null}
      {riwayat.map((k) => (
        <div key={k.id} className="banner info kecil" style={{ marginTop: 10, marginBottom: 0 }}>
          Persalinan {tglId(k.tanggalLahir)} · {k.tempat || 'tempat tidak dicatat'} ·{' '}
          {k.diFaskes ? 'di fasilitas kesehatan' : 'bukan di fasilitas kesehatan'}
        </div>
      ))}

      {form && (
        <Sheet judul={form.id ? 'Ubah kehamilan' : 'Kehamilan baru'} onTutup={() => setForm(null)}>
          <Field label="HPHT (hari pertama haid terakhir)" petunjuk="Perkiraan lahir dihitung otomatis.">
            <input className="input" type="date" value={form.hpht} max={ref} onChange={(e) => setForm({ ...form, hpht: e.target.value })} />
          </Field>
          <Field label="Catatan (opsional)">
            <input className="input" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
          </Field>
          <div className="aksi-bawah"><button className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn utama" onClick={simpanHamil} disabled={!form.hpht}>Simpan</button></div>
        </Sheet>
      )}
      {lahir && (
        <Sheet judul="Catat persalinan" onTutup={() => setLahir(null)}>
          <Field label="Tanggal persalinan"><input className="input" type="date" value={lahir.tanggal} max={ref} onChange={(e) => setLahir({ ...lahir, tanggal: e.target.value })} /></Field>
          <Field label="Tempat persalinan"><input className="input" value={lahir.tempat} onChange={(e) => setLahir({ ...lahir, tempat: e.target.value })} placeholder="mis. Puskesmas, klinik bidan, rumah" /></Field>
          <label className="baris" style={{ margin: '4px 0 14px' }}>
            <input type="checkbox" checked={lahir.diFaskes} onChange={(e) => setLahir({ ...lahir, diFaskes: e.target.checked })} style={{ width: 22, height: 22 }} />
            Dilakukan di fasilitas kesehatan
          </label>
          <div className="aksi-bawah"><button className="btn" onClick={() => setLahir(null)}>Batal</button><button className="btn utama" onClick={simpanLahir}>Simpan</button></div>
        </Sheet>
      )}
    </div>
  )
}
