import { tglPanjang, todayISO } from '../lib/age'
import type { Pengaturan } from '../lib/db'
import type { Bagian, HasilLaporan, Sel } from './types'

function isiSel(s: Sel) {
  if (typeof s === 'object') return <span className={s.tebal ? 'tebal' : s.kecil ? 'kecil' : ''}>{s.teks}</span>
  return <>{s}</>
}

type SelKepala = { judul: string; span: number; rowSpan: number; tengah: boolean }

/**
 * Susun baris judul tabel. Tiap kolom punya jalur [induk?, kelompok?, judul]; judul kelompok yang sama dan
 * berurutan digabung, dan judul kolom memanjang ke bawah sampai baris terakhir.
 */
export function susunKepala(kolom: Bagian['kolom']): SelKepala[][] {
  const jalur = kolom.map((k) => [...(k.kelompok && k.induk ? [k.induk] : []), ...(k.kelompok ? [k.kelompok] : []), k.judul])
  const dalam = Math.max(1, ...jalur.map((j) => j.length))
  const baris: SelKepala[][] = Array.from({ length: dalam }, () => [])
  for (let r = 0; r < dalam; r++) {
    let i = 0
    while (i < kolom.length) {
      const j = jalur[i]
      if (r > j.length - 1) { i++; continue } // sudah tertutup judul kolom di atasnya
      if (r === j.length - 1) {
        baris[r].push({ judul: j[r], span: 1, rowSpan: dalam - r, tengah: kolom[i].rata === 'tengah' })
        i++
        continue
      }
      const awalan = j.slice(0, r + 1).join('\u0000')
      let s = i + 1
      while (s < kolom.length && jalur[s].length - 1 > r && jalur[s].slice(0, r + 1).join('\u0000') === awalan) s++
      baris[r].push({ judul: j[r], span: s - i, rowSpan: 1, tengah: true })
      i = s
    }
  }
  return baris
}

function TabelBagian({ b }: { b: Bagian }) {
  const kosong = Math.max(0, (b.minBaris ?? 0) - b.baris.length)
  const jmlKolom = b.kolom.length
  const kepala = susunKepala(b.kolom)

  return (
    <>
      {b.judul && <h3 className="lap-subjudul">{b.judul}</h3>}
      <table className={`lap-tabel ${b.rapat ? 'rapat' : ''} ${b.rapat === 'sangat' ? 'sangat-rapat' : ''}`}>
        <colgroup>
          {b.kolom.map((k, i) => (
            <col key={i} style={k.lebar ? { width: k.lebar } : undefined} />
          ))}
        </colgroup>
        <thead>
          {kepala.map((r, i) => (
            <tr key={i}>
              {r.map((h, j) => (
                <th key={j} colSpan={h.span > 1 ? h.span : undefined} rowSpan={h.rowSpan > 1 ? h.rowSpan : undefined} className={h.tengah ? 'tengah' : ''}>
                  {h.judul}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {b.baris.map((r, i) =>
            Array.isArray(r) ? (
              <tr key={i}>
                {r.map((s, j) => (
                  <td key={j} className={b.kolom[j]?.rata === 'tengah' ? 'tengah' : ''}>
                    {isiSel(s)}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={i} className="grup">
                <td colSpan={jmlKolom}>{r.grup}</td>
              </tr>
            ),
          )}
          {Array.from({ length: kosong }, (_, i) => (
            <tr key={`k${i}`} className="kosong">
              {b.kolom.map((_, j) => (
                <td key={j}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function LembarLaporan({
  hasil,
  ttd,
  pengaturan,
}: {
  hasil: HasilLaporan
  ttd: boolean
  pengaturan: Pengaturan
}) {
  const [utama, ...lain] = hasil.kop
  return (
    <section className={`lembar ${hasil.orientasi}`}>
      <header className={`lap-kop ${hasil.gayaKop ?? 'tengah'}`}>
        <h1>{utama}</h1>
        {lain.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </header>
      {hasil.judul && <h2 className="lap-judul">{hasil.judul}</h2>}
      {(hasil.metaKiri || hasil.metaKanan) && (
        <div className="lap-meta">
          {[hasil.metaKiri, hasil.metaKanan].map((meta, i) => (
            // grid 3 kolom (label | : | isi) supaya titik dua sejajar mengikuti label terpanjang
            <dl key={i}>
              {meta?.map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd className="titik2" aria-hidden>:</dd>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      )}
      {hasil.bagian.map((b, i) => (
        <TabelBagian key={i} b={b} />
      ))}
      {hasil.catatan?.map((c, i) => (
        <p key={i} className="lap-catatan">
          {c}
        </p>
      ))}
      {ttd && (
        <div className="lap-ttd">
          <div />
          <div>
            <p>
              {pengaturan.desa.charAt(0) + pengaturan.desa.slice(1).toLowerCase()}, {tglPanjang(todayISO())}
            </p>
            <div className="ttd-baris">
              <div>
                <p>Kader</p>
                <p className="nama">{pengaturan.kader || '(.....................)'}</p>
              </div>
              <div>
                <p>Ketua Posyandu</p>
                <p className="nama">{pengaturan.ketua || '(.....................)'}</p>
              </div>
              <div>
                <p>Bidan</p>
                <p className="nama">{pengaturan.bidan || '(.....................)'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
