// Build the blank default postcard back (see lib/postcards/defaults.ts) and,
// with --upload, publish it to the public postcard-designs bucket. The back is a
// plain white A6+bleed card (1819×1311 @ 300 DPI) that now carries the
// `housepost.co.uk/opt-out` compliance line, bottom-centre of the address half,
// exactly where the templates and uploaded backs draw it.
//
//   node scripts/upload-default-back.mjs                 # write back-blank.png locally to eyeball
//   node scripts/upload-default-back.mjs --out /tmp/x.png
//   node scripts/upload-default-back.mjs --upload        # replace the file in production (idempotent)
//
// Upload is OPT-IN so running the script can never overwrite production by
// accident. --upload needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import fs from 'node:fs'
import { GEOM, whiteRaster, stampOptOut, encodePng } from './lib/optout-png.mjs'

// White grayscale card, then stamp the opt-out grey into it.
const raster = stampOptOut(whiteRaster(GEOM.W, GEOM.H, 1))
const png = encodePng(raster)

const args = process.argv.slice(2)
const doUpload = args.includes('--upload')
const outIdx = args.indexOf('--out')
const outPath = outIdx !== -1 ? args[outIdx + 1] : 'back-blank.png'

if (!doUpload) {
  fs.writeFileSync(outPath, png)
  console.log(`wrote ${outPath} (${png.length} bytes, ${GEOM.W}x${GEOM.H}, grayscale, opt-out stamped)`)
  console.log('Not uploaded. Re-run with --upload to replace defaults/back-blank.png in production.')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('--upload needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { persistSession: false } })
const { error } = await admin.storage
  .from('postcard-designs')
  .upload('defaults/back-blank.png', png, { upsert: true, contentType: 'image/png', cacheControl: '31536000' })
if (error) {
  console.error('upload failed:', error.message)
  process.exit(1)
}
console.log(`uploaded defaults/back-blank.png (${png.length} bytes, ${GEOM.W}x${GEOM.H}, opt-out stamped)`)
