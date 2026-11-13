import { useEffect, useMemo, useState } from 'react'
import { formatUmur, tglId, umurBulan } from '../lib/age'
import { db, NAMA_TAHAP, URUTAN_TAHAP, type LayananKunjungan, type Tahap, type Kegiatan, type Kunjungan, type Pemeriksaan, type Warga } from '../lib/db'
import { angkaId, numOrUndef, validasiPemeriksaan } from '../lib/health'
import { usePengaturan } from '../lib/hooks'
import { hasilOtomatis, profilLayanan } from '../lib/kelompok'
import { simpanPemeriksaan } from '../lib/layanan'
import LayananKelompok from './LayananKelompok'
import { Chip, Field, Ikon, Sheet, useToast } from './ui'

interface Props {
  kegiatan: Kegiatan
  kunjungan: Kunjungan
  warga: Warga
  kode: string // kode kategori
  hamil?: boolean
  menyusui?: boolean
  ada?: Pemeriksaan
  onTutup: () => void
  onBerikutnya?: () => void
}

const s = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','))

/** Buang jawaban kosong supaya kunjungan tanpa layanan tidak menyimpan objek kosong. */
function rapikanLayanan(l: LayananKunjungan): LayananKunjungan | undefined {
  const r = Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined && v !== '')) as LayananKunjungan
  return Object.keys(r).length ? r : undefined
}

export default function PeriksaSheet({ kegiatan, kunjungan, warga, kode, hamil, menyusui, ada, onTutup, onBerikutnya }: Props) {
  const p = usePengaturan()
  const toast = useToast()
  const umurBln = umurBulan(warga.tanggalLahir, kegiatan.tanggal)
  const profil = profilLayanan({ kode, umurBln, jk: warga.jk, hamil, menyusui })
  const dewasa = profil.tensi
  const [lika, setLika] = useState(s(ada?.lika))
  const [hb, setHb] = useState(s(ada?.hb))
  const [layanan, setLayanan] = useState<LayananKunjungan>(kunjungan.layanan ?? {})
  const [bb, setBb] = useState(s(ada?.bb))
  const [tb, setTb] = useState(s(ada?.tb))
  const [lila, setLila] = useState(s(ada?.lila))
  const [lp, setLp] = useState(s(ada?.lingkarPerut))
  const [sis, setSis] = useState(s(ada?.sistol))
  const [dia, setDia] = useState(s(ada?.diastol))
  const [gula, setGula] = useState(s(ada?.gulaDarah))
  const [kol, setKol] = useState(s(ada?.kolesterol))
  const [au, setAu] = useState(s(ada?.asamUrat))
  const [catatan, setCatatan] = useState(ada?.catatan ?? '')
  const [penyuluhan, setPenyuluhan] = useState(kunjungan.penyuluhan)
  const [rujukan, setRujukan] = useState(kunjungan.rujukan)
  const [lanjut, setLanjut] = useState(!!(ada?.gulaDarah || ada?.kolesterol || ada?.asamUrat))
  const [lalu, setLalu] = useState<Pemeriksaan | undefined>()
  const [tahap, setTahap] = useState<Tahap>(kunjungan.tahap)

  useEffect(() => {
    db.pemeriksaan
      .where('wargaId')
      .equals(warga.id!)
      .filter((x) => x.tanggal < kegiatan.tanggal)
      .sortBy('tanggal')
      .then((r) => setLalu(r[r.length - 1]))
  }, [warga.id, kegiatan.tanggal])

  const v = useMemo(
    () => ({
      bb: numOrUndef(bb), tb: numOrUndef(tb), lila: numOrUndef(lila), lingkarPerut: numOrUndef(lp),
      sistol: numOrUndef(sis), diastol: numOrUndef(dia),
      gulaDarah: numOrUndef(gula), kolesterol: numOrUndef(kol), asamUrat: numOrUndef(au),
      lika: numOrUndef(lika), hb: numOrUndef(hb),
    }),
    [bb, tb, lila, lp, sis, dia, gula, kol, au, lika, hb],
  )
  const chips = hasilOtomatis({ profil, v, jk: warga.jk, umurBln, tanggal: kegiatan.tanggal, a: p.ambang, lalu, layanan })
  const galat = useMemo(
    () =>
      validasiPemeriksaan({
        bb, tb, lila, lingkarPerut: lp, sistol: sis, diastol: dia, gulaDarah: gula, kolesterol: kol, asamUrat: au, lika, hb,
      }),
    [bb, tb, lila, lp, sis, dia, gula, kol, au, lika, hb],
  )
  const adaGalat = Object.keys(galat).length > 0
  const kosongSemua = Object.values(v).every((x) => x === undefined)
  const kelas = (k: keyof typeof galat) => `input ${galat[k] ? 'salah' : ''}`

  async function simpan(opsi: { dilayani?: boolean; berikutnya?: boolean }) {
    // Jangan simpan apa pun selama ada isian tidak valid, supaya data lama tidak tertimpa.
    if (adaGalat) {
      if ((galat.gulaDarah || galat.kolesterol || galat.asamUrat) && !lanjut) setLanjut(true)
      toast('Periksa lagi isian yang ditandai merah')
      return
    }
    if (!kosongSemua) await simpanPemeriksaan(kunjungan.id!, { ...v, catatan })
    const minimal: Tahap = kosongSemua ? 'terdaftar' : 'terukur'
    const akhir: Tahap = opsi.dilayani
      ? 'dilayani'
      : URUTAN_TAHAP.indexOf(tahap) >= URUTAN_TAHAP.indexOf(minimal)
        ? tahap
        : minimal
    await db.kunjungan.update(kunjungan.id!, { penyuluhan, rujukan, tahap: akhir, layanan: rapikanLayanan(layanan) })
    toast(`${warga.nama.split(' ')[0]} tersimpan`)
    if (opsi.berikutnya && onBerikutnya) onBerikutnya()
    else onTutup()
  }

  const kolBalita = kode === 'balita'
  const isian = (label: string, k: keyof typeof galat, nilai: string, ubah: (s: string) => void, satuan: string, mode: 'decimal' | 'numeric' = 'decimal', fokus = false) => (
    <Field label={label} galat={galat[k]}>
      <div className="satuan">
        <input className={kelas(k)} inputMode={mode} value={nilai} onChange={(e) => ubah(e.target.value)} autoFocus={fokus} />
        <span>{satuan}</span>
      </div>
    </Field>
  )
  const WARNA_NADA = { baik: 'hijau', waspada: 'kuning', bahaya: 'merah' } as const

  return (
    <Sheet
      judul={`No. ${kunjungan.noAntrean} · ${warga.nama}`}
      sub={`${warga.jk === 'L' ? 'Laki-laki' : 'Perempuan'} · ${formatUmur(warga.tanggalLahir, kegiatan.tanggal)} · RT ${warga.rt}`}
      ikon="timbangan"
      lebar
      onTutup={onTutup}
    >
      {lalu && (
        <div className="banner info kecil">
          <Ikon nama="riwayat" ukuran={20} />
          <span>
            Terakhir ({tglId(lalu.tanggal)}): BB {angkaId(lalu.bb) || '-'} kg · TB {angkaId(lalu.tb, 0) || '-'} cm
            {lalu.lingkarPerut ? ` · L. perut ${angkaId(lalu.lingkarPerut, 0)} cm` : ''}
          </span>
        </div>
      )}

      <div className="grid2">
        {isian('Berat badan', 'bb', bb, setBb, 'kg', 'decimal', true)}
        {isian(kolBalita ? 'Panjang/tinggi badan' : 'Tinggi badan', 'tb', tb, setTb, 'cm')}
        {isian('LILA', 'lila', lila, setLila, 'cm')}
        {!kolBalita && isian('Lingkar perut', 'lingkarPerut', lp, setLp, 'cm')}
        {profil.lika && isian('Lingkar kepala (LIKA)', 'lika', lika, setLika, 'cm')}
        {profil.hb && isian('Hb', 'hb', hb, setHb, 'g/dl')}
      </div>

      {dewasa && (
        <>
          <div className="grid2">
            {isian('Tensi atas (sistol)', 'sistol', sis, setSis, 'mmHg', 'numeric')}
            {isian('Tensi bawah (diastol)', 'diastol', dia, setDia, 'mmHg', 'numeric')}
          </div>
          <button type="button" className="btn putus penuh kecil" style={{ marginBottom: 16 }} onClick={() => setLanjut(!lanjut)}>
            <Ikon nama={lanjut ? 'tutup' : 'tambah'} ukuran={18} /> {lanjut ? 'Sembunyikan' : 'Tambah'} gula darah, kolesterol, asam urat
          </button>
          {lanjut && (
            <div className="grid3">
              {isian('Gula darah', 'gulaDarah', gula, setGula, 'mg/dl', 'numeric')}
              {isian('Kolesterol', 'kolesterol', kol, setKol, 'mg/dl', 'numeric')}
              {isian('Asam urat', 'asamUrat', au, setAu, 'mg/dl')}
            </div>
          )}
        </>
      )}

      <LayananKelompok profil={profil} nilai={layanan} ubah={setLayanan} />

      {chips.length > 0 && (
        <div className="hasil-otomatis" aria-live="polite">
          <p>HASIL OTOMATIS</p>
          <div className="hasil-hitung">
            {chips.map((c) => (
              <Chip key={c.teks} warna={WARNA_NADA[c.nada]}>
                {c.nada === 'baik' ? <Ikon nama="centang" ukuran={14} tebal={2.6} /> : <Ikon nama="peringatan" ukuran={14} />} {c.teks}
              </Chip>
            ))}
          </div>
          {(profil.balita || profil.anak) && <p className="sumber">Status gizi anak dihitung dengan standar WHO (Permenkes 2/2020).</p>}
        </div>
      )}

      <Field label="Topik penyuluhan (opsional)">
        <input className="input" value={penyuluhan} onChange={(e) => setPenyuluhan(e.target.value)} />
      </Field>
      <Field label="Rujukan (opsional)" petunjuk="Isi jika dirujuk ke Puskesmas atau Pustu.">
        <input className="input" value={rujukan} onChange={(e) => setRujukan(e.target.value)} />
      </Field>
      <Field label="Catatan (opsional)">
        <input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>

      <div className="field">
        <span className="lbl">Tahap layanan</span>
        <div className="tab krem" style={{ marginBottom: 0 }}>
          {URUTAN_TAHAP.map((t) => (
            <button key={t} type="button" className={tahap === t ? 'aktif' : ''} onClick={() => setTahap(t)} style={{ fontSize: 14.5 }}>
              {NAMA_TAHAP[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="aksi-bawah">
        <button className="btn" onClick={() => simpan({ dilayani: true })}>
          Simpan & selesai
        </button>
        {onBerikutnya && (
          <button className="btn utama" onClick={() => simpan({ berikutnya: true })}>
            Simpan & berikutnya <Ikon nama="kanan" ukuran={18} />
          </button>
        )}
        {!onBerikutnya && (
          <button className="btn utama" onClick={() => simpan({})}>
            Simpan
          </button>
        )}
      </div>
    </Sheet>
  )
}
