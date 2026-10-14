import { useState } from 'react'
import { getKonfig, simpanKonfig } from '../lib/cloud'
import { Field } from './ui'

/** Isi alamat dan kunci publik (anon) proyek Supabase. Disimpan di perangkat ini. */
export function FormServer() {
  const awal = getKonfig()
  const [url, setUrl] = useState(awal?.url ?? '')
  const [key, setKey] = useState(awal?.key ?? '')
  const sah = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim()) && key.trim().length > 20

  return (
    <div>
      <Field label="Alamat proyek (Project URL)" petunjuk="Contoh: https://abcdxyz.supabase.co">
        <input className="input" autoCapitalize="none" autoCorrect="off" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="Kunci publik (anon public key)" petunjuk="Bukan service_role. Kunci anon memang aman ditaruh di aplikasi; keamanan data dijaga aturan di server.">
        <input className="input" autoCapitalize="none" autoCorrect="off" value={key} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <div className="baris">
        <button
          type="button"
          className="btn utama"
          disabled={!sah}
          onClick={() => {
            simpanKonfig({ url: url.trim().replace(/\/$/, ''), key: key.trim() })
            location.reload()
          }}
        >
          Simpan dan hubungkan
        </button>
        {awal && (
          <button
            type="button"
            className="btn bahaya"
            onClick={() => {
              simpanKonfig(null)
              location.reload()
            }}
          >
            Putuskan
          </button>
        )}
      </div>
    </div>
  )
}

export function ChipSinkron({ status }: { status: import('../lib/sync').StatusSinkron }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const teks = status.berjalan
    ? 'Menyinkron…'
    : offline
      ? `Offline${status.tunggu ? ` · ${status.tunggu} menunggu` : ''}`
      : status.galat
        ? 'Gagal sinkron'
        : status.tunggu
          ? `${status.tunggu} menunggu`
          : 'Tersinkron'
  const warna = status.galat || offline ? '#fca5a5' : status.tunggu || status.berjalan ? '#fde68a' : '#86efac'
  return (
    <span title={status.galat ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, opacity: 0.95 }}>
      <i style={{ width: 9, height: 9, borderRadius: '50%', background: warna, display: 'inline-block' }} />
      {teks}
    </span>
  )
}
