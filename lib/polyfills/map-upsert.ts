/**
 * Polyfill for the ES2026 Map/WeakMap "upsert" methods, getOrInsert and
 * getOrInsertComputed. pdf.js 5 calls getOrInsertComputed, and the method only
 * shipped in Chrome 145 (January 2026), Safari 18.4 and Firefox later in 2026,
 * so on anything older every PDF render throws before it starts.
 *
 * The pdf.js worker runs in its own thread, so scripts/copy-pdf-worker.mjs
 * prepends the same logic (as a string) to the worker file it copies into
 * /public. Keep the two in step; the unit test checks they behave the same.
 */
type Upsertable = {
  has: (k: unknown) => boolean
  get: (k: unknown) => unknown
  set: (k: unknown, v: unknown) => unknown
  getOrInsert?: (k: unknown, v: unknown) => unknown
  getOrInsertComputed?: (k: unknown, f: (k: unknown) => unknown) => unknown
}

function patch(proto: Upsertable) {
  if (!proto.getOrInsert) {
    proto.getOrInsert = function (this: Upsertable, key, value) {
      if (this.has(key)) return this.get(key)
      this.set(key, value)
      return value
    }
  }
  if (!proto.getOrInsertComputed) {
    proto.getOrInsertComputed = function (this: Upsertable, key, compute) {
      if (this.has(key)) return this.get(key)
      const value = compute(key)
      this.set(key, value)
      return value
    }
  }
}

/** Apply the polyfill in the current realm. Safe to call more than once. */
export function applyMapUpsertPolyfill(): void {
  patch(Map.prototype as unknown as Upsertable)
  patch(WeakMap.prototype as unknown as Upsertable)
}
