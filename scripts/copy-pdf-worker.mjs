// Copy the pdf.js worker out of node_modules into /public so the postcard design
// editor can load it from our own origin instead of a third-party CDN. Runs on
// dev + build (see package.json), so it always matches the installed pdfjs-dist
// version — no manual sync, no stale-worker version mismatch.
//
// The worker is prefixed with a polyfill for Map.prototype.getOrInsertComputed:
// pdf.js 5 uses it, and it only exists in Chrome 145+, Safari 18.4+ and 2026
// Firefox. The main thread applies the same polyfill from
// lib/polyfills/map-upsert.ts; the worker is a separate realm so it needs its
// own copy. The unit test in components/postcards/__tests__ keeps them in step.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const MAP_UPSERT_POLYFILL =
  '(function(){function a(P){' +
  'if(!P.getOrInsert){P.getOrInsert=function(k,v){if(this.has(k))return this.get(k);this.set(k,v);return v}}' +
  'if(!P.getOrInsertComputed){P.getOrInsertComputed=function(k,f){if(this.has(k))return this.get(k);var v=f(k);this.set(k,v);return v}}' +
  '}a(Map.prototype);a(WeakMap.prototype)})();'

export function copyPdfWorker() {
  const require = createRequire(import.meta.url)
  const src = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build/pdf.worker.min.mjs')
  const worker = readFileSync(src, 'utf8')
  writeFileSync('public/pdf.worker.min.mjs', MAP_UPSERT_POLYFILL + '\n' + worker)
  console.log('copied pdf.js worker (+ Map upsert polyfill) -> public/pdf.worker.min.mjs')
}

// Only copy when run as a script; the test imports the polyfill string.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) copyPdfWorker()
