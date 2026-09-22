// Shared, dependency-free PNG + opt-out stamping helpers for the two Node
// maintenance scripts (upload-default-back.mjs, backfill-optout.mjs).
//
// Node has no <canvas>, so the opt-out line is drawn from a tiny built-in 5×7
// bitmap font straight into the pixel buffer. It lands at the SAME place the
// browser draws it — centre x=1365, baseline y=1225 on the 1819×1311 card — so
// the default and back-filled backs match the templates and uploads.
//
// GEOMETRY IS DUPLICATED FROM components/postcards/opt-out.ts on purpose: these
// are plain `node script.mjs` tools with no TypeScript loader, so they can't
// import the .ts source. Keep the two in sync (they are simple fixed numbers).

import zlib from 'node:zlib'

/** Fixed opt-out geometry on the 1819×1311 print card. Mirror of opt-out.ts. */
export const GEOM = {
  W: 1819,
  H: 1311,
  TEXT: 'housepost.co.uk/opt-out',
  CX: 1365, // centre x (right/address half)
  BASELINE: 1225, // alphabetic baseline y (CARD_H − 86)
  GREY: 0x66, // #666666 as an 8-bit grey level
  SCALE: 3, // px per font cell — 5×7 glyph ≈ 15px x-height / 21px cap, ~30px feel
}

// A compact 5-wide font. Each glyph is 9 rows (indices 0–8); the baseline is the
// BOTTOM of row 6, so rows 7–8 hold descenders (only 'p' needs one). Only the
// glyphs in `housepost.co.uk/opt-out` are defined.
const GLYPHS = {
  h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#', '.....', '.....'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....', '.....'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.###.', '.....', '.....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.', '.....', '.....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.', '.....', '.....'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '##...', '##...', '.....', '.....'],
  c: ['.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.', '.....', '.....'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.....', '.###.', '.....', '.....', '.....', '.....'],
}

const GLYPH_ROWS = 9
const GLYPH_COLS = 5
const BASELINE_ROW = 6 // baseline sits at the bottom of this row

/** Width in px the opt-out line occupies at scale `s` (5-col glyphs + 1-col gaps). */
function textWidthPx(text, s) {
  return (text.length * (GLYPH_COLS + 1) - 1) * s
}

/**
 * Stamp the opt-out line into a raster { width, height, channels, data }, using
 * the shared geometry. `data` is row-major, `channels` bytes/pixel (1 grey, 2
 * grey+α, 3 rgb, 4 rgba). Idempotent: re-stamping writes the same grey pixels.
 */
export function stampOptOut(raster, { text = GEOM.TEXT, cx = GEOM.CX, baseline = GEOM.BASELINE, scale = GEOM.SCALE } = {}) {
  const s = scale
  const advance = (GLYPH_COLS + 1) * s
  let x = Math.round(cx - textWidthPx(text, s) / 2)
  for (const ch of text) {
    const glyph = GLYPHS[ch]
    if (!glyph) {
      // No glyph defined — skip its slot rather than throw, so an unexpected
      // character can't abort a whole back-fill run.
      x += advance
      continue
    }
    for (let r = 0; r < GLYPH_ROWS; r++) {
      const row = glyph[r]
      // Device y of the top of this cell: baseline is the bottom of row 6.
      const y0 = baseline - (BASELINE_ROW + 1 - r) * s
      for (let c = 0; c < GLYPH_COLS; c++) {
        if (row[c] !== '#') continue
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            setGrey(raster, x + c * s + dx, y0 + dy)
          }
        }
      }
    }
    x += advance
  }
  return raster
}

/** Set one pixel to the opt-out grey, respecting the raster's channel layout. */
function setGrey(raster, x, y) {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return
  const c = raster.channels
  const i = (y * raster.width + x) * c
  const d = raster.data
  if (c === 1) {
    d[i] = GEOM.GREY
  } else if (c === 2) {
    d[i] = GEOM.GREY
    d[i + 1] = 255
  } else if (c === 3) {
    d[i] = d[i + 1] = d[i + 2] = GEOM.GREY
  } else {
    d[i] = d[i + 1] = d[i + 2] = GEOM.GREY
    d[i + 3] = 255
  }
}

/** A solid-white raster of the given size (channels: 1 grey, 3 rgb, 4 rgba). */
export function whiteRaster(width, height, channels = 1) {
  const data = new Uint8Array(width * height * channels).fill(255)
  return { width, height, channels, data }
}

/* ------------------------------ PNG codec ------------------------------- */
/* 8-bit, non-interlaced. Encode: grey/greyα/rgb/rgba. Decode: colour types   */
/* 0/2/4/6 with all five scanline filters (what a browser canvas emits).      */

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CH_TO_COLORTYPE = { 1: 0, 2: 4, 3: 2, 4: 6 }
const COLORTYPE_TO_CH = { 0: 1, 2: 3, 4: 2, 6: 4 }

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const cc = Buffer.alloc(4)
  cc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, cc])
}

/** Encode a raster to a PNG buffer (filter 0 / None on every scanline). */
export function encodePng(raster) {
  const { width, height, channels, data } = raster
  const colorType = CH_TO_COLORTYPE[channels]
  if (colorType === undefined) throw new Error(`unsupported channel count: ${channels}`)
  const stride = width * channels
  const filtered = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0 // filter type: None
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(filtered, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = colorType
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** Decode a PNG buffer to a raster { width, height, channels, data }. */
export function decodePng(buffer) {
  const buf = Buffer.from(buffer)
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG')
  let pos = 8
  let width = 0
  let height = 0
  let channels = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const bitDepth = data[8]
      const colorType = data[9]
      const interlace = data[12]
      if (bitDepth !== 8) throw new Error(`unsupported bit depth: ${bitDepth}`)
      if (interlace !== 0) throw new Error('interlaced PNG not supported')
      channels = COLORTYPE_TO_CH[colorType]
      if (!channels) throw new Error(`unsupported colour type: ${colorType}`)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = width * bpp
  const out = new Uint8Array(stride * height)
  let prev = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const rowStart = y * (stride + 1) + 1
    const cur = new Uint8Array(stride)
    for (let i = 0; i < stride; i++) {
      const rawByte = raw[rowStart + i]
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let val
      switch (filter) {
        case 0:
          val = rawByte
          break
        case 1:
          val = rawByte + a
          break
        case 2:
          val = rawByte + b
          break
        case 3:
          val = rawByte + ((a + b) >> 1)
          break
        case 4:
          val = rawByte + paeth(a, b, c)
          break
        default:
          throw new Error(`unsupported filter: ${filter}`)
      }
      cur[i] = val & 0xff
    }
    out.set(cur, y * stride)
    prev = cur
  }
  return { width, height, channels, data: out }
}
