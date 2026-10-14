import { tglPanjang, todayISO } from '../lib/age'
import type { Pengaturan } from '../lib/db'
import type { Bagian, HasilLaporan, Sel } from './types'

function isiSel(s: Sel) {
  if (typeof s === 'object') return <span className={s.tebal ? 'tebal' : s.kecil ? 'kecil' : ''}>{s.teks}</span>
  return <>{s}</>
}

function TabelBagian({ b }: { b: Bagian }) {
  const adaKelompok = b.kolom.some((k) => k.kelompok)
  const kosong = Math.max(0, (b.minBaris ?? 0) - b.baris.length)
  const jmlKolom = b.kolom.length

  // susun baris header: kolom berkelompok digabung per kelompok berurutan
  const atas: Array<{ judul: string; span: number; rowSpan: number; rata?: string; lebar?: string }> = []
  const bawah: Array<{ judul: string; rata?: string; lebar?: string }> = []
  if (adaKelompok) {
    let i = 0
    while (i < b.kolom.length) {
      const k = b.kolom[i]
      if (!k.kelompok) {
        atas.push({ judul: k.judul, span: 1, rowSpan: 2, rata: k.rata, lebar: k.lebar })
        i++
      } else {
        let j = i
        while (j < b.kolom.length && b.kolom[j].kelompok === k.kelompok) j++
        atas.push({ judul: k.kelompok, span: j - i, rowSpan: 1, rata: 'tengah' })
        for (let x = i; x < j; x++) bawah.push({ judul: b.kolom[x].judul, rata: b.kolom[x].rata, lebar: b.kolom[x].lebar })
        i = j
      }
    }
  }

  return (
    <>
      {b.judul && <h3 className="lap-subjudul">{b.judul}</h3>}
      <table className={`lap-tabel ${b.rapat ? 'rapat' : ''}`}>
        <colgroup>
          {b.kolom.map((k, i) => (
            <col key={i} style={k.lebar ? { width: k.lebar } : undefined} />
          ))}
        </colgroup>
        <thead>
          {adaKelompok ? (
            <>
              <tr>
                {atas.map((h, i) => (
                  <th key={i} colSpan={h.span} rowSpan={h.rowSpan} className={h.rata === 'tengah' ? 'tengah' : ''}>
                    {h.judul}
                  </th>
                ))}
              </tr>
              <tr>
                {bawah.map((h, i) => (
                  <th key={i} className={h.rata === 'tengah' ? 'tengah' : ''}>
                    {h.judul}
                  </th>
                ))}
              </tr>
            </>
          ) : (
            <tr>
              {b.kolom.map((k, i) => (
                <th key={i} className={k.rata === 'tengah' ? 'tengah' : ''}>
                  {k.judul}
                </th>
              ))}
            </tr>
          )}
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
          <dl>
            {hasil.metaKiri?.map(([a, b]) => (
              <div key={a}>
                <dt>{a}</dt>
                <dd>: {b}</dd>
              </div>
            ))}
          </dl>
          <dl>
            {hasil.metaKanan?.map(([a, b]) => (
              <div key={a}>
                <dt>{a}</dt>
                <dd>: {b}</dd>
              </div>
            ))}
          </dl>
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
