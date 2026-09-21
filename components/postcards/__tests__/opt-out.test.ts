import { describe, it, expect } from 'vitest'
import {
  OPT_OUT_TEXT,
  OPT_OUT_CX,
  OPT_OUT_BASELINE,
  OPT_OUT_SIZE,
  OPT_OUT_COLOUR,
  OPT_OUT_FONT_FAMILY,
  optOutPlacement,
  drawOptOutOnCanvas,
} from '../opt-out'
import { SVG_TEMPLATES } from '../svg-templates/templates'

// The print reference canvas: A6 landscape + 3mm bleed at 300 DPI.
const CARD_W = 1819
const CARD_H = 1311

/**
 * A minimal fake 2D context that records the one fillText call and the style it
 * was drawn with. Lets us assert where the opt-out lands without a real canvas.
 */
function recordingCtx() {
  const calls: { text: string; x: number; y: number }[] = []
  const state = { fillStyle: '', textAlign: '', textBaseline: '', font: '' }
  let saved = 0
  const ctx = {
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(v: string) {
      state.fillStyle = v
    },
    set textAlign(v: string) {
      state.textAlign = v
    },
    get textAlign() {
      return state.textAlign
    },
    set textBaseline(v: string) {
      state.textBaseline = v
    },
    get textBaseline() {
      return state.textBaseline
    },
    set font(v: string) {
      state.font = v
    },
    get font() {
      return state.font
    },
    save() {
      saved++
    },
    restore() {
      saved--
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ text, x, y })
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state, saveDepth: () => saved }
}

describe('optOutPlacement geometry', () => {
  it('returns the template coords on the exact 300 DPI print canvas', () => {
    const p = optOutPlacement(CARD_W, CARD_H)
    expect(p.text).toBe(OPT_OUT_TEXT)
    expect(p.cx).toBeCloseTo(OPT_OUT_CX, 6) // 1365
    expect(p.baseline).toBeCloseTo(OPT_OUT_BASELINE, 6) // 1225
    expect(p.size).toBeCloseTo(OPT_OUT_SIZE, 6) // 30
    expect(p.colour).toBe(OPT_OUT_COLOUR)
    expect(p.fontFamily).toBe(OPT_OUT_FONT_FAMILY)
  })

  it('scales centre, baseline and size for a non-300 DPI canvas', () => {
    // Double-resolution canvas (same aspect ratio): everything doubles.
    const p = optOutPlacement(CARD_W * 2, CARD_H * 2)
    expect(p.cx).toBeCloseTo(OPT_OUT_CX * 2, 6) // 2730
    expect(p.baseline).toBeCloseTo(OPT_OUT_BASELINE * 2, 6) // 2450
    expect(p.size).toBeCloseTo(OPT_OUT_SIZE * 2, 6) // 60
  })

  it('keeps the line in the right (address) half and above the bottom edge', () => {
    const p = optOutPlacement(CARD_W, CARD_H)
    expect(p.cx).toBeGreaterThan(CARD_W / 2) // right of the fold (910)
    expect(p.baseline).toBeLessThan(CARD_H) // above the bottom edge
    expect(CARD_H - p.baseline).toBeGreaterThan(CARD_H / 25.4) // ≥ ~1mm of clearance
  })
})

describe('drawOptOutOnCanvas', () => {
  it('draws the opt-out once, centred, mid-grey, on the print canvas', () => {
    const { ctx, calls, state, saveDepth } = recordingCtx()
    drawOptOutOnCanvas(ctx, CARD_W, CARD_H)
    expect(calls).toHaveLength(1)
    expect(calls[0].text).toBe(OPT_OUT_TEXT)
    expect(calls[0].x).toBeCloseTo(OPT_OUT_CX, 6)
    expect(calls[0].y).toBeCloseTo(OPT_OUT_BASELINE, 6)
    // Style: centred, alphabetic baseline, mid-grey, sized in px.
    expect(state.textAlign).toBe('center')
    expect(state.textBaseline).toBe('alphabetic')
    expect(state.fillStyle).toBe(OPT_OUT_COLOUR)
    expect(state.font).toContain(`${OPT_OUT_SIZE}px`)
    // Left ctx state balanced (save/restore paired).
    expect(saveDepth()).toBe(0)
  })

  it('scales the draw for a non-300 DPI canvas', () => {
    const { ctx, calls } = recordingCtx()
    drawOptOutOnCanvas(ctx, CARD_W * 2, CARD_H * 2)
    expect(calls[0].x).toBeCloseTo(OPT_OUT_CX * 2, 6)
    expect(calls[0].y).toBeCloseTo(OPT_OUT_BASELINE * 2, 6)
  })
})

describe('template back opt-out (byte-identity + same spot as the canvas stamp)', () => {
  // Exactly the element templates.ts drew before the refactor to the shared
  // module. If this string ever changes, the rendered back is no longer
  // byte-for-byte the same and the assertion fails.
  const expectedElement =
    `<text id="opt-out" x="1365" y="1225" text-anchor="middle" ` +
    `font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" ` +
    `font-weight="400" font-size="30" fill="#666666">housepost.co.uk/opt-out</text>`

  it('every template back carries exactly one opt-out, byte-identical', () => {
    for (const tpl of SVG_TEMPLATES) {
      const back = tpl.renderBack(tpl.defaults)
      const matches = back.match(/id="opt-out"/g) ?? []
      expect(matches).toHaveLength(1)
      expect(back).toContain(expectedElement)
    }
  })

  it('the template SVG coords equal where drawOptOutOnCanvas stamps the upload back', () => {
    // The template draws the line at x=1365 / y=1225 in SVG user units on the
    // 1819×1311 card. An uploaded image back is composited onto a 1819×1311
    // canvas and stamped by drawOptOutOnCanvas — which must land on the SAME
    // spot, so a template back and an upload back are indistinguishable here.
    const { ctx, calls } = recordingCtx()
    drawOptOutOnCanvas(ctx, CARD_W, CARD_H)
    expect(calls[0].x).toBeCloseTo(OPT_OUT_CX, 6)
    expect(calls[0].y).toBeCloseTo(OPT_OUT_BASELINE, 6)
    // And those are the very numbers hard-baked into the template element above.
    expect(expectedElement).toContain(`x="${OPT_OUT_CX}"`)
    expect(expectedElement).toContain(`y="${OPT_OUT_BASELINE}"`)
  })
})
