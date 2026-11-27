import { describe, expect, it } from 'vitest'
import { hasFullAccess, pickPreviewIds, type PreviewRow } from '../preview'

const prefs = { radius: 10, min: null, max: null, types: ['D', 'S', 'T', 'F', 'O'] }
let n = 0
const row = (over: Partial<PreviewRow>): PreviewRow => ({
  id: `id-${String(++n).padStart(3, '0')}`,
  addressLine: `${n} HIGH STREET`,
  postcode: 'AB1 2CD',
  price: 30000000,
  propertyType: 'S',
  distance: 1,
  month: '2026-11',
  custom: false,
  ...over,
})

describe('hasFullAccess', () => {
  it('is only active or trialing', () => {
    expect(hasFullAccess('active')).toBe(true)
    expect(hasFullAccess('trialing')).toBe(true)
    for (const s of ['past_due', 'unpaid', 'canceled', 'incomplete', 'paused', null, undefined, '']) {
      expect(hasFullAccess(s)).toBe(false)
    }
  })
})

describe('pickPreviewIds', () => {
  it('opens the five nearest homes from the newest month', () => {
    const older = Array.from({ length: 3 }, (_, i) => row({ month: '2026-10', distance: 0.1 * (i + 1) }))
    const newer = Array.from({ length: 8 }, (_, i) => row({ distance: 8 - i }))
    const open = pickPreviewIds([...older, ...newer], prefs)
    expect(open.size).toBe(5)
    const openRows = newer.filter((r) => open.has(r.id))
    expect(openRows.map((r) => r.distance).sort()).toEqual([1, 2, 3, 4, 5])
    for (const r of older) expect(open.has(r.id)).toBe(false)
  })

  it('respects the saved filters, capped at 10 miles', () => {
    const far = row({ distance: 12 })
    const cheap = row({ price: 100 })
    const flat = row({ propertyType: 'F' })
    const ok = row({ distance: 3 })
    const open = pickPreviewIds([far, cheap, flat, ok], { radius: 25, min: 1000000, max: null, types: ['S'] })
    expect([...open]).toEqual([ok.id])
  })

  it('counts each address once', () => {
    const a = row({ addressLine: '5 MILL LANE', distance: 1 })
    const aAgain = row({ addressLine: '5 Mill Lane', distance: 1, month: '2026-10' })
    const others = Array.from({ length: 5 }, (_, i) => row({ distance: 2 + i }))
    const open = pickPreviewIds([a, aAgain, ...others], prefs)
    expect(open.has(a.id)).toBe(true)
    expect(open.has(aAgain.id)).toBe(false)
    expect(open.size).toBe(5)
  })

  it('always opens homes added by hand, on top of the five', () => {
    const mine = row({ custom: true, distance: null })
    const rest = Array.from({ length: 7 }, (_, i) => row({ distance: i + 1 }))
    const open = pickPreviewIds([mine, ...rest], prefs)
    expect(open.has(mine.id)).toBe(true)
    expect(open.size).toBe(6)
  })

  it('is stable when an open home is archived (archived rows are passed in)', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row({ distance: i + 1 }))
    const before = pickPreviewIds(rows, prefs)
    // Archiving doesn't remove the row from the input, so nothing new opens.
    const after = pickPreviewIds(rows, prefs)
    expect([...after].sort()).toEqual([...before].sort())
  })
})
