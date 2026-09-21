import { describe, it, expect } from 'vitest'
import { clampOverlay, defaultPlacement, type LogoOverlay } from '../logo/types'
import { injectOverlay } from '../logo/inject'

const png = 'data:image/png;base64,AAAA'
const base: LogoOverlay = { side: 'front', src: png, naturalW: 400, naturalH: 200, x: 0, y: 0, w: 400 }

describe('defaultPlacement', () => {
  it('drops a front logo top-right inside the safe box at 360px wide', () => {
    const o = defaultPlacement('front', png, 400, 200)
    expect(o.w).toBe(360)
    expect(o.x).toBe(1819 - 71 - 360)
    expect(o.y).toBe(71)
  })
  it('drops a back logo top-right of the LEFT half', () => {
    const o = defaultPlacement('back', png, 400, 200)
    expect(o.x + o.w).toBeLessThanOrEqual(840)
  })
})

describe('clampOverlay', () => {
  it('keeps the box inside the safe area on the front', () => {
    const o = clampOverlay({ ...base, x: -50, y: 2000, w: 400 })
    expect(o.x).toBe(71)
    expect(o.y).toBe(1311 - 71 - 200)
  })
  it('keeps a back logo left of the fold safe edge', () => {
    const o = clampOverlay({ ...base, side: 'back', x: 700, w: 400 })
    expect(o.x + o.w).toBeLessThanOrEqual(840)
  })
  it('enforces min and max width, preserving aspect', () => {
    expect(clampOverlay({ ...base, w: 10 }).w).toBe(80)
    const o = clampOverlay({ ...base, w: 5000 })
    expect(o.w).toBe(1819 - 2 * 71)
  })
})

describe('injectOverlay', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1819" height="1311" viewBox="0 0 1819 1311"><rect/></svg>'
  it('appends an <image> before the closing tag on the front', () => {
    const out = injectOverlay(svg, base)
    expect(out.endsWith('</svg>')).toBe(true)
    expect(out).toContain('<image ')
    expect(out).toContain('width="400" height="200"')
    expect(out).toContain(`href="${png}"`)
  })
  it('wraps a back overlay in the left-half clip', () => {
    const out = injectOverlay(svg, { ...base, side: 'back' })
    expect(out).toContain('viewBox="0 0 910 1311" overflow="hidden"><image')
  })
  it('returns the svg unchanged with no overlay', () => {
    expect(injectOverlay(svg, null)).toBe(svg)
  })
  it('escapes quotes in src so markup cannot break out', () => {
    const out = injectOverlay(svg, { ...base, src: 'data:x" onload="alert(1)' })
    expect(out).not.toContain('onload="alert')
  })
})
