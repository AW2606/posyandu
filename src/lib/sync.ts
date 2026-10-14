import Dexie, { type Table } from 'dexie'
import type { PosyanduDB } from './db'

// Sinkronisasi local-first: UI selalu membaca/menulis IndexedDB. Setiap perubahan masuk antrean
// (outbox) lalu dikirim ke server; perubahan orang lain ditarik berdasarkan nomor urut `seq`.
// Konflik: yang terakhir tiba di server menang (per baris).

export interface BarisRemote {
  tbl: string
  id: string
  data: unknown
  deleted: boolean
}
export interface BarisTarik extends BarisRemote {
  seq: number
}

export interface Remote {
  dorong(rows: BarisRemote[]): Promise<void>
  tarik(sejak: number, batas: number): Promise<BarisTarik[]>
}

export interface Penyimpan {
  get(k: string): string | null
  set(k: string, v: string): void
}

export interface StatusSinkron {
  tunggu: number // jumlah perubahan belum terkirim
  terakhir?: number
  galat?: string
  ditolak: number // perubahan yang ditolak server (mis. izin)
  dilewati: number // baris dari server yang bentrok aturan unik lokal
  berjalan: boolean
}

/** Tabel yang disinkronkan beserta jenis kuncinya. `users` dan `outbox` sengaja tidak ikut. */
const TABEL: Array<{ nama: string; teks: boolean }> = [
  { nama: 'warga', teks: false },
  { nama: 'kegiatan', teks: false },
  { nama: 'kunjungan', teks: false },
  { nama: 'pemeriksaan', teks: false },
  { nama: 'statusKhusus', teks: false },
  { nama: 'layananObat', teks: false },
  { nama: 'imunisasi', teks: false },
  { nama: 'kehamilan', teks: false },
  { nama: 'audit', teks: false },
  { nama: 'kategori', teks: true },
  { nama: 'kv', teks: true },
]
const OVERLAP = 100 // tarik ulang sedikit ke belakang; menimpa data yang sama aman (idempotent)
const TOLAK_PERMANEN = ['42501', 'P0001']

export function buatSinkron(db: PosyanduDB, remote: Remote, simpan: Penyimpan, kunciSeq = 'posyandu.seq') {
  const status: StatusSinkron = { tunggu: 0, ditolak: 0, dilewati: 0, berjalan: false }
  const pendengar = new Set<() => void>()
  const kabar = () => pendengar.forEach((f) => f())
  const tabel = (n: string) => db.table(n) as Table<Record<string, unknown>, unknown>
  const infoTabel = new Map(TABEL.map((t) => [t.nama, t]))
  let dorongTertunda: ReturnType<typeof setTimeout> | undefined

  const bolehKirim = (tbl: string, pk: unknown) => !(tbl === 'kv' && pk !== 'pengaturan')

  /** Dipanggil dari hook di dalam transaksi tulis; harus keluar dari transaksi itu. */
  function antreLuar(tbl: string, pk: unknown) {
    void Dexie.ignoreTransaction(() => antre(tbl, pk)).catch(() => {})
  }

  async function antre(tbl: string, pk: unknown) {
    if (!bolehKirim(tbl, pk)) return
    const k = `${tbl}:${pk}`
    const lama = await db.outbox.get(k)
    await db.outbox.put({ k, tbl, id: String(pk), v: (lama?.v ?? 0) + 1 })
    status.tunggu = await db.outbox.count()
    kabar()
    jadwalDorong()
  }

  function jadwalDorong() {
    clearTimeout(dorongTertunda)
    dorongTertunda = setTimeout(() => void jalankan(), 1500)
  }

  for (const { nama } of TABEL) {
    const t = db.table(nama)
    // `transaction.remote` menandai penulisan dari server agar tidak dikirim balik
    t.hook('creating', function (pk, _obj, trx) {
      if ((trx as unknown as { remote?: boolean }).remote) return
      this.onsuccess = (k: unknown) => antreLuar(nama, k ?? pk)
    })
    t.hook('updating', function (_mods, pk, _obj, trx) {
      if ((trx as unknown as { remote?: boolean }).remote) return
      this.onsuccess = () => antreLuar(nama, pk)
    })
    t.hook('deleting', function (pk, _obj, trx) {
      if ((trx as unknown as { remote?: boolean }).remote) return
      this.onsuccess = () => antreLuar(nama, pk)
    })
  }

  const kunci = (tbl: string, id: string) => (infoTabel.get(tbl)?.teks ? id : Number(id))

  async function dorong(): Promise<void> {
    for (;;) {
      const batch = await db.outbox.limit(200).toArray()
      if (!batch.length) return
      const rows: BarisRemote[] = []
      for (const o of batch) {
        const baris = await tabel(o.tbl).get(kunci(o.tbl, o.id))
        rows.push({ tbl: o.tbl, id: o.id, data: baris ?? {}, deleted: !baris })
      }
      const bersih = async (daftar: typeof batch) => {
        await db.transaction('rw', db.outbox, async () => {
          for (const o of daftar) {
            const sekarang = await db.outbox.get(o.k)
            if (sekarang && sekarang.v === o.v) await db.outbox.delete(o.k)
          }
        })
      }
      try {
        await remote.dorong(rows)
        await bersih(batch)
      } catch (e) {
        // satu baris ditolak jangan menghalangi yang lain: coba satu per satu
        const kode = (e as { code?: string }).code
        if (!kode || !TOLAK_PERMANEN.includes(kode)) throw e
        for (let i = 0; i < batch.length; i++) {
          try {
            await remote.dorong([rows[i]])
          } catch (e2) {
            const k2 = (e2 as { code?: string }).code
            if (!k2 || !TOLAK_PERMANEN.includes(k2)) throw e2
            status.ditolak++
          }
          await bersih([batch[i]])
        }
      }
      status.tunggu = await db.outbox.count()
      kabar()
    }
  }

  async function terapkan(rows: BarisTarik[]) {
    const tertunda = new Set((await db.outbox.toArray()).map((o) => o.k))
    const perTabel = new Map<string, BarisTarik[]>()
    for (const r of rows) {
      if (!infoTabel.has(r.tbl) || tertunda.has(`${r.tbl}:${r.id}`)) continue
      if (!perTabel.has(r.tbl)) perTabel.set(r.tbl, [])
      perTabel.get(r.tbl)!.push(r)
    }
    for (const [nama, daftar] of perTabel) {
      const t = tabel(nama)
      const tulis = (r: BarisTarik) =>
        r.deleted ? t.delete(kunci(nama, r.id)) : t.put(r.data as Record<string, unknown>)
      try {
        await db.transaction('rw', t, async (trx) => {
          ;(trx as unknown as { remote: boolean }).remote = true
          for (const r of daftar) await tulis(r)
        })
      } catch {
        // cepat gagal (mis. bentrok indeks unik); ulangi satu per satu dan lewati yang bermasalah
        for (const r of daftar) {
          try {
            await db.transaction('rw', t, async (trx) => {
              ;(trx as unknown as { remote: boolean }).remote = true
              await tulis(r)
            })
          } catch {
            status.dilewati++
          }
        }
      }
    }
  }

  async function tarik(): Promise<void> {
    let sejak = Math.max(0, Number(simpan.get(kunciSeq) ?? 0) - OVERLAP)
    for (;;) {
      const rows = await remote.tarik(sejak, 500)
      if (!rows.length) return
      await terapkan(rows)
      const maks = Math.max(...rows.map((r) => r.seq))
      simpan.set(kunciSeq, String(maks))
      if (rows.length < 500) return
      sejak = maks
    }
  }

  let sedang: Promise<StatusSinkron> | null = null
  function jalankan(): Promise<StatusSinkron> {
    if (sedang) return sedang
    status.berjalan = true
    status.galat = undefined
    kabar()
    sedang = (async () => {
      try {
        await dorong()
        await tarik()
        status.terakhir = Date.now()
      } catch (e) {
        status.galat = e instanceof Error ? e.message : String(e)
      } finally {
        status.tunggu = await db.outbox.count()
        status.berjalan = false
        sedang = null
        kabar()
      }
      return { ...status }
    })()
    return sedang
  }

  /** Antrekan seluruh isi perangkat ini (untuk menghubungkan perangkat yang sudah berisi data). */
  async function unggahSemua(): Promise<number> {
    let n = 0
    for (const { nama } of TABEL) {
      for (const pk of (await tabel(nama).toCollection().primaryKeys()) as unknown[]) {
        if (!bolehKirim(nama, pk)) continue
        const k = `${nama}:${pk}`
        const lama = await db.outbox.get(k)
        await db.outbox.put({ k, tbl: nama, id: String(pk), v: (lama?.v ?? 0) + 1 })
        n++
      }
    }
    status.tunggu = await db.outbox.count()
    kabar()
    return n
  }

  return {
    status,
    jalankan,
    unggahSemua,
    berlangganan(f: () => void) {
      pendengar.add(f)
      return () => void pendengar.delete(f)
    },
    berhenti() {
      clearTimeout(dorongTertunda)
    },
  }
}

export type Sinkron = ReturnType<typeof buatSinkron>
