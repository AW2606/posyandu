// Kartu per orang sesuai Buku KIA / formulir Posyandu ILP:
// pemeriksaan ibu hamil per umur kehamilan, dan pemeriksaan ibu nifas/menyusui per waktu setelah persalinan.
import { perkiraanLahir, selisihHari, tambahHari, tglId, umurBulan, umurTahun } from '../lib/age'
import { db, type Kehamilan, type Kunjungan, type LayananKunjungan, type Pemeriksaan, type Warga } from '../lib/db'
import { angkaId, hitungIMT, lilaKEK, statusGizi, tekananDarahBerisiko, type Ambang } from '../lib/health'
import { GEJALA_TBC } from '../lib/kelompok'
import type { Baris, DefinisiLaporan, HasilLaporan, Kolom, KonteksLaporan } from './types'

export const KOLOM_HAMIL = ['<4 minggu', '4-8 minggu', '8-12 minggu', '12-16 minggu', '16-20 minggu', '20-24 minggu', '24-28 minggu', '28-32 minggu', '32-36 minggu', '36-40 minggu']
export const KOLOM_NIFAS = ['<7 hari', '7-28 hari', '28-42 hari', ...Array.from({ length: 23 }, (_, i) => `Bulan ${i + 2}`)]

/** Indeks kolom kartu hamil dari jumlah hari sejak HPHT. 40 minggu ke atas masuk kolom terakhir. */
export function slotHamil(hari: number): number | undefined {
  if (hari < 0) return undefined
  const minggu = Math.floor(hari / 7)
  return minggu < 4 ? 0 : Math.min(KOLOM_HAMIL.length - 1, Math.floor(minggu / 4))
}

/** Indeks kolom kartu nifas dari tanggal persalinan dan tanggal kunjungan. Lewat bulan ke-24: undefined. */
export function slotNifas(persalinan: string, tanggal: string): number | undefined {
  const hari = selisihHari(persalinan, tanggal)
  if (hari < 0) return undefined
  if (hari < 7) return 0
  if (hari < 28) return 1
  if (hari < 42) return 2
  const bulan = Math.max(2, umurBulan(persalinan, tanggal) + 1)
  return bulan > 24 ? undefined : 3 + (bulan - 2)
}

interface Slot {
  tanggal: string
  kunj: Kunjungan
  periksa?: Pemeriksaan
}

/** Kunjungan hadir milik warga beserta tanggal kegiatan dan hasil ukurnya, urut tanggal. */
async function kunjunganWarga(wargaId: number): Promise<Slot[]> {
  const kegiatan = new Map((await db.kegiatan.toArray()).map((g) => [g.id!, g.tanggal]))
  const periksa = new Map((await db.pemeriksaan.where('wargaId').equals(wargaId).toArray()).map((x) => [x.kunjunganId, x]))
  return (await db.kunjungan.where('wargaId').equals(wargaId).filter((x) => x.hadir).toArray())
    .filter((k) => kegiatan.has(k.kegiatanId))
    .map((k) => ({ tanggal: kegiatan.get(k.kegiatanId)!, kunj: k, periksa: periksa.get(k.id!) }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

/** Bagi kunjungan ke kolom; bila satu kolom berisi lebih dari satu kunjungan, yang terakhir dipakai. */
function bagiKolom(slots: Slot[], jumlah: number, indeks: (s: Slot) => number | undefined): Array<Slot | undefined> {
  const out: Array<Slot | undefined> = Array.from({ length: jumlah }, () => undefined)
  for (const s of slots) {
    const i = indeks(s)
    if (i !== undefined) out[i] = s
  }
  return out
}

const yt = (v: unknown) => (v === 'Y' ? 'Y' : v === 'T' ? 'T' : '')
const lay = (s?: Slot): LayananKunjungan => s?.kunj.layanan ?? {}

type Isi = (s: Slot | undefined) => string
const barisKartu = (kolom: Array<Slot | undefined>) => (label: string, f: Isi): Baris => [label, ...kolom.map((s) => (s ? f(s) : ''))]

function tbSebelum(semua: Slot[], tanggal: string): number | undefined {
  return [...semua].reverse().find((s) => s.tanggal <= tanggal && s.periksa?.tb !== undefined)?.periksa?.tb
}

function barisUkur(kolom: Array<Slot | undefined>, semua: Slot[], a: Ambang, hamil: boolean): Baris[] {
  const r = barisKartu(kolom)
  const ukur = (f: (x: Pemeriksaan, s: Slot) => string): Isi => (s) => (s?.periksa ? f(s.periksa, s) : '')
  const imt = (x: Pemeriksaan, s: Slot) => {
    const v = hitungIMT(x.bb, x.tb ?? tbSebelum(semua, s.tanggal))
    return v === undefined ? '' : `${angkaId(v)} ${statusGizi(v, a) === 'Normal' ? 'N' : 'R'}`
  }
  const td = (x: Pemeriksaan) => (x.sistol === undefined || x.diastol === undefined ? '' : tekananDarahBerisiko(x.sistol, x.diastol, a) ? 'R' : 'N')
  return [
    { grup: 'Skrining Penimbangan dan Pengukuran' },
    r('BB (kg)', ukur((x) => angkaId(x.bb))),
    ...(hamil ? [r('LILA (cm)', ukur((x) => angkaId(x.lila)))] : []),
    r('Tekanan darah (mmHg)', ukur((x) => (x.sistol === undefined || x.diastol === undefined ? '' : `${x.sistol}/${x.diastol}`))),
    r(`Ploting IMT sesuai kurva Buku KIA (Normal ${angkaId(a.imtKurus)}-${angkaId(a.imtGemuk - 0.1)} kg/m² / Risiko < ${angkaId(a.imtKurus)}; ≥ ${angkaId(a.imtGemuk, 0)} kg/m²)`, ukur(imt)),
    ...(hamil
      ? [r(`Ploting LILA (Normal ≥ ${angkaId(a.lilaKek)} cm / KEK < ${angkaId(a.lilaKek)} cm)`, ukur((x) => (x.lila === undefined ? '' : lilaKEK(x.lila, a) ? 'KEK' : 'N')))]
      : []),
    r(`Ploting tekanan darah sesuai kurva Buku KIA (Normal < ${a.tdSistol}/${a.tdDiastol} / Risiko ≥ ${a.tdSistol}/${a.tdDiastol})`, ukur(td)),
    { grup: 'Skrining Gejala TBC (Normal jika semua Tidak / Risiko jika salah satu Ya). Y = Ya, T = Tidak' },
    ...GEJALA_TBC.map(([k, n]) => r(n, (s) => yt(lay(s)[k]))),
  ]
}

function metaIbu(w: Warga, k: KonteksLaporan, ref: string): Array<[string, string]> {
  return [
    ['Nama', w.nama],
    ['NIK', w.nik || '-'],
    ['Tanggal lahir / umur', `${tglId(w.tanggalLahir)} / ${umurTahun(w.tanggalLahir, ref)} tahun`],
    ['Alamat', [w.alamat, `${w.dusun || k.pengaturan.dusun} RT ${w.rt}`].filter(Boolean).join(', ')],
  ]
}

function metaWilayah(k: KonteksLaporan): Array<[string, string]> {
  const s = k.pengaturan
  return [
    ['Posyandu', s.namaPosyandu.replace(/^POSYANDU\s+/i, '')],
    ['Desa/Kelurahan/Nagari', s.desa],
    ['Kecamatan', s.kecamatan],
  ]
}

const CATATAN_UMUM = [
  'N = Normal, R = Risiko, KEK = Kurang Energi Kronis, Y = Ya, T = Tidak. Satu kolom berisi kunjungan terakhir pada rentang waktu itu.',
  'Penyuluhan: tema edukasi yang diberikan. Rujukan: rujuk puskesmas atau pustu bila ada indikasi risiko hasil pemeriksaan dan skrining.',
]

function kolomKartu(judul: string[], kelompok: string): Kolom[] {
  return [{ judul: 'Pemeriksaan', lebar: '24%' }, ...judul.map((j) => ({ judul: j, kelompok, rata: 'tengah' as const }))]
}

// ---------------------------------------------------------------- ibu hamil

export const kartuIbuHamil: DefinisiLaporan = {
  kode: 'kartu-ibu-hamil',
  nama: 'Kartu Pemeriksaan Ibu Hamil',
  deskripsi: 'Kartu per ibu: BB, LILA, tensi, ploting, skrining TBC, TTD, MT bumil KEK, penyuluhan, kelas ibu hamil, dan rujukan per umur kehamilan. Satu lembar per kehamilan.',
  param: ['warga'],
  async bangun(p, k) {
    if (!p.wargaId) return []
    const w = await db.warga.get(p.wargaId)
    if (!w) return []
    const a = k.pengaturan.ambang
    const semua = await kunjunganWarga(w.id!)
    const hamil = (await db.kehamilan.where('wargaId').equals(w.id!).toArray()).sort((x, y) => y.hpht.localeCompare(x.hpht))
    return hamil.map((h): HasilLaporan => {
      const akhir = h.tanggalLahir ?? tambahHari(h.hpht, 300)
      const dalam = semua.filter((s) => s.tanggal >= h.hpht && s.tanggal < akhir)
      const kolom = bagiKolom(dalam, KOLOM_HAMIL.length, (s) => slotHamil(selisihHari(h.hpht, s.tanggal)))
      const r = barisKartu(kolom)
      const awal = dalam.find((s) => s.periksa)?.periksa
      const baris: Baris[] = [
        ...barisUkur(kolom, semua, a, true),
        { grup: 'Pelayanan Kesehatan (Jawab Y untuk Ya, T untuk Tidak)' },
        r('Jumlah TTD/MMS yang diberikan nakes', (s) => (lay(s).ttdJumlah === undefined ? '' : String(lay(s).ttdJumlah))),
        r('Konsumsi TTD/MMS rutin (1 butir setiap hari selama kehamilan)', (s) => yt(lay(s).ttdRutin)),
        r('Jika nakes memberikan MT Bumil KEK, tuliskan komposisi dan jumlah porsi', (s) => lay(s).pmtKomposisi || yt(lay(s).pmtKek)),
        r('Rutin konsumsi MT Bumil KEK', (s) => yt(lay(s).pmtRutin)),
        { grup: 'Penyuluhan*' },
        r('Topik penyuluhan', (s) => s?.kunj.penyuluhan ?? ''),
        r('Mengikuti kelas ibu hamil', (s) => yt(lay(s).kelasIbu)),
        { grup: 'Rujukan*' },
        r('Rujukan', (s) => s?.kunj.rujukan ?? ''),
      ]
      return {
        kop: ['PEMERIKSAAN IBU HAMIL'],
        gayaKop: 'tengah',
        metaKiri: [
          ...metaIbu(w, k, h.hpht),
          ['Nama suami', h.namaSuami || '-'],
          ['No. HP', h.noHp || '-'],
        ],
        metaKanan: [
          ...metaWilayah(k),
          ['HPHT / perkiraan lahir', `${tglId(h.hpht)} / ${tglId(perkiraanLahir(h.hpht))}`],
          ['Jarak anak sebelumnya', h.jarakAnak || '-'],
          ['Pemeriksaan awal', awal ? ringkasAwal(awal, tbSebelum(semua, h.tanggalLahir ?? akhir)) : '-'],
        ],
        orientasi: 'landscape',
        bagian: [{ kolom: kolomKartu(KOLOM_HAMIL, 'Pemeriksaan sesuai umur kehamilan'), baris, rapat: true }],
        catatan: [...CATATAN_UMUM, ...(h.tanggalLahir ? [`Persalinan ${tglId(h.tanggalLahir)}${h.tempat ? ` di ${h.tempat}` : ''}.`] : [])],
      }
    })
  },
}

function ringkasAwal(x: Pemeriksaan, tb?: number): string {
  return [
    x.bb !== undefined && `BB ${angkaId(x.bb)}`,
    (x.tb ?? tb) !== undefined && `TB ${angkaId(x.tb ?? tb)}`,
    x.lila !== undefined && `LILA ${angkaId(x.lila)}`,
    x.lingkarPerut !== undefined && `LP ${angkaId(x.lingkarPerut, 0)}`,
    x.sistol !== undefined && x.diastol !== undefined && `Tensi ${x.sistol}/${x.diastol}`,
  ].filter(Boolean).join(' · ') || '-'
}

// ---------------------------------------------------------------- ibu nifas / menyusui

/** Tanggal acuan masa nifas: tanggal persalinan yang dicatat; bila tidak ada, awal penanda menyusui. */
export async function daftarPersalinan(wargaId: number): Promise<Array<{ tanggal: string; h?: Kehamilan }>> {
  const hamil = (await db.kehamilan.where('wargaId').equals(wargaId).toArray()).filter((h) => h.tanggalLahir)
  if (hamil.length) return hamil.sort((x, y) => y.tanggalLahir!.localeCompare(x.tanggalLahir!)).map((h) => ({ tanggal: h.tanggalLahir!, h }))
  const st = (await db.statusKhusus.where('wargaId').equals(wargaId).filter((s) => s.jenis === 'menyusui').toArray()).sort((x, y) => y.mulai.localeCompare(x.mulai))
  return st.map((s) => ({ tanggal: s.mulai }))
}

export const kartuNifas: DefinisiLaporan = {
  kode: 'kartu-nifas',
  nama: 'Kartu Pemeriksaan Ibu Nifas / Menyusui',
  deskripsi: 'Kartu per ibu setelah persalinan: <7 hari, 7-28 hari, 28-42 hari, lalu bulan 2 sampai 24. BB, tensi, ploting, skrining TBC, vitamin A, menyusui, KB, penyuluhan, rujukan.',
  param: ['warga'],
  async bangun(p, k) {
    if (!p.wargaId) return []
    const w = await db.warga.get(p.wargaId)
    if (!w) return []
    const a = k.pengaturan.ambang
    const semua = await kunjunganWarga(w.id!)
    return (await daftarPersalinan(w.id!)).map(({ tanggal, h }): HasilLaporan => {
      const kolom = bagiKolom(semua, KOLOM_NIFAS.length, (s) => slotNifas(tanggal, s.tanggal))
      const bagian = [kolom.slice(0, 13), kolom.slice(13)].map((isi, i) => {
        const r = barisKartu(isi)
        const baris: Baris[] = [
          ...barisUkur(isi, semua, a, false),
          { grup: 'Pelayanan Kesehatan (Jawab Y untuk Ya, T untuk Tidak)' },
          r('Jika nakes memberikan vitamin A, tuliskan jumlah kapsul', (s) => (lay(s).vitAKapsul !== undefined ? String(lay(s).vitAKapsul) : yt(lay(s).vitANifas))),
          r('Rutin konsumsi vitamin A', (s) => yt(lay(s).vitARutin)),
          r('Menyusui', (s) => yt(lay(s).menyusuiAsi)),
          r('KB pasca persalinan', (s) => yt(lay(s).kbPasca)),
          { grup: 'Penyuluhan*' },
          r('Topik penyuluhan', (s) => s?.kunj.penyuluhan ?? ''),
          { grup: 'Rujukan*' },
          r('Rujukan', (s) => s?.kunj.rujukan ?? ''),
        ]
        return { kolom: kolomKartu(KOLOM_NIFAS.slice(i * 13, i * 13 + 13), 'Waktu ke Posyandu'), baris, rapat: true as const }
      })
      return {
        kop: ['PEMERIKSAAN IBU NIFAS / MENYUSUI'],
        gayaKop: 'tengah',
        metaKiri: metaIbu(w, k, tanggal),
        metaKanan: [
          ...metaWilayah(k),
          [h ? 'Tanggal persalinan' : 'Mulai menyusui', tglId(tanggal)],
          ...(h?.tempat ? [['Tempat persalinan', h.tempat] as [string, string]] : []),
        ],
        orientasi: 'landscape',
        bagian,
        catatan: [...CATATAN_UMUM, ...(h ? [] : ['Tanggal persalinan belum dicatat; kolom dihitung dari awal penanda menyusui.'])],
      }
    })
  },
}
