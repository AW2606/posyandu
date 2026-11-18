import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from './db'
import { daftarkan, hapusPeserta } from './layanan'

describe('hapus peserta dari kegiatan', () => {
  it('menghapus kunjungan, pemeriksaan, dan obat warga itu saja; warga tetap ada dan bisa didaftarkan lagi', async () => {
    const wargaDasar = { nik: '', noKK: '', tanggalLahir: '1990-01-01', jk: 'P' as const, rt: '22', dusun: '', alamat: '', namaOrtu: '', aktif: true, dibuat: 0, diubah: 0 }
    const a = (await db.warga.add({ ...wargaDasar, nama: 'Ani' })) as number
    const b = (await db.warga.add({ ...wargaDasar, nama: 'Budi' })) as number
    const keg = (await db.kegiatan.add({ tanggal: '2026-11-16', lokasi: '', keterangan: '' })) as number
    await daftarkan(keg, a)
    await daftarkan(keg, b)
    const ka = (await db.kunjungan.where('[kegiatanId+wargaId]').equals([keg, a]).first())!
    const kb = (await db.kunjungan.where('[kegiatanId+wargaId]').equals([keg, b]).first())!
    await db.pemeriksaan.add({ kunjunganId: ka.id!, kegiatanId: keg, wargaId: a, tanggal: '2026-11-16', bb: 50, catatan: '' })
    await db.pemeriksaan.add({ kunjunganId: kb.id!, kegiatanId: keg, wargaId: b, tanggal: '2026-11-16', bb: 60, catatan: '' })
    await db.layananObat.add({ kegiatanId: keg, wargaId: a, jenis: 'Vitamin A', keterangan: 'Merah' })
    await db.layananObat.add({ kegiatanId: keg, wargaId: b, jenis: 'Vitamin A', keterangan: 'Merah' })

    await hapusPeserta(ka.id!, 'Ani')

    expect(await db.kunjungan.get(ka.id!)).toBeUndefined()
    expect(await db.pemeriksaan.where('wargaId').equals(a).count()).toBe(0)
    expect(await db.layananObat.where('wargaId').equals(a).count()).toBe(0)
    expect(await db.warga.get(a)).toBeDefined()
    // peserta lain tidak tersentuh, nomor antreannya tetap
    expect((await db.kunjungan.get(kb.id!))?.noAntrean).toBe(2)
    expect(await db.pemeriksaan.where('wargaId').equals(b).count()).toBe(1)
    expect(await db.layananObat.where('wargaId').equals(b).count()).toBe(1)
    expect((await db.audit.orderBy('waktu').last())?.entitas).toBe('peserta')

    expect((await daftarkan(keg, a)).ok).toBe(true)
  })
})
