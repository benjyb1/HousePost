/** Accepted logo uploads. PDFs are rasterised (page 1); everything else is embedded as-is. */
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024
/** Longest edge kept for bitmaps: enough to cover the whole 1819px card at 300 DPI. */
const MAX_EDGE = 2400

export interface LogoSource {
  src: string
  naturalW: number
  naturalH: number
}

export async function loadLogoFile(file: File): Promise<LogoSource> {
  if (file.size > MAX_BYTES) throw new Error('Logo must be under 10 MB')
  if (file.type === 'application/pdf') return pdfToSource(file)
  if (!LOGO_ACCEPT.split(',').includes(file.type)) throw new Error('Use a PNG, JPG, SVG or PDF')
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)
  if (file.type === 'image/svg+xml' || Math.max(img.naturalWidth, img.naturalHeight) <= MAX_EDGE) {
    return { src: dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
  }
  return downscale(img)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not a valid image'))
    img.src = src
  })
}

/** Shrink an oversized bitmap to MAX_EDGE; always PNG so transparency survives. */
function downscale(img: HTMLImageElement): LogoSource {
  const scale = MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, w, h)
  return { src: canvas.toDataURL('image/png'), naturalW: w, naturalH: h }
}

async function pdfToSource(file: File): Promise<LogoSource> {
  // Same lazy import + worker path the custom-design uploader uses.
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = MAX_EDGE / Math.max(base.width, base.height)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise // pdfjs 5 signature, same as UploadCustomDesign.tsx
  return { src: canvas.toDataURL('image/png'), naturalW: canvas.width, naturalH: canvas.height }
}
