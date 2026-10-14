import { useEffect, useMemo, useState } from 'react'
import { formatUmur, tglId } from '../lib/age'
import { db, NAMA_TAHAP, URUTAN_TAHAP, type Tahap, type Kegiatan, type Kunjungan, type Pemeriksaan, type Warga } from '../lib/db'
import {
  angkaId,
  hitungIMT,
  ketAsamUrat,
  ketGula,
  ketKolesterol,
  lingkarPerutBerisiko,
  numOrUndef,
  peringatanRentang,
  statusGizi,
  tekananDarahBerisiko,
} from '../lib/health'
import { usePengaturan } from '../lib/hooks'
import { simpanPemeriksaan } from '../lib/layanan'
import { Chip, Field, Sheet, useToast } from './ui'

interface Props {
  kegiatan: Kegiatan
  kunjungan: Kunjungan
  warga: Warga
  kode: string // kode kategori
  ada?: Pemeriksaan
  onTutup: () => void
  onBerikutnya?: () => void
}

const s = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','))

export default function PeriksaSheet({ kegiatan, kunjungan, warga, kode, ada, onTutup, onBerikutnya }: Props) {
  const p = usePengaturan()
  const toast = useToast()
  const dewasa = ['remaja', 'dewasa', 'lansia'].includes(kode)
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
    }),
    [bb, tb, lila, lp, sis, dia, gula, kol, au],
  )
  const imt = hitungIMT(v.bb, v.tb)
  const gizi = statusGizi(imt, p.ambang)
  const perut = lingkarPerutBerisiko(v.lingkarPerut, warga.jk, p.ambang)
  const td = tekananDarahBerisiko(v.sistol, v.diastol, p.ambang)
  const peringatan = peringatanRentang(v)
  const kosongSemua = Object.values(v).every((x) => x === undefined)

  async function simpan(opsi: { dilayani?: boolean; berikutnya?: boolean }) {
    if (!kosongSemua) await simpanPemeriksaan(kunjungan.id!, { ...v, catatan })
    const minimal: Tahap = kosongSemua ? 'terdaftar' : 'terukur'
    const akhir: Tahap = opsi.dilayani
      ? 'dilayani'
      : URUTAN_TAHAP.indexOf(tahap) >= URUTAN_TAHAP.indexOf(minimal)
        ? tahap
        : minimal
    await db.kunjungan.update(kunjungan.id!, { penyuluhan, rujukan, tahap: akhir })
    toast(`${warga.nama.split(' ')[0]} tersimpan`)
    if (opsi.berikutnya && onBerikutnya) onBerikutnya()
    else onTutup()
  }

  const kolBalita = kode === 'balita'

  return (
    <Sheet judul={`${kunjungan.noAntrean}. ${warga.nama}`} onTutup={onTutup}>
      <p className="redup" style={{ marginTop: -6 }}>
        {warga.jk === 'L' ? 'Laki-laki' : 'Perempuan'} · {formatUmur(warga.tanggalLahir, kegiatan.tanggal)} · RT {warga.rt}
      </p>
      {lalu && (
        <div className="banner info kecil">
          Terakhir ({tglId(lalu.tanggal)}): BB {angkaId(lalu.bb) || '-'} kg · TB {angkaId(lalu.tb, 0) || '-'} cm
          {lalu.lingkarPerut ? ` · L. perut ${angkaId(lalu.lingkarPerut, 0)} cm` : ''}
        </div>
      )}

      <div className="grid2">
        <Field label="Berat badan (kg)">
          <input className="input" inputMode="decimal" value={bb} onChange={(e) => setBb(e.target.value)} autoFocus />
        </Field>
        <Field label={kolBalita ? 'Panjang/tinggi (cm)' : 'Tinggi badan (cm)'}>
          <input className="input" inputMode="decimal" value={tb} onChange={(e) => setTb(e.target.value)} />
        </Field>
        <Field label="LILA (cm)">
          <input className="input" inputMode="decimal" value={lila} onChange={(e) => setLila(e.target.value)} />
        </Field>
        {!kolBalita && (
          <Field label="Lingkar perut (cm)">
            <input className="input" inputMode="decimal" value={lp} onChange={(e) => setLp(e.target.value)} />
          </Field>
        )}
      </div>

      {dewasa && (
        <>
          <div className="grid2">
            <Field label="Tensi atas (sistol)">
              <input className="input" inputMode="numeric" value={sis} onChange={(e) => setSis(e.target.value)} />
            </Field>
            <Field label="Tensi bawah (diastol)">
              <input className="input" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
            </Field>
          </div>
          <button type="button" className="btn kecil" style={{ marginBottom: 12 }} onClick={() => setLanjut(!lanjut)}>
            {lanjut ? 'Sembunyikan' : 'Tambah'} gula darah, kolesterol, asam urat
          </button>
          {lanjut && (
            <div className="grid3">
              <Field label="Gula (mg/dl)">
                <input className="input" inputMode="numeric" value={gula} onChange={(e) => setGula(e.target.value)} />
              </Field>
              <Field label="Kolesterol">
                <input className="input" inputMode="numeric" value={kol} onChange={(e) => setKol(e.target.value)} />
              </Field>
              <Field label="Asam urat">
                <input className="input" inputMode="decimal" value={au} onChange={(e) => setAu(e.target.value)} />
              </Field>
            </div>
          )}
        </>
      )}

      <div className="hasil-hitung" aria-live="polite">
        {imt !== undefined && (
          <Chip warna={gizi === 'Normal' ? 'hijau' : 'merah'}>IMT {angkaId(imt)} · {gizi}</Chip>
        )}
        {perut && <Chip warna="merah">Lingkar perut berisiko</Chip>}
        {td && <Chip warna="merah">Tensi berisiko (T)</Chip>}
        {v.gulaDarah !== undefined && <Chip warna={ketGula(v.gulaDarah, p.ambang) === 'Tinggi' ? 'merah' : 'hijau'}>Gula {ketGula(v.gulaDarah, p.ambang)}</Chip>}
        {v.kolesterol !== undefined && <Chip warna={ketKolesterol(v.kolesterol, p.ambang) === 'Tinggi' ? 'merah' : 'hijau'}>Kolesterol {ketKolesterol(v.kolesterol, p.ambang)}</Chip>}
        {v.asamUrat !== undefined && <Chip warna={ketAsamUrat(v.asamUrat, warga.jk, p.ambang) === 'Tinggi' ? 'merah' : 'hijau'}>Asam urat {ketAsamUrat(v.asamUrat, warga.jk, p.ambang)}</Chip>}
      </div>
      {peringatan.map((w) => (
        <div key={w} className="banner peringatan kecil">{w}</div>
      ))}

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
        <div className="tab" style={{ marginBottom: 0 }}>
          {URUTAN_TAHAP.map((t) => (
            <button key={t} type="button" className={tahap === t ? 'aktif' : ''} onClick={() => setTahap(t)} style={{ fontSize: 13 }}>
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
            Simpan & berikutnya
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
