import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { aturArsipWarga, db, hapusWargaPermanen, hitungDataWarga, type Warga } from './db'

const warga = (nama: string): Warga => ({
  nama, nik: '', noKK: '', tanggalLahir: '1990-01-01', jk: 'P', rt: '22', dusun: 'Dusun 5', alamat: '', namaOrtu: '', aktif: false, dibuat: 0, diubah: 0,
})

describe('hapus warga permanen', () => {
  it('menghapus warga beserta semua datanya, tanpa menyentuh warga lain', async () => {
    const a = (await db.warga.add(warga('Ani'))) as number
    const b = (await db.warga.add(warga('Budi'))) as number
    const keg = (await db.kegiatan.add({ tanggal: '2026-10-15', lokasi: '', keterangan: '' })) as number
    for (const id of [a, b]) {
      const k = (await db.kunjungan.add({ kegiatanId: keg, wargaId: id, noAntrean: id === a ? 1 : 2, tahap: 'terukur', penyuluhan: '', rujukan: '' } as never)) as number
      await db.pemeriksaan.add({ kunjunganId: k, kegiatanId: keg, wargaId: id, tanggal: '2026-10-15', bb: 50, catatan: '' } as never)
      await db.imunisasi.add({ wargaId: id, jenis: 'BCG', tanggal: '2026-01-01' })
      await db.kehamilan.add({ wargaId: id, hpht: '2026-05-01', catatan: '' } as never)
    }

    expect(await hitungDataWarga(a)).toEqual({ kunjungan: 1, pemeriksaan: 1, lain: 2 })

    await hapusWargaPermanen(a)

    expect(await db.warga.get(a)).toBeUndefined()
    expect(await hitungDataWarga(a)).toEqual({ kunjungan: 0, pemeriksaan: 0, lain: 0 })
    expect(await db.warga.get(b)).toBeDefined()
    expect(await hitungDataWarga(b)).toEqual({ kunjungan: 1, pemeriksaan: 1, lain: 2 })
    expect((await db.audit.orderBy('waktu').last())?.detail).toBe('Ani')
  })

  it('mengarsipkan, memulihkan, dan menghapus banyak warga sekaligus', async () => {
    const ids: number[] = []
    for (const n of ['Citra', 'Dodi', 'Eka', 'Fani']) ids.push((await db.warga.add({ ...warga(n), aktif: true })) as number)
    await db.imunisasi.add({ wargaId: ids[0], jenis: 'BCG', tanggal: '2026-01-01' })

    expect(await aturArsipWarga(ids, false)).toBe(4)
    expect((await db.warga.bulkGet(ids)).every((w) => w && !w.aktif)).toBe(true)
    expect((await db.audit.orderBy('waktu').last())?.detail).toBe('4 warga (Citra, Dodi, Eka, dst.)')

    // yang sudah berstatus sama dilewati
    expect(await aturArsipWarga([ids[0], ids[1]], true)).toBe(2)
    expect(await aturArsipWarga([ids[0], ids[1]], true)).toBe(0)

    expect(await hapusWargaPermanen([ids[0], ids[2], 999999])).toBe(2)
    expect(await db.warga.get(ids[0])).toBeUndefined()
    expect(await db.warga.get(ids[2])).toBeUndefined()
    expect(await db.warga.get(ids[1])).toBeDefined()
    expect(await db.imunisasi.where('wargaId').equals(ids[0]).count()).toBe(0)
  })
})
