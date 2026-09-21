import { describe, it, expect } from 'vitest'
import { historyReducer, initialHistory, type History } from '../useHistory'

type V = { a: string }
const h0: History<V> = initialHistory({ a: '' })

describe('historyReducer', () => {
  it('pushes the previous value onto past and clears future', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    expect(h1.present).toEqual({ a: 'x' })
    expect(h1.past).toEqual([{ a: '' }])
    expect(h1.future).toEqual([])
  })

  it('coalesces rapid edits to the same key into one undo step', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'a', at: 300 })
    expect(h2.past).toEqual([{ a: '' }])
    const h3 = historyReducer(h2, { type: 'undo' })
    expect(h3.present).toEqual({ a: '' })
  })

  it('does not coalesce edits to a different key, or after the window', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'b', at: 100 })
    expect(h2.past).toHaveLength(2)
    const h3 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'a', at: 5000 })
    expect(h3.past).toHaveLength(2)
  })

  it('undo/redo walk the stacks and set clears redo', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, at: 0 })
    const h2 = historyReducer(h1, { type: 'undo' })
    expect(h2.present).toEqual({ a: '' })
    expect(h2.future).toEqual([{ a: 'x' }])
    const h3 = historyReducer(h2, { type: 'redo' })
    expect(h3.present).toEqual({ a: 'x' })
    const h4 = historyReducer(historyReducer(h3, { type: 'undo' }), { type: 'set', value: { a: 'z' }, at: 9999 })
    expect(h4.future).toEqual([])
  })

  it('undo on empty past and redo on empty future are no-ops', () => {
    expect(historyReducer(h0, { type: 'undo' })).toBe(h0)
    expect(historyReducer(h0, { type: 'redo' })).toBe(h0)
  })

  it('caps past at 100 entries', () => {
    let h = h0
    for (let i = 0; i < 150; i++) h = historyReducer(h, { type: 'set', value: { a: String(i) }, at: i * 10000 })
    expect(h.past.length).toBe(100)
  })

  it('reset replaces everything', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, at: 0 })
    const h2 = historyReducer(h1, { type: 'reset', value: { a: 'fresh' } })
    expect(h2).toEqual(initialHistory({ a: 'fresh' }))
  })

  it('seal ends a coalesced run without adding a step', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'drag', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'drag', at: 100 })
    const h3 = historyReducer(h2, { type: 'seal' })
    expect(h3.past).toEqual([{ a: '' }])
    expect(h3.present).toEqual({ a: 'xy' })
    // The next edit with the same key starts a new step.
    const h4 = historyReducer(h3, { type: 'set', value: { a: 'xyz' }, key: 'drag', at: 200 })
    expect(h4.past).toEqual([{ a: '' }, { a: 'xy' }])
  })
})
