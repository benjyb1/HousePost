// Shared helpers for the in-browser SVG postcard templates.
//
// Everything here is pure (no DOM, no fetch) so a template can be rendered both
// in the live preview and rasterised to a print file from the exact same string.

/** Normalise any user-entered colour to a `#rrggbb` string (falls back to black). */
export function normaliseHex(hex: string): string {
  let h = (hex ?? '').trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#000000'
  return '#' + h.toLowerCase()
}

function toRgb(hex: string) {
  const h = normaliseHex(hex).slice(1)
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function toHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Mix a colour toward another by `amount` (0–1). */
function mix(hex: string, target: { r: number; g: number; b: number }, amount: number) {
  const c = toRgb(hex)
  return toHex(
    c.r + (target.r - c.r) * amount,
    c.g + (target.g - c.g) * amount,
    c.b + (target.b - c.b) * amount
  )
}

/** Lighten toward white by `amount` (0–1). */
export function lighten(hex: string, amount: number) {
  return mix(hex, { r: 255, g: 255, b: 255 }, amount)
}

/** Darken toward black by `amount` (0–1). */
export function darken(hex: string, amount: number) {
  return mix(hex, { r: 0, g: 0, b: 0 }, amount)
}

/** Pick a legible text colour (near-black or white) for a given background. */
export function readableOn(hex: string): string {
  const { r, g, b } = toRgb(hex)
  // Relative luminance (sRGB, simple approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#0f172a' : '#ffffff'
}

/** Escape text so it is safe inside SVG/XML markup. */
export function escapeXml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Estimate a font size that keeps a single line within `maxWidth`. Text is
 * user-editable, so heros are auto-shrunk rather than allowed to overflow the
 * card. `factor` is the rough average glyph-width : font-size ratio for the face.
 */
// Real rendered text runs a few percent wider than `factor` predicts (checked
// against true getBBox bounds — a bold uppercase line measured 0.644 where the
// code assumed 0.62). Without a buffer a "fitted" hero can still cross its own
// margin, so pad the width estimate: text shrinks a touch sooner and stays
// inside the safe box even on faces the factor under-measures.
const FIT_BUFFER = 1.08

export function fitSize(text: string, maxWidth: number, base: number, factor = 0.56): number {
  const len = Math.max(1, (text ?? '').length)
  const estimated = len * base * factor * FIT_BUFFER
  if (estimated <= maxWidth) return base
  return Math.max(20, Math.floor((base * maxWidth) / estimated))
}

/**
 * Greedily wrap `text` into lines that each fit `maxWidth` at `fontSize`, using
 * the same glyph-width estimate as {@link fitSize}. Used for the back message,
 * which SVG won't wrap on its own. Caps at `maxLines`, ellipsising the last line
 * if the text is longer (the nested-SVG clip is the final backstop).
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  factor = 0.52,
  maxLines = 6
): string[] {
  const words = (text ?? '').trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && candidate.length * fontSize * factor > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[.,;:!?]+$/, '') + '…'
    return kept
  }
  return lines
}

// Web-safe font stacks — no external fetch, so preview and rasterised export
// render identically (the whole point of avoiding a Google-font dependency).
// Each stack degrades to a safe fallback, so a machine missing the first face
// still renders something intentional rather than a broken box.
export const FONTS = {
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  rounded: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
  /** Refined book serif — for elegant, editorial looks (interior design, salon). */
  elegantSerif: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
  /** Geometric sans — clean and modern (creative, professional). */
  geometric: "'Century Gothic', 'Futura', 'Avenir Next', 'Trebuchet MS', sans-serif",
  /** Monospace — technical, architectural (builders, photographers). */
  mono: "'Courier New', Courier, monospace",
} as const

// A6 landscape + 3mm bleed at 300 DPI.
export const CARD_W = 1819
export const CARD_H = 1311

// The postcard BACK reserves the right half for the printed address, postage and
// barcode, so a back design only occupies the LEFT half. HALF_W is the centre
// line; keep meaningful back content a little inside it.
export const HALF_W = Math.round(CARD_W / 2) // 910

/**
 * First letters of up to two words in a name, for a monogram / roundel.
 * e.g. "Harbour & Vale" → "HV", "Bloom" → "B". Skips lone "&"/"and".
 */
export function initials(name: string): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^(&|and)$/i.test(w))
  if (words.length === 0) return ''
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase())
  return letters.join('')
}
