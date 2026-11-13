// Rekap bulanan satu tahun sesuai formulir Puskesmas (Posyandu ILP / siklus hidup).
// Satu baris = satu bulan yang ada kegiatannya. Umur dan status dihitung per kegiatan terakhir bulan itu.
import { kategoriDari, kegiatanPadaBulan, tglId, umurBulan } from '../lib/age'
import { db, type Kunjungan, type LayananKunjungan, type Pemeriksaan, type Warga } from '../lib/db'
import { nilaiGiziAnak, statusNaikBB } from '../lib/gizi'
import {
  anemia,
  hitungIMT,
  lilaKEK,
  lingkarPerutBerisiko,
  statusGizi,
  statusIMT5,
  tekananDarahBerisiko,
  tingkatGula,
  tingkatTensi,
} from '../lib/health'
import { bergejalaTBC } from '../lib/kelompok'
import type { Baris, DefinisiLaporan, HasilLaporan, Kolom, KonteksLaporan, ParamLaporan } from './types'

/** Batas usia dewasa pada rekap Puskesmas (formulir: ≥19 tahun). Pengaturan kategori aplikasi tidak berubah. */
export const UMUR_DEWASA_REKAP = 19

export interface Orang {
  w: Warga
  umurBln: number
  umurTh: number
  kode: string
  hamil: boolean
  menyusui: boolean
  hadir: boolean
  kunj?: Kunjungan
  periksa?: Pemeriksaan
  /** pemeriksaan sebelumnya (untuk BB naik) */
  lalu?: Pemeriksaan
  /** tinggi badan terakhir yang pernah diukur (ibu sering hanya diukur sekali) */
  tbTerakhir?: number
}

export interface DataBulan {
  bulan: number
  label: string
  orang: Orang[]
}

/** Kumpulkan data semua bulan dalam setahun yang punya kegiatan. */
export async function dataTahun(p: ParamLaporan, k: KonteksLaporan): Promise<DataBulan[]> {
  const semuaKegiatan = await db.kegiatan.toArray()
  const warga = (await db.warga.filter((w) => w.aktif).toArray()).filter((w) => p.rt === 'semua' || w.rt === p.rt)
  const status = await db.statusKhusus.toArray()
  const periksaSemua = await db.pemeriksaan.toArray()
  const periksaWarga = new Map<number, Pemeriksaan[]>()
  for (const x of periksaSemua.sort((a, b) => a.tanggal.localeCompare(b.tanggal))) {
    if (!periksaWarga.has(x.wargaId)) periksaWarga.set(x.wargaId, [])
    periksaWarga.get(x.wargaId)!.push(x)
  }
  const periksaKunj = new Map(periksaSemua.map((x) => [x.kunjunganId, x]))
  const out: DataBulan[] = []
  for (let bulan = 1; bulan <= 12; bulan++) {
    const keg = kegiatanPadaBulan(semuaKegiatan, p.tahun, bulan)
    if (!keg.length) continue
    const acuan = keg[keg.length - 1].tanggal
    const urutKeg = new Map(keg.map((g, i) => [g.id!, i]))
    const kunjBulan = await db.kunjungan.where('kegiatanId').anyOf(keg.map((g) => g.id!)).filter((x) => x.hadir).toArray()
    const kunjWarga = new Map<number, Kunjungan>()
    for (const x of kunjBulan.sort((a, b) => urutKeg.get(a.kegiatanId)! - urutKeg.get(b.kegiatanId)!)) kunjWarga.set(x.wargaId, x)
    const aktifPada = (wid: number, jenis: 'hamil' | 'menyusui') =>
      status.some((s) => s.wargaId === wid && s.jenis === jenis && s.mulai <= acuan && (!s.selesai || s.selesai >= acuan))
    const orang: Orang[] = []
    for (const w of warga) {
      if (w.tanggalLahir > acuan) continue
      const kunj = kunjWarga.get(w.id!)
      const periksa = kunj ? periksaKunj.get(kunj.id!) : undefined
      const riwayat = periksaWarga.get(w.id!) ?? []
      const sebelum = periksa ? riwayat.filter((x) => x.tanggal < periksa.tanggal) : []
      const umurBln = umurBulan(w.tanggalLahir, acuan)
      orang.push({
        w,
        umurBln,
        umurTh: Math.floor(umurBln / 12),
        kode: kategoriDari(w.tanggalLahir, acuan, k.kategori)?.kode ?? '',
        hamil: aktifPada(w.id!, 'hamil'),
        menyusui: aktifPada(w.id!, 'menyusui'),
        hadir: !!kunj,
        kunj,
        periksa,
        lalu: sebelum[sebelum.length - 1],
        tbTerakhir: periksa?.tb ?? [...sebelum].reverse().find((x) => x.tb !== undefined)?.tb,
      })
    }
    out.push({ bulan, label: keg.map((g) => tglId(g.tanggal)).join(', '), orang })
  }
  return out
}

const hitung = <T>(l: T[], f: (x: T) => boolean) => l.filter(f).length
const lay = (o: Orang): LayananKunjungan => o.kunj?.layanan ?? {}
const ya = (o: Orang, k: keyof LayananKunjungan) => lay(o)[k] === 'Y'
const tidak = (o: Orang, k: keyof LayananKunjungan) => lay(o)[k] === 'T'
const edukasi = (o: Orang) => !!o.kunj?.penyuluhan.trim()
const dirujuk = (o: Orang) => !!o.kunj?.rujukan.trim()

// kolom tunggal (tanpa kelompok) biasanya berjudul panjang: batasi lebarnya supaya tidak memakan ruang
const K = (judul: string, kelompok?: string, induk?: string): Kolom => ({ judul, kelompok, induk, rata: 'tengah', ...(kelompok ? {} : { lebar: '4%' }) })
const KOLOM_BULAN: Kolom = { judul: 'Bulan dan Tahun', lebar: '7%' }

function teksRT(rt: string) {
  return rt === 'semua' ? 'Semua RT' : `RT ${rt}`
}

function lembar(k: KonteksLaporan, p: ParamLaporan, judul: string, kolom: Kolom[], baris: Baris[], catatan: string[]): HasilLaporan {
  const s = k.pengaturan
  return {
    kop: [judul, s.namaPosyandu],
    gayaKop: 'tengah',
    metaKiri: [
      ['Dusun/RT/RW', `${s.dusun} / ${teksRT(p.rt)}`],
      ['Desa/Kelurahan/Nagari', s.desa],
      ['Kecamatan', s.kecamatan],
    ],
    metaKanan: [
      ['Puskesmas', s.puskesmas],
      ['Tahun', String(p.tahun)],
    ],
    orientasi: 'landscape',
    bagian: [{ kolom, baris, minBaris: 12, rapat: 'sangat' }],
    catatan,
  }
}

// ---------------------------------------------------------------- balita

const rekapBalita: DefinisiLaporan = {
  kode: 'rekap-balita',
  nama: 'Rekap Bayi Balita (12 bulan)',
  deskripsi: 'Formulir rekapan bayi balita Posyandu ILP: sasaran, kehadiran, BB naik/tidak naik, TB/U, BB/PB, lingkar kepala, ASI eksklusif, skrining TB.',
  param: ['rt', 'tahun'],
  async bangun(p, k) {
    const J = 'JMLH BALITA DGN HASIL PENGUKURAN/PLOTING'
    const kolom: Kolom[] = [
      { judul: 'NO', lebar: '3%', rata: 'tengah' },
      KOLOM_BULAN,
      K('BALITA', 'SASARAN'), K('DATANG', 'SASARAN'), K('TIDAK DATANG', 'SASARAN'),
      K('BB TURUN', J), K('BB TDK NAIK', J), K('BB BGM/ KURANG', J), K('BB NAIK', J),
      K('PENDEK', 'TB/U', J), K('NORMAL', 'TB/U', J), K('TINGGI', 'TB/U', J),
      K('GIZI KURANG', 'BB/PB', J), K('GIZI BAIK', 'BB/PB', J), K('GIZI LEBIH', 'BB/PB', J),
      K('LEBIH', 'LINGKAR KEPALA', J), K('NORMAL', 'LINGKAR KEPALA', J), K('KURANG', 'LINGKAR KEPALA', J),
      K('ASI EKSKLUSIF'),
      K('BATUK ≥2 MG', 'SKRINING GEJALA TB'), K('DEMAM ≥2 MG', 'SKRINING GEJALA TB'), K('BB TDK NAIK 2X', 'SKRINING GEJALA TB'), K('KONTAK ERAT TB', 'SKRINING GEJALA TB'),
    ]
    const baris: Baris[] = (await dataTahun(p, k)).map((d, i) => {
      const sasaran = d.orang.filter((o) => o.kode === 'balita')
      const datang = sasaran.filter((o) => o.hadir)
      const ukur = datang.filter((o) => o.periksa).map((o) => {
        const x = o.periksa!
        return {
          o,
          g: nilaiGiziAnak({ jk: o.w.jk, umurBln: o.umurBln, bb: x.bb, tb: x.tb, lika: x.lika }),
          naik: statusNaikBB({ umurBln: o.umurBln, tanggal: x.tanggal, bb: x.bb, lalu: o.lalu }),
        }
      })
      const gizi = (u: (typeof ukur)[number]) => u.g.bbtb ?? u.g.imtu
      return [
        i + 1, d.label, sasaran.length, datang.length, sasaran.length - datang.length,
        hitung(ukur, (u) => !!u.naik?.turun),
        hitung(ukur, (u) => u.naik?.kode === 'T' && !u.naik.turun),
        hitung(ukur, (u) => !!u.g.bbu && u.g.bbu.z < -2),
        hitung(ukur, (u) => u.naik?.kode === 'N'),
        hitung(ukur, (u) => !!u.g.tbu && u.g.tbu.z < -2),
        hitung(ukur, (u) => !!u.g.tbu && u.g.tbu.z >= -2 && u.g.tbu.z <= 3),
        hitung(ukur, (u) => !!u.g.tbu && u.g.tbu.z > 3),
        hitung(ukur, (u) => { const g = gizi(u); return !!g && g.z < -2 }),
        hitung(ukur, (u) => { const g = gizi(u); return !!g && g.z >= -2 && g.z <= 1 }),
        hitung(ukur, (u) => { const g = gizi(u); return !!g && g.z > 1 }),
        hitung(ukur, (u) => !!u.g.lku && u.g.lku.z > 2),
        hitung(ukur, (u) => !!u.g.lku && u.g.lku.z >= -2 && u.g.lku.z <= 2),
        hitung(ukur, (u) => !!u.g.lku && u.g.lku.z < -2),
        hitung(datang, (o) => ya(o, 'asiEksklusif')),
        hitung(datang, (o) => ya(o, 'tbcBatuk')),
        hitung(datang, (o) => ya(o, 'tbcDemam')),
        hitung(datang, (o) => ya(o, 'tbcBB')),
        hitung(datang, (o) => ya(o, 'tbcKontak')),
      ]
    })
    const s = k.pengaturan
    return [{
      ...lembar(k, p, `REKAPAN BAYI BALITA POSYANDU ILP/SIKLUS HIDUP PUSKESMAS ${s.puskesmas}`, kolom, baris, [
        'BB naik/tidak naik dibanding penimbangan bulan lalu sesuai Kenaikan BB Minimal KMS. BB BGM/kurang: BB/U di bawah -2 SD.',
        'TB/U, BB/PB (BB/TB untuk 24-60 bulan; IMT/U di atas 60 bulan), dan lingkar kepala dihitung dengan standar WHO (Permenkes 2/2020).',
      ]),
      kop: [`REKAPAN BAYI BALITA POSYANDU ILP/SIKLUS HIDUP PUSKESMAS ${s.puskesmas}`],
      metaKiri: [['DESA', s.desa], ['POSYANDU', s.namaPosyandu.replace(/^POSYANDU\s+/i, '')]],
      metaKanan: [['TAHUN', String(p.tahun)], ['RT', teksRT(p.rt)]],
    }]
  },
}

// ---------------------------------------------------------------- usia sekolah & remaja

const rekapSekolah: DefinisiLaporan = {
  kode: 'rekap-sekolah-remaja',
  nama: 'Rekap Anak Usia Sekolah dan Remaja (12 bulan)',
  deskripsi: 'Formulir rekap hasil pemeriksaan anak usia sekolah (6-14 th) dan remaja (15-18 th): sasaran, kehadiran, IMT/U, tensi, gula, anemia, TBC, HEEADSSS, edukasi, rujukan.',
  param: ['rt', 'tahun'],
  async bangun(p, k) {
    const J = 'Jumlah usia sekolah/remaja dengan hasil penimbangan/pengukuran/pemeriksaan'
    const kolom: Kolom[] = [
      KOLOM_BULAN,
      K('6-14 th', 'Sasaran'), K('15-18 th', 'Sasaran'),
      K('6-14 th', 'Datang'), K('15-18 th', 'Datang'),
      K('6-14 th', 'Tidak datang'), K('15-18 th', 'Tidak datang'),
      ...['Sangat kurus', 'Kurus', 'Normal', 'Gemuk', 'Obesitas'].map((x) => K(x, 'IMT/U', J)),
      K('Lingkar perut berisiko (LP)', J),
      ...['Rendah', 'Normal', 'Tinggi'].map((x) => K(x, 'Tekanan darah (≥15 th)', J)),
      ...['Rendah', 'Normal', 'Tinggi'].map((x) => K(x, 'Gula darah (≥15 th)', J)),
      K('Anemia', 'Remaja putri ≥15 th', J), K('Tidak anemia', 'Remaja putri ≥15 th', J),
      K('Bergejala TBC (≥2 gejala)'),
      K('Skrining HEEADSSS (Ya min. 1)'),
      K('Mendapat edukasi'),
      K('Dirujuk'),
    ]
    const a = k.pengaturan.ambang
    const baris: Baris[] = (await dataTahun(p, k)).map((d) => {
      const muda = d.orang.filter((o) => o.umurTh >= 6 && o.umurTh <= 14)
      const tua = d.orang.filter((o) => o.umurTh >= 15 && o.umurTh < UMUR_DEWASA_REKAP)
      const datang = [...muda, ...tua].filter((o) => o.hadir)
      const ukur = datang.filter((o) => o.periksa)
      const imtu = (o: Orang) => nilaiGiziAnak({ jk: o.w.jk, umurBln: o.umurBln, bb: o.periksa!.bb, tb: o.periksa!.tb }).imtu?.status
      const ukur15 = ukur.filter((o) => o.umurTh >= 15)
      const putri = ukur15.filter((o) => o.w.jk === 'P' && o.periksa!.hb !== undefined)
      return [
        d.label,
        muda.length, tua.length,
        hitung(muda, (o) => o.hadir), hitung(tua, (o) => o.hadir),
        hitung(muda, (o) => !o.hadir), hitung(tua, (o) => !o.hadir),
        ...['Gizi buruk', 'Gizi kurang', 'Gizi baik', 'Gizi lebih', 'Obesitas'].map((s) => hitung(ukur, (o) => imtu(o) === s)),
        hitung(ukur, (o) => lingkarPerutBerisiko(o.periksa!.lingkarPerut, o.w.jk, a)),
        ...(['Rendah', 'Normal', 'Tinggi'] as const).map((s) => hitung(ukur15, (o) => tingkatTensi(o.periksa!.sistol, o.periksa!.diastol, a) === s)),
        ...(['Rendah', 'Normal', 'Tinggi'] as const).map((s) => hitung(ukur15, (o) => tingkatGula(o.periksa!.gulaDarah, a) === s)),
        hitung(putri, (o) => anemia(o.periksa!.hb, a.hbAnemiaRemaja)),
        hitung(putri, (o) => !anemia(o.periksa!.hb, a.hbAnemiaRemaja)),
        hitung(datang, (o) => bergejalaTBC(o.kunj?.layanan)),
        hitung(datang, (o) => ya(o, 'heeadsss')),
        hitung(datang, edukasi),
        hitung(datang, dirujuk),
      ]
    })
    return [lembar(k, p, 'REKAP HASIL PEMERIKSAAN ANAK USIA SEKOLAH DAN REMAJA', kolom, baris, [
      'IMT/U dihitung dengan standar WHO (Permenkes 2/2020): sangat kurus = gizi buruk, kurus = gizi kurang, normal = gizi baik, gemuk = gizi lebih.',
      `Usia 15-18 th sampai sebelum ${UMUR_DEWASA_REKAP} th, mengikuti batas formulir Puskesmas. Edukasi = topik penyuluhan terisi. Dirujuk = kolom rujukan terisi.`,
    ])]
  },
}

// ---------------------------------------------------------------- ibu hamil / nifas / menyusui

const rekapIbu: DefinisiLaporan = {
  kode: 'rekap-ibu',
  nama: 'Rekap Ibu Hamil / Nifas / Menyusui (12 bulan)',
  deskripsi: 'Formulir rekapitulasi hasil pemeriksaan ibu hamil/nifas/menyusui: sasaran, kehadiran, BB, LILA, tensi, TBC, TTD, PMT KEK, kelas ibu, vitamin A nifas, KB pasca persalinan.',
  param: ['rt', 'tahun'],
  async bangun(p, k) {
    const S = 'Jumlah sasaran'
    const J = 'Jumlah ibu hamil/nifas/menyusui dengan hasil pemeriksaan'
    const kolom: Kolom[] = [
      KOLOM_BULAN,
      ...['Sasaran', 'Datang', 'Tidak datang'].flatMap((g) => [K('Ibu hamil', g, S), K('Ibu nifas/ menyusui', g, S)]),
      K('Hijau', 'Berat badan', J), K('Merah', 'Berat badan', J),
      K('Hijau', 'LILA', J), K('Merah/ KEK', 'LILA', J),
      K('Hijau', 'Tekanan darah', J), K('Merah', 'Tekanan darah', J),
      K('Bergejala TBC (≥2 gejala)', J),
      K('Bumil dapat TTD', 'TTD'), K('Minum setiap hari', 'TTD'), K('Tidak', 'TTD'),
      K('Bumil dapat PMT KEK', 'PMT bumil KEK'), K('Konsumsi setiap hari', 'PMT bumil KEK'), K('Tidak', 'PMT bumil KEK'),
      K('Ya', 'Bumil ikut kelas ibu hamil'), K('Tidak', 'Bumil ikut kelas ibu hamil'),
      K('Ya', 'Ibu nifas dapat vitamin A'), K('Tidak', 'Ibu nifas dapat vitamin A'),
      K('Ya', 'KB pasca persalinan'), K('Tidak', 'KB pasca persalinan'),
      K('Mendapat edukasi'),
      K('Ibu hamil', 'Dirujuk'), K('Ibu nifas/ menyusui', 'Dirujuk'),
    ]
    const a = k.pengaturan.ambang
    const baris: Baris[] = (await dataTahun(p, k)).map((d) => {
      const hamil = d.orang.filter((o) => o.hamil)
      const busui = d.orang.filter((o) => o.menyusui && !o.hamil)
      const dh = hamil.filter((o) => o.hadir)
      const db_ = busui.filter((o) => o.hadir)
      const datang = [...dh, ...db_]
      const ukur = datang.filter((o) => o.periksa)
      const imt = ukur.filter((o) => o.periksa!.bb !== undefined && o.tbTerakhir !== undefined).map((o) => statusGizi(hitungIMT(o.periksa!.bb, o.tbTerakhir), a))
      const lila = ukur.filter((o) => o.periksa!.lila !== undefined)
      const td = ukur.filter((o) => o.periksa!.sistol !== undefined && o.periksa!.diastol !== undefined)
      return [
        d.label,
        hamil.length, busui.length, dh.length, db_.length, hamil.length - dh.length, busui.length - db_.length,
        hitung(imt, (s) => s === 'Normal'), hitung(imt, (s) => s !== 'Normal'),
        hitung(lila, (o) => !lilaKEK(o.periksa!.lila, a)), hitung(lila, (o) => lilaKEK(o.periksa!.lila, a)),
        hitung(td, (o) => !tekananDarahBerisiko(o.periksa!.sistol, o.periksa!.diastol, a)), hitung(td, (o) => tekananDarahBerisiko(o.periksa!.sistol, o.periksa!.diastol, a)),
        hitung(datang, (o) => bergejalaTBC(o.kunj?.layanan)),
        hitung(dh, (o) => (lay(o).ttdJumlah ?? 0) > 0), hitung(dh, (o) => ya(o, 'ttdRutin')), hitung(dh, (o) => tidak(o, 'ttdRutin')),
        hitung(dh, (o) => ya(o, 'pmtKek')), hitung(dh, (o) => ya(o, 'pmtRutin')), hitung(dh, (o) => tidak(o, 'pmtRutin')),
        hitung(dh, (o) => ya(o, 'kelasIbu')), hitung(dh, (o) => tidak(o, 'kelasIbu')),
        hitung(db_, (o) => ya(o, 'vitANifas')), hitung(db_, (o) => tidak(o, 'vitANifas')),
        hitung(db_, (o) => ya(o, 'kbPasca')), hitung(db_, (o) => tidak(o, 'kbPasca')),
        hitung(datang, edukasi),
        hitung(dh, dirujuk), hitung(db_, dirujuk),
      ]
    })
    return [lembar(k, p, 'REKAPITULASI HASIL PEMERIKSAAN IBU HAMIL/NIFAS/MENYUSUI', kolom, baris, [
      `Berat badan: hijau bila IMT normal (${a.imtKurus}-${a.imtGemuk}), merah bila di luar itu (TB memakai pengukuran terakhir). LILA merah/KEK bila < ${String(a.lilaKek).replace('.', ',')} cm. Tekanan darah merah bila ≥ ${a.tdSistol}/${a.tdDiastol} mmHg.`,
      'Status hamil/menyusui mengikuti penanda di data warga pada kegiatan terakhir bulan itu. Ibu yang ditandai hamil dan menyusui sekaligus dihitung sebagai ibu hamil.',
    ])]
  },
}

// ---------------------------------------------------------------- dewasa & lansia (≥19 th)

const URUT_SKILAS: Array<[keyof LayananKunjungan, string]> = [
  ['skilasKognitif', 'Kognitif'],
  ['skilasGerak', 'Gerak'],
  ['skilasMalnutrisi', 'Malnutrisi'],
  ['skilasPendengaran', 'Pendengaran'],
  ['skilasPenglihatan', 'Penglihatan'],
  ['skilasDepresi', 'Depresi'],
]

const rekapDewasa: DefinisiLaporan = {
  kode: 'rekap-dewasa-lansia',
  nama: 'Rekap Usia Dewasa dan Lansia ≥19 th (12 bulan)',
  deskripsi: 'Formulir rekapitulasi hasil pemeriksaan usia dewasa dan usia lanjut: IMT, lingkar perut, tensi, gula, PUMA, AKS, SKILAS, imunisasi COVID-19, edukasi, rujukan.',
  param: ['rt', 'tahun'],
  async bangun(p, k) {
    const a = k.pengaturan.ambang
    const D = 'Usia dewasa dan lansia'
    const L = 'Lansia'
    const kolom: Kolom[] = [
      KOLOM_BULAN,
      ...['Sangat kurus', 'Kurus', 'Normal', 'Gemuk', 'Obesitas'].map((x) => K(x, 'IMT', D)),
      K(`L > ${a.lingkarPerutL} cm`, 'Lingkar perut', D), K(`P > ${a.lingkarPerutP} cm`, 'Lingkar perut', D),
      ...['Rendah', 'Normal', 'Tinggi'].map((x) => K(x, 'Tekanan darah', D)),
      ...['Rendah', 'Normal', 'Tinggi'].map((x) => K(x, 'Gula darah', D)),
      K(`Normal <${a.pumaTinggi}`, 'PUMA/PPOK (≥40 th)', D), K(`Tinggi ≥${a.pumaTinggi}`, 'PUMA/PPOK (≥40 th)', D),
      // spasi tak-putus supaya "A: M" tidak terpecah dua baris
      K('A:\u00a0M', 'AKS', L), K('B:\u00a0R', 'AKS', L), K('B:\u00a0S', 'AKS', L), K('C:\u00a0B', 'AKS', L), K('C:\u00a0T', 'AKS', L),
      ...URUT_SKILAS.flatMap(([, n]) => [K('Ya', `SKILAS ${n.toLowerCase()}`, L), K('Tidak', `SKILAS ${n.toLowerCase()}`, L)]),
      K('Lansia dapat imunisasi COVID-19'),
      K('Mendapat edukasi'),
      K('Dirujuk'),
    ]
    const baris: Baris[] = (await dataTahun(p, k)).map((d) => {
      const datang = d.orang.filter((o) => o.umurTh >= UMUR_DEWASA_REKAP && o.hadir)
      const ukur = datang.filter((o) => o.periksa)
      const lansia = datang.filter((o) => o.kode === 'lansia')
      const puma = datang.filter((o) => o.umurTh >= 40 && lay(o).pumaSkor !== undefined)
      return [
        d.label,
        ...(['Sangat kurus', 'Kurus', 'Normal', 'Gemuk', 'Obesitas'] as const).map((s) => hitung(ukur, (o) => statusIMT5(hitungIMT(o.periksa!.bb, o.periksa!.tb), a) === s)),
        hitung(ukur, (o) => o.w.jk === 'L' && lingkarPerutBerisiko(o.periksa!.lingkarPerut, 'L', a)),
        hitung(ukur, (o) => o.w.jk === 'P' && lingkarPerutBerisiko(o.periksa!.lingkarPerut, 'P', a)),
        ...(['Rendah', 'Normal', 'Tinggi'] as const).map((s) => hitung(ukur, (o) => tingkatTensi(o.periksa!.sistol, o.periksa!.diastol, a) === s)),
        ...(['Rendah', 'Normal', 'Tinggi'] as const).map((s) => hitung(ukur, (o) => tingkatGula(o.periksa!.gulaDarah, a) === s)),
        hitung(puma, (o) => lay(o).pumaSkor! < a.pumaTinggi), hitung(puma, (o) => lay(o).pumaSkor! >= a.pumaTinggi),
        ...(['M', 'R', 'S', 'B', 'T'] as const).map((x) => hitung(lansia, (o) => lay(o).aks === x)),
        ...URUT_SKILAS.flatMap(([kk]) => [hitung(lansia, (o) => ya(o, kk)), hitung(lansia, (o) => tidak(o, kk))]),
        hitung(lansia, (o) => ya(o, 'imunCovid')),
        hitung(datang, edukasi),
        hitung(datang, dirujuk),
      ]
    })
    return [lembar(k, p, `REKAPITULASI HASIL PEMERIKSAAN USIA DEWASA DAN USIA LANJUT (≥${UMUR_DEWASA_REKAP} Tahun)`, kolom, baris, [
      `Dihitung dari warga ${UMUR_DEWASA_REKAP} tahun ke atas yang hadir. IMT: sangat kurus < ${a.imtSangatKurus}, kurus < ${a.imtKurus}, gemuk ≥ ${a.imtGemuk}, obesitas > ${a.imtObesitas}. Tensi tinggi ≥ ${a.tdSistol}/${a.tdDiastol}, rendah < ${a.tdRendahSistol}/${a.tdRendahDiastol} mmHg. Gula tinggi ≥ ${a.gulaDarahMax}, rendah < ${a.gulaDarahRendah} mg/dl.`,
      'AKS: M = mandiri, R = ringan, S = sedang, B = berat, T = total. SKILAS Ya = ada masalah. Kolom lansia dihitung dari kategori lansia di Pengaturan.',
    ])]
  },
}

// ---------------------------------------------------------------- total sasaran per kelompok

const rekapSasaran: DefinisiLaporan = {
  kode: 'rekap-sasaran',
  nama: 'Rekap Total Sasaran per Kelompok (12 bulan)',
  deskripsi: 'Jumlah sasaran, yang datang, dan yang tidak datang per kelompok umur setiap bulan dalam satu tahun.',
  param: ['rt', 'tahun'],
  async bangun(p, k) {
    const kat = [...k.kategori].sort((a, b) => a.urutan - b.urutan)
    const grup = [
      ...kat.map((c) => ({ nama: c.nama, cocok: (o: Orang) => o.kode === c.kode })),
      { nama: 'Ibu hamil*', cocok: (o: Orang) => o.hamil },
      { nama: 'Ibu menyusui*', cocok: (o: Orang) => o.menyusui && !o.hamil },
    ]
    const kolom: Kolom[] = [
      KOLOM_BULAN,
      ...grup.flatMap((g) => [K('Sasaran', g.nama), K('Datang', g.nama), K('Tidak datang', g.nama)]),
      K('Sasaran', 'Total warga'), K('Datang', 'Total warga'), K('Tidak datang', 'Total warga'),
    ]
    const baris: Baris[] = (await dataTahun(p, k)).map((d) => {
      const sel = (l: Orang[]) => [l.length, hitung(l, (o) => o.hadir), hitung(l, (o) => !o.hadir)]
      return [d.label, ...grup.flatMap((g) => sel(d.orang.filter(g.cocok))), ...sel(d.orang)]
    })
    const h = lembar(k, p, 'REKAP SASARAN DAN KEHADIRAN PER KELOMPOK', kolom, baris, [
      'Kelompok umur mengikuti Pengaturan kategori, dihitung per kegiatan terakhir tiap bulan. *Ibu hamil dan menyusui juga sudah terhitung di kelompok umurnya.',
    ])
    h.bagian[0].rapat = true
    return [h]
  },
}

export const DAFTAR_REKAP: DefinisiLaporan[] = [rekapSasaran, rekapBalita, rekapSekolah, rekapIbu, rekapDewasa]
