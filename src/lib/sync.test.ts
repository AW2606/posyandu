import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { PosyanduDB, type Warga } from './db'
import { buatSinkron, type BarisRemote, type BarisTarik, type Remote } from './sync'

class ServerPalsu implements Remote {
  baris = new Map<string, BarisTarik>()
  seq = 0
  tolakTabel: string[] = []
  async dorong(rows: BarisRemote[]) {
    for (const r of rows) {
      if (this.tolakTabel.includes(r.tbl)) throw Object.assign(new Error('hanya admin'), { code: 'P0001' })
    }
    for (const r of rows) this.baris.set(`${r.tbl}:${r.id}`, { ...structuredClone(r), seq: ++this.seq })
  }
  async tarik(sejak: number, batas: number) {
    return [...this.baris.values()].filter((r) => r.seq > sejak).sort((a, b) => a.seq - b.seq).slice(0, batas).map((r) => structuredClone(r))
  }
}

const penyimpan = () => {
  const m = new Map<string, string>()
  return { get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v) }
}

let n = 0
function perangkat(server: ServerPalsu) {
  const db = new PosyanduDB(`uji-${++n}-${Math.random()}`)
  const s = buatSinkron(db, server, penyimpan())
  return { db, s }
}
const jeda = () => new Promise((r) => setTimeout(r, 30))
const aktif: Array<() => void> = []
afterEach(() => aktif.splice(0).forEach((f) => f()))

const warga = (nama: string, nik = ''): Omit<Warga, 'id'> => ({
  nama, nik, noKK: '', tanggalLahir: '1990-01-01', jk: 'P', rt: '22', dusun: 'Dusun 5', alamat: '', namaOrtu: '', aktif: true, dibuat: 1, diubah: 1,
})

function dua() {
  const server = new ServerPalsu()
  const A = perangkat(server)
  const B = perangkat(server)
  aktif.push(A.s.berhenti, B.s.berhenti)
  return { server, A, B }
}

describe('sinkronisasi', () => {
  it('id baru unik dan besar (aman lintas perangkat)', async () => {
    const { A } = dua()
    const a = (await A.db.warga.add(warga('X') as Warga)) as number
    const b = (await A.db.warga.add(warga('Y') as Warga)) as number
    expect(a).toBeGreaterThan(1e15)
    expect(a).not.toBe(b)
    expect(Number.isSafeInteger(a)).toBe(true)
  })

  it('data satu perangkat sampai ke perangkat lain, lalu ubah dan hapus ikut', async () => {
    const { A, B } = dua()
    const id = (await A.db.warga.add(warga('Siti') as Warga)) as number
    await jeda()
    await A.s.jalankan()
    await B.s.jalankan()
    expect((await B.db.warga.get(id))?.nama).toBe('Siti')
    expect(await B.db.outbox.count()).toBe(0) // data dari server tidak dikirim balik

    await B.db.warga.update(id, { nama: 'Siti Aminah' })
    await jeda()
    await B.s.jalankan()
    await A.s.jalankan()
    expect((await A.db.warga.get(id))?.nama).toBe('Siti Aminah')

    await A.db.warga.delete(id)
    await jeda()
    await A.s.jalankan()
    await B.s.jalankan()
    expect(await B.db.warga.get(id)).toBeUndefined()
  })

  it('perubahan lokal yang belum terkirim tidak tertimpa data server', async () => {
    const { A, B } = dua()
    const id = (await A.db.warga.add(warga('Awal') as Warga)) as number
    await jeda()
    await A.s.jalankan()
    await B.s.jalankan()
    await A.db.warga.update(id, { nama: 'Dari A' })
    await jeda()
    await A.s.jalankan() // server: Dari A
    await B.db.warga.update(id, { nama: 'Dari B (belum kirim)' })
    await jeda()
    // B menarik tanpa mengirim lebih dulu: ubah antrean saja tidak boleh tertimpa
    const saatTarik = await B.db.outbox.count()
    expect(saatTarik).toBeGreaterThan(0)
    await B.s.jalankan() // kirim dulu lalu tarik; B terakhir tiba, B menang
    await A.s.jalankan()
    expect((await A.db.warga.get(id))?.nama).toBe('Dari B (belum kirim)')
  })

  it('penolakan izin pada satu baris tidak menghalangi baris lain', async () => {
    const { server, A, B } = dua()
    server.tolakTabel = ['kategori']
    await A.db.kategori.put({ kode: 'x', nama: 'X', umurMin: 0, umurMax: 1, urutan: 1 })
    const id = (await A.db.warga.add(warga('Lolos') as Warga)) as number
    await jeda()
    const st = await A.s.jalankan()
    expect(st.ditolak).toBe(1)
    expect(await A.db.outbox.count()).toBe(0)
    await B.s.jalankan()
    expect((await B.db.warga.get(id))?.nama).toBe('Lolos')
    expect(await B.db.kategori.get('x')).toBeUndefined()
  })

  it('kunjungan ganda dari dua perangkat tidak merusak sinkron (dilewati)', async () => {
    const { A, B } = dua()
    const k = { kegiatanId: 1, wargaId: 2, noAntrean: 1, hadir: true, tahap: 'terdaftar' as const, penyuluhan: '', rujukan: '' }
    await A.db.kunjungan.add({ ...k })
    await B.db.kunjungan.add({ ...k, noAntrean: 5 })
    await jeda()
    await A.s.jalankan()
    const stB = await B.s.jalankan()
    expect(stB.galat).toBeUndefined()
    expect(stB.dilewati).toBe(1)
    expect(await B.db.kunjungan.count()).toBe(1)
  })

  it('unggah semua mengantrekan data yang sudah ada sebelum terhubung', async () => {
    const server = new ServerPalsu()
    const db = new PosyanduDB(`uji-lama-${Math.random()}`)
    await db.warga.add(warga('Lama 1') as Warga)
    await db.warga.add(warga('Lama 2') as Warga)
    const s = buatSinkron(db, server, penyimpan())
    aktif.push(s.berhenti)
    expect(await s.unggahSemua()).toBeGreaterThanOrEqual(2)
    await s.jalankan()
    expect([...server.baris.keys()].filter((x) => x.startsWith('warga:')).length).toBe(2)
  })

  it('kv selain pengaturan tidak disinkronkan', async () => {
    const { A } = dua()
    await A.db.kv.put({ key: 'lain', value: 1 })
    await A.db.kv.put({ key: 'pengaturan', value: { a: 1 } })
    await jeda()
    expect((await A.db.outbox.toArray()).map((o) => o.k)).toEqual(['kv:pengaturan'])
  })
})
