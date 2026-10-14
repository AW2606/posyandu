import { kategoriDari, parseISO, tglId, umurTahun } from '../lib/age'
import { db, type Pemeriksaan, type Warga } from '../lib/db'
import {
  angkaId,
  hitungIMT,
  ketAsamUrat,
  ketGula,
  ketKolesterol,
  lingkarPerutBerisiko,
  statusGizi,
  tekananDarahBerisiko,
} from '../lib/health'
import type { Baris, DefinisiLaporan, HasilLaporan, KonteksLaporan, ParamLaporan } from './types'

// Satu template manual = satu definisi di sini. Judul kolom ditulis persis seperti template.

const CEK = '✓'

function teksRT(rt: string): string {
  return rt === 'semua' ? 'SEMUA RT' : `RT ${rt}`
}

function kopSasaran(k: KonteksLaporan, p: ParamLaporan, judul: string): string[] {
  const s = k.pengaturan
  return [s.namaPosyandu, judul, `${teksRT(p.rt)} ${s.dusun} ${s.desa}`, s.kecamatan]
}

function urutRTNama(a: Warga, b: Warga): number {
  return a.rt.localeCompare(b.rt, undefined, { numeric: true }) || a.nama.localeCompare(b.nama, 'id')
}

async function wargaAktif(p: ParamLaporan): Promise<Warga[]> {
  const semua = await db.warga.filter((w) => w.aktif).toArray()
  return semua.filter((w) => p.rt === 'semua' || w.rt === p.rt)
}

async function sasaranKategori(kode: string[], p: ParamLaporan, k: KonteksLaporan): Promise<Warga[]> {
  const list = await wargaAktif(p)
  return list
    .filter((w) => {
      const kat = kategoriDari(w.tanggalLahir, p.tanggal, k.kategori)
      return kat && kode.includes(kat.kode)
    })
    .sort(urutRTNama)
}

function barisSasaran(list: Warga[]): Baris[] {
  return list.map((w, i) => [i + 1, w.nama, w.nik || '-', tglId(w.tanggalLahir), w.jk === 'L' ? CEK : '', w.jk === 'P' ? CEK : ''])
}

const KOLOM_SASARAN = [
  { judul: 'NO', lebar: '8%', rata: 'tengah' as const },
  { judul: 'NAMA', lebar: '27%' },
  { judul: 'NIK', lebar: '23%' },
  { judul: 'TANGGAL LAHIR', lebar: '16%', rata: 'tengah' as const },
  { judul: 'LAKI-LAKI', lebar: '12%', rata: 'tengah' as const },
  { judul: 'PEREMPUAN', lebar: '14%', rata: 'tengah' as const },
]

function sasaran(kode: string, nama: string, deskripsi: string, kategori: string[], judul: (k: KonteksLaporan) => string): DefinisiLaporan {
  return {
    kode,
    nama,
    deskripsi,
    param: ['rt', 'tanggal'],
    async bangun(p, k) {
      const list = await sasaranKategori(kategori, p, k)
      return [
        {
          kop: kopSasaran(k, p, judul(k)),
          orientasi: 'portrait',
          bagian: [{ kolom: KOLOM_SASARAN, baris: barisSasaran(list), minBaris: 20 }],
        },
      ]
    },
  }
}

const sasaranBalita = sasaran(
  'sasaran-balita',
  'Sasaran Balita',
  'Daftar balita per RT (NO, NAMA, NIK, TANGGAL LAHIR, LAKI-LAKI, PEREMPUAN).',
  ['balita'],
  (k) => {
    const c = k.kategori.find((x) => x.kode === 'balita')
    const akhir = c?.umurMax ? c.umurMax - 1 : 5
    return `SASARAN USIA BALITA ( ${c?.umurMin ?? 0} – ${akhir} tahun )`
  },
)

const sasaranSekolah = sasaran(
  'sasaran-sekolah-remaja',
  'Sasaran Usia Sekolah / Remaja',
  'Daftar anak usia sekolah dan remaja per RT.',
  ['sekolah', 'remaja'],
  () => 'SASARAN USIA SEKOLAH / REMAJA',
)

const sasaranLansia = sasaran(
  'sasaran-lansia',
  'Sasaran Lansia',
  'Daftar lansia per RT.',
  ['lansia'],
  (k) => `SASARAN USIA LANSIA ( >${k.kategori.find((x) => x.kode === 'lansia')?.umurMin ?? 60} tahun )`,
)

const sasaranIbu: DefinisiLaporan = {
  kode: 'sasaran-ibu',
  nama: 'Sasaran Ibu Hamil / Menyusui',
  deskripsi: 'Daftar ibu hamil dan/atau ibu menyusui yang aktif pada tanggal acuan.',
  param: ['rt', 'tanggal', 'jenisIbu'],
  async bangun(p, k) {
    const aktif = await db.statusKhusus
      .filter((s) => s.mulai <= p.tanggal && (!s.selesai || s.selesai >= p.tanggal))
      .toArray()
    const warga = await wargaAktif(p)
    const ambil = (jenis: 'hamil' | 'menyusui') => {
      const ids = new Set(aktif.filter((s) => s.jenis === jenis).map((s) => s.wargaId))
      return warga.filter((w) => w.id !== undefined && ids.has(w.id)).sort(urutRTNama)
    }
    const kolom = [
      { judul: 'NO', lebar: '8%', rata: 'tengah' as const },
      { judul: 'NAMA', lebar: '40%' },
      { judul: 'NIK', lebar: '32%' },
      { judul: 'TANGGAL LAHIR', lebar: '20%', rata: 'tengah' as const },
    ]
    const baris = (l: Warga[]): Baris[] => l.map((w, i) => [i + 1, w.nama, w.nik || '-', tglId(w.tanggalLahir)])
    if (p.jenisIbu === 'keduanya') {
      return [
        {
          kop: [k.pengaturan.namaPosyandu, `DATA IBU HAMIL DAN IBU MENYUSUI`, `${teksRT(p.rt)} ${k.pengaturan.dusun} ${k.pengaturan.desa}`, k.pengaturan.kecamatan],
          orientasi: 'portrait',
          bagian: [
            { judul: 'Bumil (Ibu Hamil)', kolom, baris: baris(ambil('hamil')), minBaris: 8 },
            { judul: 'Busui (Ibu Menyusui)', kolom, baris: baris(ambil('menyusui')), minBaris: 8 },
          ],
        },
      ]
    }
    const hamil = p.jenisIbu === 'hamil'
    return [
      {
        kop: kopSasaran(k, p, hamil ? 'SASARAN IBU HAMIL' : 'SASARAN IBU MENYUSUI'),
        orientasi: 'portrait',
        bagian: [{ kolom, baris: baris(ambil(p.jenisIbu)), minBaris: 20 }],
      },
    ]
  },
}

const BULAN_SINGKAT = ['JAN', 'FEB', 'MAR', 'APRL', 'MEI', 'JUNI', 'JULI', 'AGST', 'SEPT', 'OKT', 'NOV', 'DES']

const presensiDewasaLansia: DefinisiLaporan = {
  kode: 'presensi-dewasa-lansia',
  nama: 'Data Sasaran Dewasa Lansia (kunjungan bulanan)',
  deskripsi: 'Kehadiran dewasa dan lansia per bulan satu tahun, dengan penanda T pada tekanan darah berisiko.',
  param: ['rt', 'tanggal', 'tahun'],
  async bangun(p, k) {
    const list = await sasaranKategori(['dewasa', 'lansia'], p, k)
    const kegiatan = (await db.kegiatan.toArray()).filter((g) => parseISO(g.tanggal).y === p.tahun)
    const bulanDari = new Map(kegiatan.map((g) => [g.id!, parseISO(g.tanggal).m]))
    const kunj = await db.kunjungan.filter((x) => x.hadir && bulanDari.has(x.kegiatanId)).toArray()
    const periksa = await db.pemeriksaan.filter((x) => bulanDari.has(x.kegiatanId)).toArray()
    const adaT = new Set(
      periksa.filter((x) => tekananDarahBerisiko(x.sistol, x.diastol, k.pengaturan.ambang)).map((x) => `${x.wargaId}:${x.kegiatanId}`),
    )
    const sel = new Map<string, string>() // "wargaId:bulan"
    for (const x of kunj) {
      const bln = bulanDari.get(x.kegiatanId)!
      sel.set(`${x.wargaId}:${bln}`, adaT.has(`${x.wargaId}:${x.kegiatanId}`) ? `${CEK} T` : CEK)
    }
    const kolom = [
      { judul: 'NO', lebar: '4%', rata: 'tengah' as const },
      { judul: 'NAMA', lebar: '20%' },
      { judul: 'TGL LAHIR/UMUR', lebar: '10%', rata: 'tengah' as const },
      { judul: 'NIK', lebar: '16%' },
      ...BULAN_SINGKAT.map((b) => ({ judul: b, kelompok: 'KUNJUNGAN', rata: 'tengah' as const })),
    ]
    const baris: Baris[] = list.map((w, i) => [
      i + 1,
      w.nama,
      tglId(w.tanggalLahir, '/'),
      w.nik || '-',
      ...BULAN_SINGKAT.map((_, m) => sel.get(`${w.id}:${m + 1}`) ?? ''),
    ])
    const s = k.pengaturan
    return [
      {
        kop: [`DATA SASARAN DEWASA LANSIA PUSKESMAS ${s.puskesmas}`],
        gayaKop: 'tengah',
        metaKiri: [
          ['DESA', s.desa],
          ['POSYANDU', s.namaPosyandu.replace(/^POSYANDU\s+/i, '')],
        ],
        metaKanan: [['TAHUN', String(p.tahun)]],
        orientasi: 'landscape',
        bagian: [{ kolom, baris, minBaris: 20, rapat: true }],
        catatan: [`${CEK} = hadir.  T = tekanan darah berisiko (≥ ${s.ambang.tdSistol}/${s.ambang.tdDiastol} mmHg).  Umur dihitung per ${tglId(p.tanggal)}.`],
      },
    ]
  },
}

function tampilPeriksa(rows: Pemeriksaan[], bulan: number, pilih: (x: Pemeriksaan) => string): string {
  // kegiatan satu bulan = satu kolom; jika ada lebih dari satu ambil yang terakhir
  const x = rows.filter((r) => parseISO(r.tanggal).m === bulan).sort((a, b) => a.tanggal.localeCompare(b.tanggal)).pop()
  return x ? pilih(x) : ''
}

const kartuPemeriksaan: DefinisiLaporan = {
  kode: 'kartu-pemeriksaan',
  nama: 'Kartu Bantu Pemeriksaan Dewasa Lansia',
  deskripsi: 'Kartu per orang: hasil ukur dan skrining tiap bulan dalam satu tahun.',
  param: ['warga', 'tahun', 'tanggal'],
  async bangun(p, k) {
    if (!p.wargaId) return []
    const w = await db.warga.get(p.wargaId)
    if (!w) return []
    const a = k.pengaturan.ambang
    const periksa = (await db.pemeriksaan.where('wargaId').equals(w.id!).toArray()).filter((x) => parseISO(x.tanggal).y === p.tahun)
    const kunj = await db.kunjungan.where('wargaId').equals(w.id!).toArray()
    const kegiatan = new Map((await db.kegiatan.toArray()).map((g) => [g.id!, g]))
    const kunjBulan = (bulan: number, f: (x: (typeof kunj)[number]) => string) => {
      const x = kunj.filter((z) => { const g = kegiatan.get(z.kegiatanId); return g && parseISO(g.tanggal).y === p.tahun && parseISO(g.tanggal).m === bulan }).pop()
      return x ? f(x) : ''
    }
    const bulan12 = Array.from({ length: 12 }, (_, i) => i + 1)
    const kolom = [
      { judul: 'Pemeriksaan', lebar: '28%' },
      ...bulan12.map((b) => ({ judul: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Des'][b - 1], kelompok: 'Waktu ke Posyandu', rata: 'tengah' as const })),
    ]
    const baris12 = (label: string, f: (x: Pemeriksaan) => string): Baris => [label, ...bulan12.map((b) => tampilPeriksa(periksa, b, f))]
    const kosong = (label: string): Baris => [label, ...bulan12.map(() => '')]
    const imtStr = (x: Pemeriksaan) => {
      const v = hitungIMT(x.bb, x.tb)
      const s = statusGizi(v, a)
      return v === undefined ? '' : `${angkaId(v)} ${s === 'Normal' ? 'N' : 'R'}`
    }
    const tdStr = (x: Pemeriksaan) =>
      x.sistol === undefined || x.diastol === undefined ? '' : `${x.sistol}/${x.diastol} ${tekananDarahBerisiko(x.sistol, x.diastol, a) ? 'R' : 'N'}`
    const baris: Baris[] = [
      { grup: 'Skrining Penimbangan dan Pengukuran' },
      baris12('BB (kg)', (x) => angkaId(x.bb)),
      baris12('TB (cm)', (x) => angkaId(x.tb, 0)),
      baris12(`Plotting IMT (IMT = Normal ${angkaId(a.imtKurus)} - ${angkaId(a.imtGemuk - 0.1)} kg/m² / Risiko < ${angkaId(a.imtKurus)} kg/m², ≥ ${angkaId(a.imtGemuk, 0)} kg/m²)`, imtStr),
      baris12('Lingkar perut (cm)', (x) => (x.lingkarPerut === undefined ? '' : `${angkaId(x.lingkarPerut, 0)}${lingkarPerutBerisiko(x.lingkarPerut, w.jk, a) ? '*' : ''}`)),
      baris12('LILA (cm)', (x) => angkaId(x.lila)),
      baris12(`Plotting tekanan darah (Normal <${a.tdSistol}/${a.tdDiastol} / Risiko ≥${a.tdSistol}/${a.tdDiastol})`, tdStr),
      baris12('Kadar gula darah (mg/dl) (Nakes)', (x) => angkaId(x.gulaDarah, 0)),
      { grup: 'Skrining Gejala TBC (Normal jika semua tidak/Risiko jika salah satu ya) Y= Ya, T = Tidak' },
      kosong('Batuk terus menerus'),
      kosong('Demam ≥2 minggu'),
      kosong('BB tetap atau turun dalam 2 bulan berturut-turut'),
      kosong('Kontak erat Pasien TBC'),
      kosong('Menggunakan alat kontrasepsi'),
      { grup: 'Penyuluhan' },
      [ 'Topik penyuluhan', ...bulan12.map((b) => kunjBulan(b, (x) => x.penyuluhan)) ],
      [ 'Rujukan*', ...bulan12.map((b) => kunjBulan(b, (x) => x.rujukan)) ],
    ]
    const s = k.pengaturan
    return [
      {
        kop: ['KARTU BANTU PEMERIKSAAN DEWASA LANSIA (18–59 Tahun)'],
        gayaKop: 'tengah',
        metaKiri: [
          ['Posyandu', s.namaPosyandu.replace(/^POSYANDU\s+/i, '')],
          ['Tahun', String(p.tahun)],
          ['Nama', w.nama],
          ['NIK', w.nik || '-'],
          ['Tanggal Lahir', `${tglId(w.tanggalLahir, '/')} (${umurTahun(w.tanggalLahir, p.tanggal)} Tahun)`],
        ],
        metaKanan: [
          ['Jenis kelamin', w.jk === 'L' ? 'Laki-laki' : 'Perempuan'],
          ['Dusun/RT', `${w.dusun} / RT ${w.rt}`],
          ['Desa/Kelurahan', s.desa],
        ],
        orientasi: 'landscape',
        bagian: [{ kolom, baris, rapat: true }],
        catatan: [
          'N = Normal, R = Risiko, * = lingkar perut berisiko. Baris skrining TBC diisi manual oleh kader.',
          'Penyuluhan: tema edukasi yang diberikan. Rujukan: rujuk puskesmas atau pustu bila ada indikasi resiko hasil pemeriksaan dan skrining.',
        ],
      },
    ]
  },
}

const hasilPemeriksaan: DefinisiLaporan = {
  kode: 'hasil-pemeriksaan',
  nama: 'Hasil Pemeriksaan (kartu gula darah, kolesterol, asam urat)',
  deskripsi: 'Kartu hasil untuk dibawa pulang warga. Pilih satu kegiatan untuk mencetak semua peserta yang punya hasil, atau pilih satu warga.',
  param: ['kegiatan', 'warga'],
  async bangun(p, k) {
    if (!p.kegiatanId) return []
    const g = await db.kegiatan.get(p.kegiatanId)
    if (!g) return []
    const a = k.pengaturan.ambang
    let rows = await db.pemeriksaan.where('kegiatanId').equals(g.id!).toArray()
    rows = rows.filter((x) => x.gulaDarah !== undefined || x.kolesterol !== undefined || x.asamUrat !== undefined)
    if (p.wargaId) rows = rows.filter((x) => x.wargaId === p.wargaId)
    const out: HasilHasil[] = []
    for (const x of rows) {
      const w = await db.warga.get(x.wargaId)
      const kj = await db.kunjungan.get(x.kunjunganId)
      if (w) out.push({ w, x, no: kj?.noAntrean })
    }
    out.sort((m, n) => (m.no ?? 0) - (n.no ?? 0))
    const s = k.pengaturan
    return out.map(({ w, x, no }): HasilLaporan => ({
      kop: [s.namaPosyandu, ...s.alamatKop.split('\n')],
      gayaKop: 'garis',
      judul: 'HASIL PEMERIKSAAN',
      metaKiri: [
        ['Nama', w.nama],
        ['Umur', `${umurTahun(w.tanggalLahir, g.tanggal)} tahun`],
        ['Jenis Kelamin', w.jk === 'L' ? 'Laki-laki' : 'Perempuan'],
        ['Alamat', `${w.alamat || s.dusun}, RT ${w.rt}`],
      ],
      metaKanan: [
        ['No. Periksa', no === undefined ? '' : String(no)],
        ['Tanggal Pemeriksaan', tglId(g.tanggal)],
      ],
      orientasi: 'landscape',
      bagian: [
        {
          kolom: [
            { judul: 'Pemeriksaan', lebar: '25%', rata: 'tengah' },
            { judul: 'Hasil', lebar: '20%', rata: 'tengah' },
            { judul: 'Satuan', lebar: '15%', rata: 'tengah' },
            { judul: 'Keterangan', lebar: '40%', rata: 'tengah' },
          ],
          baris: [
            [{ teks: 'Gula Darah' }, angkaId(x.gulaDarah, 0), 'mg/dl', ketGula(x.gulaDarah, a)],
            [{ teks: 'Kolesterol' }, angkaId(x.kolesterol, 0), 'mg/dl', ketKolesterol(x.kolesterol, a)],
            [{ teks: 'Asam Urat' }, angkaId(x.asamUrat, 1), 'mg/dl', ketAsamUrat(x.asamUrat, w.jk, a)],
          ],
        },
      ],
      catatan: ['Hasil ini bukan diagnosis. Konsultasikan dengan bidan atau Puskesmas bila hasil tinggi.'],
    }))
  },
}

interface HasilHasil {
  w: Warga
  x: Pemeriksaan
  no?: number
}

const pemberianObat: DefinisiLaporan = {
  kode: 'pemberian-obat',
  nama: 'Pemberian Obat Cacing / Vitamin A',
  deskripsi: 'Daftar penerima obat atau vitamin pada satu kegiatan.',
  param: ['kegiatan', 'jenisObat'],
  async bangun(p, k) {
    if (!p.kegiatanId) return []
    const g = await db.kegiatan.get(p.kegiatanId)
    if (!g) return []
    const rows = await db.layananObat.where('kegiatanId').equals(g.id!).filter((x) => x.jenis === p.jenisObat).toArray()
    const warga = new Map((await db.warga.toArray()).map((w) => [w.id!, w]))
    const isi = rows
      .map((r) => ({ r, w: warga.get(r.wargaId) }))
      .filter((z): z is { r: typeof z.r; w: Warga } => !!z.w)
      .sort((m, n) => m.w.nama.localeCompare(n.w.nama, 'id'))
    return [
      {
        kop: [k.pengaturan.namaPosyandu, `PEMBERIAN ${p.jenisObat.toUpperCase()}`, `Tanggal: ${tglId(g.tanggal)}`],
        gayaKop: 'tengah',
        orientasi: 'portrait',
        bagian: [
          {
            kolom: [
              { judul: 'NO', lebar: '8%', rata: 'tengah' },
              { judul: 'NAMA', lebar: '40%' },
              { judul: 'L/P', lebar: '12%', rata: 'tengah' },
              { judul: 'KETERANGAN', lebar: '40%' },
            ],
            baris: isi.map(({ r, w }, i) => [i + 1, w.nama, w.jk === 'L' ? '(L)' : '(P)', r.keterangan]),
            minBaris: 20,
          },
        ],
      },
    ]
  },
}

export const DAFTAR_LAPORAN: DefinisiLaporan[] = [
  sasaranBalita,
  sasaranIbu,
  sasaranSekolah,
  sasaranLansia,
  presensiDewasaLansia,
  kartuPemeriksaan,
  hasilPemeriksaan,
  pemberianObat,
]

export const laporanByKode = (kode: string) => DAFTAR_LAPORAN.find((d) => d.kode === kode)
