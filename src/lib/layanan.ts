import { db, URUTAN_TAHAP, catat, type Pemeriksaan, type Tahap } from './db'

/** Daftarkan warga ke kegiatan. Satu warga hanya sekali per kegiatan. */
export async function daftarkan(kegiatanId: number, wargaId: number): Promise<{ ok: boolean; pesan?: string }> {
  return db.transaction('rw', db.kunjungan, async () => {
    const ada = await db.kunjungan.where('[kegiatanId+wargaId]').equals([kegiatanId, wargaId]).first()
    if (ada) return { ok: false, pesan: `Sudah terdaftar dengan antrean ${ada.noAntrean}.` }
    const semua = await db.kunjungan.where('kegiatanId').equals(kegiatanId).toArray()
    const no = semua.reduce((m, x) => Math.max(m, x.noAntrean), 0) + 1
    await db.kunjungan.add({ kegiatanId, wargaId, noAntrean: no, hadir: true, tahap: 'terdaftar', penyuluhan: '', rujukan: '' })
    return { ok: true }
  })
}

/**
 * Batalkan pendaftaran peserta dari kegiatan (misalnya salah tekan). Hasil pemeriksaan dan
 * pemberian obat/vitamin warga itu pada kegiatan ini ikut terhapus. Nomor antrean peserta lain tidak diubah.
 */
export async function hapusPeserta(kunjunganId: number, namaWarga = ''): Promise<void> {
  const kj = await db.kunjungan.get(kunjunganId)
  if (!kj) return
  await db.transaction('rw', db.kunjungan, db.pemeriksaan, db.layananObat, async () => {
    await db.pemeriksaan.where('kunjunganId').equals(kunjunganId).delete()
    await db.layananObat.where('kegiatanId').equals(kj.kegiatanId).filter((o) => o.wargaId === kj.wargaId).delete()
    await db.kunjungan.delete(kunjunganId)
  })
  await catat('hapus', 'peserta', `${namaWarga || `warga ${kj.wargaId}`} dari kegiatan ${kj.kegiatanId} (antrean ${kj.noAntrean})`)
}

export function tahapLanjut(sekarang: Tahap, minimal: Tahap): Tahap {
  return URUTAN_TAHAP.indexOf(sekarang) >= URUTAN_TAHAP.indexOf(minimal) ? sekarang : minimal
}

export async function simpanPemeriksaan(
  kunjunganId: number,
  data: Omit<Pemeriksaan, 'id' | 'kunjunganId' | 'kegiatanId' | 'wargaId' | 'tanggal'>,
): Promise<void> {
  const kj = await db.kunjungan.get(kunjunganId)
  if (!kj) throw new Error('Kunjungan tidak ditemukan')
  const g = await db.kegiatan.get(kj.kegiatanId)
  if (!g) throw new Error('Kegiatan tidak ditemukan')
  const lama = await db.pemeriksaan.where('kunjunganId').equals(kunjunganId).first()
  const baris: Omit<Pemeriksaan, 'id'> = {
    ...data,
    kunjunganId,
    kegiatanId: kj.kegiatanId,
    wargaId: kj.wargaId,
    tanggal: g.tanggal,
  }
  await db.transaction('rw', db.pemeriksaan, db.kunjungan, async () => {
    if (lama?.id) await db.pemeriksaan.put({ ...baris, id: lama.id })
    else await db.pemeriksaan.add(baris)
    await db.kunjungan.update(kunjunganId, { tahap: tahapLanjut(kj.tahap, 'terukur') })
  })
  await catat(lama ? 'ubah' : 'tambah', 'pemeriksaan', `kunjungan ${kunjunganId}`)
}
