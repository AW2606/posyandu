import { toISO } from './age'
import { db, getPengaturan, type Pemeriksaan, type Pengaturan, type Warga } from './db'

// Data contoh FIKTIF untuk uji coba dan pelatihan. NIK berawalan 18019999 = bukan NIK asli.

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMA_L = ['Budi Santoso', 'Agus Pratama', 'Dedi Kurniawan', 'Eko Prasetyo', 'Fajar Nugroho', 'Hendra Wijaya', 'Imam Hidayat', 'Joko Susilo', 'Rudi Hartono', 'Slamet Riyadi', 'Tono Saputra', 'Wahyu Setiawan', 'Yoga Permana', 'Bagas Ramadhan', 'Dimas Anggara', 'Rizky Maulana', 'Arif Rahman', 'Galih Prakoso', 'Naufal Hakim', 'Reza Firmansyah', 'Satria Mahendra', 'Umar Fadhil']
const NAMA_P = ['Sri Wahyuni', 'Siti Aminah', 'Dewi Lestari', 'Ratna Sari', 'Yuni Astuti', 'Lilis Suryani', 'Nur Hidayah', 'Rina Marlina', 'Tuti Handayani', 'Wati Kurnia', 'Ani Rahayu', 'Bunga Citra', 'Citra Ayu', 'Fitri Ramadani', 'Indah Permata', 'Maya Anggraini', 'Putri Amelia', 'Nadia Safitri', 'Salsa Kirana', 'Zahra Aulia', 'Laras Ayuningtyas', 'Mega Puspita', 'Ayu Wulandari', 'Heni Susanti']

export async function muatDataContoh(): Promise<{ warga: number; kegiatan: number }> {
  const p = await getPengaturan()
  return db.transaction('rw', [db.warga, db.statusKhusus, db.kegiatan, db.kunjungan, db.pemeriksaan, db.layananObat, db.imunisasi, db.kehamilan], () =>
    isiDataContoh(p),
  )
}

async function isiDataContoh(p: Pengaturan): Promise<{ warga: number; kegiatan: number }> {
  const rand = rng(2026)
  const pilih = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]
  const now = Date.now()
  let n = 0
  const warga: Omit<Warga, 'id'>[] = []
  const tambah = (jk: 'L' | 'P', umurMinTh: number, umurMaxTh: number, hitung: number) => {
    for (let i = 0; i < hitung; i++) {
      const pool = jk === 'L' ? NAMA_L : NAMA_P
      const th = umurMinTh + Math.floor(rand() * (umurMaxTh - umurMinTh + 1))
      const lahir = toISO(2026 - th - (rand() < 0.5 ? 1 : 0), 1 + Math.floor(rand() * 12), 1 + Math.floor(rand() * 28))
      n++
      warga.push({
        nama: `${pilih(pool)}${n % 3 === 0 ? ' ' + String.fromCharCode(65 + (n % 26)) + '.' : ''}`,
        nik: `18019999${String(n).padStart(8, '0')}`,
        noKK: `18019999${String(Math.ceil(n / 3) + 5000).padStart(8, '0')}`,
        tanggalLahir: lahir,
        jk,
        rt: pilih(p.rtDaftar),
        dusun: 'Dusun 5',
        alamat: '',
        namaOrtu: th < 15 ? pilih(NAMA_P) : '',
        aktif: true,
        dibuat: now,
        diubah: now,
      })
    }
  }
  tambah('L', 0, 5, 4)
  tambah('P', 0, 5, 4)
  tambah('L', 6, 14, 5)
  tambah('P', 6, 14, 5)
  tambah('L', 15, 17, 2)
  tambah('P', 15, 17, 2)
  tambah('L', 19, 58, 8)
  tambah('P', 19, 40, 14)
  tambah('P', 41, 58, 5)
  tambah('L', 61, 75, 5)
  tambah('P', 61, 75, 5)

  // dua bayi tetap 12-23 bulan agar daftar tindak lanjut imunisasi bisa dicoba
  for (const [nama, jk, lahir] of [['Bayi Contoh Satu', 'L', '2025-03-10'], ['Bayi Contoh Dua', 'P', '2025-06-20']] as const) {
    n++
    warga.push({
      nama, nik: `18019999${String(n).padStart(8, '0')}`, noKK: '', tanggalLahir: lahir, jk, rt: p.rtDaftar[0],
      dusun: 'Dusun 5', alamat: '', namaOrtu: pilih(NAMA_P), aktif: true, dibuat: now, diubah: now,
    })
  }

  const ids = (await db.warga.bulkAdd(warga, { allKeys: true })) as number[]
  const rows = warga.map((w, i) => ({ ...w, id: ids[i] }))

  // Ibu hamil / menyusui dari perempuan 19-40 th
  const subur = rows.filter((w) => w.jk === 'P' && w.tanggalLahir > '1986' && w.tanggalLahir < '2007')
  await db.statusKhusus.bulkAdd(
    subur.slice(0, 5).map((w, i) => ({
      wargaId: w.id,
      jenis: i < 3 ? ('hamil' as const) : ('menyusui' as const),
      mulai: '2026-03-01',
    })),
  )

  // Kehamilan contoh untuk yang berstatus hamil
  const hamilIds = subur.slice(0, 3)
  await db.kehamilan.bulkAdd(hamilIds.map((w, i) => ({ wargaId: w.id, hpht: toISO(2026, 6 + i, 10), catatan: '' })))

  // Imunisasi contoh: sebagian bayi lengkap, sebagian belum
  const bayi = rows.filter((w) => w.tanggalLahir >= '2024-10-15' && w.tanggalLahir <= '2026-01-01')
  for (const [i, w] of bayi.entries()) {
    const jumlah = w.nama.startsWith('Bayi Contoh') ? 3 : i % 2 === 0 ? p.imunisasiDasar.length : Math.floor(p.imunisasiDasar.length / 2)
    await db.imunisasi.bulkAdd(
      p.imunisasiDasar.slice(0, jumlah).map((jenis, j) => ({ wargaId: w.id, jenis, tanggal: toISO(2026, 1 + (j % 9), 15) })),
    )
  }

  // Kegiatan tanggal 15 tiap bulan, Januari - Oktober 2026 (Oktober belum terisi)
  const dewasaPlus = rows.filter((w) => w.tanggalLahir < '2008-01-01')
  const anak = rows.filter((w) => w.tanggalLahir >= '2020-01-01')
  let kegiatanCount = 0
  for (let bulan = 1; bulan <= 10; bulan++) {
    const tanggal = toISO(2026, bulan, p.tanggalKegiatan)
    const kid = await db.kegiatan.add({ tanggal, lokasi: `Posyandu Bangau, ${p.dusun} ${p.desa}`, keterangan: '' })
    kegiatanCount++
    if (bulan === 10) break
    let antre = 0
    const peserta = [...dewasaPlus.filter(() => rand() < 0.55), ...anak.filter(() => rand() < 0.8)]
    for (const w of peserta) {
      antre++
      const kunjId = await db.kunjungan.add({
        kegiatanId: kid, wargaId: w.id, noAntrean: antre, hadir: true,
        tahap: 'dilayani', penyuluhan: '', rujukan: '',
      })
      const bayi = w.tanggalLahir >= '2020-01-01'
      const bb = bayi ? 8 + rand() * 9 : 45 + rand() * 40
      const tb = bayi ? 70 + rand() * 30 : 148 + rand() * 28
      const periksa: Omit<Pemeriksaan, 'id'> = {
        kunjunganId: kunjId, kegiatanId: kid, wargaId: w.id, tanggal,
        bb: Math.round(bb * 10) / 10, tb: Math.round(tb),
        lila: bayi ? Math.round((13 + rand() * 3) * 10) / 10 : Math.round(23 + rand() * 9),
        lingkarPerut: bayi ? undefined : Math.round(68 + rand() * 32),
        catatan: '',
      }
      if (!bayi && w.tanggalLahir < '2008-01-01') {
        periksa.sistol = Math.round(105 + rand() * 50)
        periksa.diastol = Math.round(65 + rand() * 30)
        if (rand() < 0.4) {
          periksa.gulaDarah = Math.round(85 + rand() * 130)
          periksa.kolesterol = Math.round(140 + rand() * 120)
          periksa.asamUrat = Math.round((3 + rand() * 5) * 10) / 10
        }
      }
      await db.pemeriksaan.add(periksa)
    }
    // contoh pemberian obat/vitamin di kegiatan Agustus & April
    if (bulan === 4 || bulan === 8) {
      const jenis = bulan === 4 ? 'Obat Cacing' : 'Vitamin A'
      for (const w of peserta.filter((x) => x.tanggalLahir >= '2020-01-01').slice(0, 8)) {
        await db.layananObat.add({
          kegiatanId: kid, wargaId: w.id, jenis,
          keterangan: jenis === 'Vitamin A' ? pilih(['Merah', 'Biru']) : pilih(['Diterima langsung', 'Dititipkan']),
        })
      }
    }
  }
  return { warga: rows.length, kegiatan: kegiatanCount }
}
