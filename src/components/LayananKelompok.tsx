import { useState, type ReactNode } from 'react'
import type { KodeAKS, LayananKunjungan, YaTidak } from '../lib/db'
import { numOrUndef } from '../lib/health'
import { GEJALA_TBC, PILIHAN_AKS, SKILAS, type ProfilLayanan } from '../lib/kelompok'
import { Ikon } from './ui'

type Kunci = keyof LayananKunjungan

/** Layanan dan skrining yang berbeda per kelompok umur, sesuai kolom formulir rekap Puskesmas. */
export default function LayananKelompok({ profil: pr, nilai, ubah }: { profil: ProfilLayanan; nilai: LayananKunjungan; ubah: (l: LayananKunjungan) => void }) {
  const terisi = Object.values(nilai).filter((v) => v !== undefined).length
  const [buka, setBuka] = useState(terisi > 0)
  const set = <K extends Kunci>(k: K, v: LayananKunjungan[K] | undefined) => ubah({ ...nilai, [k]: v })

  const yt = (k: Kunci, label: ReactNode) => {
    const v = nilai[k] as YaTidak | undefined
    const klik = (x: YaTidak) => set(k, v === x ? undefined : x) // klik lagi untuk mengosongkan
    return (
      <div className="baris-yt" key={k}>
        <span>{label}</span>
        <div className="yt" role="group" aria-label={typeof label === 'string' ? label : k}>
          <button type="button" className={`y ${v === 'Y' ? 'aktif' : ''}`} aria-pressed={v === 'Y'} onClick={() => klik('Y')}>Ya</button>
          <button type="button" className={`t ${v === 'T' ? 'aktif' : ''}`} aria-pressed={v === 'T'} onClick={() => klik('T')}>Tidak</button>
        </div>
      </div>
    )
  }
  const teks = (k: 'pmtKomposisi', label: string) => (
    <div className="baris-yt teks" key={k}>
      <span>{label}</span>
      <input className="input" value={nilai[k] ?? ''} onChange={(e) => set(k, e.target.value || undefined)} placeholder="mis. biskuit 2 bungkus/hari" />
    </div>
  )
  const angka = (k: 'ttdJumlah' | 'pumaSkor' | 'vitAKapsul', label: string, satuan: string) => (
    <div className="baris-yt" key={k}>
      <span>{label}</span>
      <div className="satuan">
        <input
          className="input"
          inputMode="numeric"
          value={nilai[k] ?? ''}
          onChange={(e) => {
            const n = numOrUndef(e.target.value.replace(/\D/g, ''))
            set(k, n === undefined ? undefined : Math.min(n, 999))
          }}
        />
        <span>{satuan}</span>
      </div>
    </div>
  )

  const bagian: Array<{ judul: string; isi: ReactNode[] }> = []
  if (pr.asi) bagian.push({ judul: 'Bayi 0-6 bulan', isi: [yt('asiEksklusif', 'ASI eksklusif')] })
  if (pr.hamil)
    bagian.push({
      judul: 'Ibu hamil',
      isi: [
        angka('ttdJumlah', 'Jumlah TTD/MMS diberikan', 'butir'),
        yt('ttdRutin', 'Minum TTD rutin setiap hari'),
        yt('pmtKek', 'Diberi PMT bumil KEK'),
        ...(nilai.pmtKek === 'Y' ? [teks('pmtKomposisi', 'Komposisi dan jumlah porsi')] : []),
        yt('pmtRutin', 'Rutin konsumsi PMT bumil KEK'),
        yt('kelasIbu', 'Ikut kelas ibu hamil'),
      ],
    })
  if (pr.menyusui)
    bagian.push({
      judul: 'Ibu nifas / menyusui',
      isi: [
        yt('vitANifas', 'Diberi vitamin A nifas'),
        ...(nilai.vitANifas === 'Y' ? [angka('vitAKapsul', 'Jumlah kapsul vitamin A', 'kapsul')] : []),
        yt('vitARutin', 'Rutin konsumsi vitamin A'),
        yt('menyusuiAsi', 'Menyusui'),
        yt('kbPasca', 'KB pasca persalinan'),
      ],
    })
  if (pr.heeadsss) bagian.push({ judul: 'Usia sekolah / remaja', isi: [yt('heeadsss', 'Skrining HEEADSSS: ada masalah (minimal 1 jawaban Ya)')] })
  if (pr.puma) bagian.push({ judul: 'Skrining PPOK (40 th ke atas)', isi: [angka('pumaSkor', 'Skor PUMA', 'poin')] })
  if (pr.lansia)
    bagian.push({
      judul: 'Lansia',
      isi: [
        <div className="baris-yt" key="aks">
          <span>Tingkat kemandirian (AKS)</span>
          <select className="input" value={nilai.aks ?? ''} onChange={(e) => set('aks', (e.target.value || undefined) as KodeAKS | undefined)}>
            <option value="">Belum diperiksa</option>
            {PILIHAN_AKS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>,
        ...SKILAS.map(([k, n]) => yt(k, `SKILAS ${n.toLowerCase()}: ada masalah`)),
        yt('imunCovid', 'Mendapat imunisasi COVID-19'),
      ],
    })
  bagian.push({ judul: 'Gejala TBC', isi: GEJALA_TBC.map(([k, n]) => yt(k, n)) })

  return (
    <div className="layanan-kelompok">
      <button type="button" className="btn putus penuh kecil" aria-expanded={buka} onClick={() => setBuka(!buka)}>
        <Ikon nama={buka ? 'tutup' : 'tambah'} ukuran={18} /> {buka ? 'Sembunyikan' : 'Isi'} layanan & skrining{terisi ? ` (${terisi} terisi)` : ''}
      </button>
      {buka && (
        <div className="isi">
          {bagian.map((b) => (
            <section key={b.judul}>
              <h4>{b.judul}</h4>
              {b.isi}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
