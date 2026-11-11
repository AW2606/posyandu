import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BATAS_AUDIT, catat, db, pangkasAudit } from './db'

describe('riwayat perubahan', () => {
  it('menyimpan paling banyak BATAS_AUDIT baris dan menghapus yang tertua', async () => {
    await db.audit.clear()
    const awal = Date.now() - 1_000_000
    await db.audit.bulkAdd(Array.from({ length: BATAS_AUDIT }, (_, i) => ({ waktu: awal + i, user: 'u', aksi: 'tambah', entitas: 'warga', detail: `ke-${i + 1}` })))
    expect(await db.audit.count()).toBe(BATAS_AUDIT)

    await catat('ubah', 'warga', 'ke-501')
    expect(await db.audit.count()).toBe(BATAS_AUDIT)
    const tertua = await db.audit.orderBy('waktu').first()
    expect(tertua?.detail).toBe('ke-2')
    const terbaru = await db.audit.orderBy('waktu').last()
    expect(terbaru?.detail).toBe('ke-501')
  })

  it('memangkas kelebihan sekaligus (mis. setelah menarik data dari server)', async () => {
    await db.audit.clear()
    await db.audit.bulkAdd(Array.from({ length: 12 }, (_, i) => ({ waktu: i, user: '', aksi: 'tambah', entitas: 'x', detail: String(i) })))
    expect(await pangkasAudit(10)).toBe(2)
    expect((await db.audit.orderBy('waktu').first())?.detail).toBe('2')
  })
})
