import { describe, it, expect } from 'vitest'
import { applyMapUpsertPolyfill } from '@/lib/polyfills/map-upsert'
import { MAP_UPSERT_POLYFILL } from '../../../scripts/copy-pdf-worker.mjs'

/** A Map-like class with no upsert methods, so the polyfill has something to do. */
class BareMap<K, V> {
  private m = new Map<K, V>()
  has(k: K) { return this.m.has(k) }
  get(k: K) { return this.m.get(k) }
  set(k: K, v: V) { this.m.set(k, v); return this }
}
type Upsert<K, V> = BareMap<K, V> & {
  getOrInsert: (k: K, v: V) => V
  getOrInsertComputed: (k: K, f: (k: K) => V) => V
}

function exercise(make: () => Upsert<string, number>, label: string) {
  describe(label, () => {
    it('getOrInsert returns the existing value or inserts the given one', () => {
      const m = make()
      expect(m.getOrInsert('a', 1)).toBe(1)
      expect(m.getOrInsert('a', 2)).toBe(1)
      expect(m.get('a')).toBe(1)
    })
    it('getOrInsertComputed only calls the callback on a miss', () => {
      const m = make()
      let calls = 0
      const f = (k: string) => { calls++; return k.length }
      expect(m.getOrInsertComputed('abc', f)).toBe(3)
      expect(m.getOrInsertComputed('abc', f)).toBe(3)
      expect(calls).toBe(1)
    })
  })
}

describe('map upsert polyfill', () => {
  it('leaves native methods alone when they exist', () => {
    // TS's lib doesn't know the ES2026 method yet, hence the cast.
    const proto = Map.prototype as unknown as { getOrInsertComputed?: unknown }
    const before = proto.getOrInsertComputed
    applyMapUpsertPolyfill()
    if (before) expect(proto.getOrInsertComputed).toBe(before)
    else expect(typeof proto.getOrInsertComputed).toBe('function')
  })

  // The worker string must patch a bare prototype exactly like the TS module does.
  exercise(() => {
    const proto = BareMap.prototype as unknown as { getOrInsert?: unknown }
    delete proto.getOrInsert
    delete (proto as { getOrInsertComputed?: unknown }).getOrInsertComputed
    // Run the worker snippet against BareMap instead of the real Map.
    new Function('Map', 'WeakMap', MAP_UPSERT_POLYFILL)(BareMap, BareMap)
    return new BareMap<string, number>() as Upsert<string, number>
  }, 'worker snippet (scripts/copy-pdf-worker.mjs)')
})
