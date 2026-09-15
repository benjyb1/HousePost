// One-off: upload the blank default postcard back to the public
// postcard-designs bucket (see lib/postcards/defaults.ts). Idempotent.
//   node scripts/upload-default-back.mjs
import { createClient } from '@supabase/supabase-js'
import zlib from 'node:zlib'

const W = 1819, H = 1311 // A6 landscape + 3mm bleed at 300 DPI
function crc(buf) { let c = ~0; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) } return ~c >>> 0 }
function chunk(type, data) { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cc]) }
const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(W, 255)]) // grey8, filter 0, white
const raw = Buffer.concat(Array.from({ length: H }, () => row))
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { error } = await admin.storage.from('postcard-designs').upload('defaults/back-blank.png', png, { upsert: true, contentType: 'image/png', cacheControl: '31536000' })
if (error) { console.error('upload failed:', error.message); process.exit(1) }
console.log(`uploaded defaults/back-blank.png (${png.length} bytes, ${W}x${H})`)
