// Back-fill the opt-out line onto EXISTING uploaded backs already in the
// postcard-designs bucket (`<userId>/design-back.png`). For each PNG it decodes
// the image, stamps `housepost.co.uk/opt-out` at the fixed spot (idempotent —
// re-running writes the same grey pixels), and re-uploads.
//
//   node scripts/backfill-optout.mjs            # DRY RUN — lists what it would do, writes nothing
//   node scripts/backfill-optout.mjs --commit   # actually re-uploads the stamped PNGs
//
// DO NOT RUN THIS WITHOUT REVIEW — it mutates every user's back artwork. It is
// deliberately dry-run by default. Needs NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment.
//
// Scope + caveats:
//  - PNG backs only. `design-back.pdf` (passthrough) backs are LOGGED as
//    skipped-for-manual — stamp those with pdf-lib (as the uploader now does) or
//    re-save them through the app.
//  - Unsupported PNG variants (interlaced / 16-bit / palette) are logged as
//    skipped-for-manual rather than corrupted.
//  - Re-uploading reuses the same object key, but each user's stored design URL
//    keeps its old `?v=…` cache-buster, so a CDN may serve the pre-stamp bytes
//    until the object's cache TTL lapses. Confirm Stannp fetches the fresh bytes
//    at send time (or bump the version) after a real run.
import { GEOM, decodePng, stampOptOut, encodePng } from './lib/optout-png.mjs'

const commit = process.argv.includes('--commit')
const BUCKET = 'postcard-designs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(url, key, { auth: { persistSession: false } })

/** List every entry under a prefix, following pagination. */
async function listAll(prefix) {
  const out = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: pageSize, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

const stats = { stamped: 0, skippedPdf: 0, skippedUnsupported: 0, errors: 0 }

// Top-level entries are per-user folders (folder rows have a null `id`), plus
// the `defaults` folder which we leave alone.
const top = await listAll('')
const userFolders = top.filter((e) => !e.id && e.name !== 'defaults').map((e) => e.name)
console.log(`${commit ? 'COMMIT' : 'DRY RUN'} — scanning ${userFolders.length} user folder(s) in ${BUCKET}`)

for (const userId of userFolders) {
  let entries
  try {
    entries = await listAll(userId)
  } catch (err) {
    console.error(`  ${userId}: list failed — ${err.message}`)
    stats.errors++
    continue
  }
  const hasPng = entries.some((e) => e.name === 'design-back.png')
  const hasPdf = entries.some((e) => e.name === 'design-back.pdf')

  if (hasPdf) {
    console.log(`  ${userId}/design-back.pdf — SKIP (PDF, stamp with pdf-lib or re-save in app)`)
    stats.skippedPdf++
  }
  if (!hasPng) continue

  const path = `${userId}/design-back.png`
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(path)
    if (error) throw error
    const buf = Buffer.from(await data.arrayBuffer())
    let raster
    try {
      raster = decodePng(buf)
    } catch (decodeErr) {
      console.log(`  ${path} — SKIP (unsupported PNG: ${decodeErr.message})`)
      stats.skippedUnsupported++
      continue
    }
    if (raster.width !== GEOM.W || raster.height !== GEOM.H) {
      console.log(`  ${path} — note: ${raster.width}x${raster.height}, stamping at fixed 1819×1311 geometry anyway`)
    }
    stampOptOut(raster)
    const stamped = encodePng(raster)
    if (commit) {
      const up = await admin.storage
        .from(BUCKET)
        .upload(path, stamped, { upsert: true, contentType: 'image/png' })
      if (up.error) throw up.error
      console.log(`  ${path} — stamped + re-uploaded (${stamped.length} bytes)`)
    } else {
      console.log(`  ${path} — would stamp + re-upload (${stamped.length} bytes)`)
    }
    stats.stamped++
  } catch (err) {
    console.error(`  ${path} — ERROR ${err.message}`)
    stats.errors++
  }
}

console.log(
  `\nDone. ${commit ? 'Stamped' : 'Would stamp'}: ${stats.stamped}` +
    ` · PDFs skipped (manual): ${stats.skippedPdf}` +
    ` · unsupported PNGs skipped: ${stats.skippedUnsupported}` +
    ` · errors: ${stats.errors}`
)
if (!commit) console.log('DRY RUN — nothing was written. Re-run with --commit after review.')
