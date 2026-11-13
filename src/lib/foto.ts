// Foto profil diperkecil di perangkat sebelum disimpan: dipotong persegi dari tengah, 256 px, JPEG.
// Hasilnya data URL kecil (sekitar 15-40 KB) yang disimpan langsung di data akun, jadi tidak butuh
// penyimpanan berkas terpisah dan tetap tampil saat offline.

export const SISI_FOTO = 256
/** Batas berkas asli yang diterima (sebelum diperkecil). */
export const MAKS_BERKAS = 15 * 1024 * 1024
/** Batas hasil akhir; sama dengan batasan di server (docs/supabase.sql). */
export const MAKS_DATA_URL = 300_000

export function cekBerkasFoto(f: { type: string; size: number }): string | null {
  if (!/^image\//.test(f.type)) return 'Berkas harus berupa gambar (JPG atau PNG).'
  if (f.size > MAKS_BERKAS) return 'Ukuran gambar terlalu besar (maksimal 15 MB).'
  return null
}

/** Potongan persegi dari tengah gambar berukuran w x h. */
export function potongTengah(w: number, h: number): { sx: number; sy: number; sisi: number } {
  const sisi = Math.min(w, h)
  return { sx: Math.round((w - sisi) / 2), sy: Math.round((h - sisi) / 2), sisi }
}

// ---------------------------------------------------------------- pratinjau & atur posisi
// Gambar ditampilkan di bingkai persegi berukuran `bingkai` px. `skala` = px layar per px gambar.
// (x, y) = posisi pojok kiri atas gambar terhadap bingkai (selalu <= 0 supaya bingkai tertutup penuh).

export const ZOOM_MAKS = 4

/** Skala terkecil supaya gambar menutupi seluruh bingkai. */
export const skalaDasar = (w: number, h: number, bingkai: number) => bingkai / Math.min(w, h)

/** Jaga posisi supaya tidak ada sisi bingkai yang kosong. */
export function batasiPosisi(p: { x: number; y: number }, w: number, h: number, skala: number, bingkai: number) {
  const jepit = (v: number, min: number) => Math.min(0, Math.max(min, v))
  return { x: jepit(p.x, bingkai - w * skala), y: jepit(p.y, bingkai - h * skala) }
}

/** Posisi awal: gambar di tengah bingkai. */
export function posisiTengah(w: number, h: number, skala: number, bingkai: number) {
  return { x: (bingkai - w * skala) / 2, y: (bingkai - h * skala) / 2 }
}

/** Ubah skala dengan titik tengah bingkai tetap di tempat (terasa seperti zoom ke tengah). */
export function zoomKeTengah(p: { x: number; y: number }, skalaLama: number, skalaBaru: number, w: number, h: number, bingkai: number) {
  const c = bingkai / 2
  const gx = (c - p.x) / skalaLama
  const gy = (c - p.y) / skalaLama
  return batasiPosisi({ x: c - gx * skalaBaru, y: c - gy * skalaBaru }, w, h, skalaBaru, bingkai)
}

/** Bagian gambar asli (px gambar) yang terlihat di bingkai. */
export function kotakSumber(p: { x: number; y: number }, skala: number, bingkai: number) {
  return { sx: -p.x / skala || 0, sy: -p.y / skala || 0, sisi: bingkai / skala } // `|| 0` membuang -0
}

/** Gambar potongan `kotak` dari `img` ke JPEG persegi 256 px. */
export function potongKeDataUrl(img: HTMLImageElement, kotak: { sx: number; sy: number; sisi: number }): string {
  const c = document.createElement('canvas')
  c.width = SISI_FOTO
  c.height = SISI_FOTO
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Perangkat tidak mendukung pengolahan gambar.')
  ctx.fillStyle = '#fff' // latar putih untuk PNG transparan
  ctx.fillRect(0, 0, SISI_FOTO, SISI_FOTO)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, kotak.sx, kotak.sy, kotak.sisi, kotak.sisi, 0, 0, SISI_FOTO, SISI_FOTO)
  for (const q of [0.85, 0.7, 0.55]) {
    const url = c.toDataURL('image/jpeg', q)
    if (url.length < MAKS_DATA_URL) return url
  }
  throw new Error('Gambar terlalu rumit untuk diperkecil. Coba foto lain.')
}

/**
 * Muat gambar dari alamat (mis. hasil URL.createObjectURL). Alamat TIDAK dicabut di sini:
 * pemanggil yang masih menampilkan gambar itu yang mencabutnya saat selesai.
 */
export function muatGambarDariUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, gagal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => gagal(new Error('Gambar tidak bisa dibaca. Coba foto lain.'))
    img.src = url
  })
}

/** Muat berkas gambar sekali pakai (tidak ditampilkan); alamat sementaranya langsung dicabut. */
export async function muatGambar(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await muatGambarDariUrl(url)
    await img.decode().catch(() => {}) // pastikan piksel siap sebelum alamat dicabut
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Ubah berkas gambar menjadi data URL JPEG persegi 256 px. */
export async function kecilkanFoto(file: File): Promise<string> {
  const g = cekBerkasFoto(file)
  if (g) throw new Error(g)
  const img = await muatGambar(file)
  return potongKeDataUrl(img, potongTengah(img.naturalWidth, img.naturalHeight))
}
