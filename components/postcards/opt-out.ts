// Single source of truth for the compliance opt-out line that EVERY postcard
// BACK must carry: `housepost.co.uk/opt-out`, sitting bottom-centre of the
// printer's address (right) half, inside Stannp's safe box.
//
// The SVG templates (svg-templates/templates.ts) draw this line directly in
// their markup; the uploaded-image backs, the uploaded print-ready PDF backs,
// the default blank back and the back-fill script all reproduce the SAME text
// at the SAME spot from the constants here. Keeping the geometry in one place is
// what makes the line land byte-position-identically however a back was made.
//
// The line is stamped in at CREATION time, in the browser — never by the
// send/billing pipeline. Nothing here touches Stannp, dispatch or the crons.

// The print canvas: A6 landscape + 3mm bleed at 300 DPI (11.811 px/mm).
const CARD_W = 1819
const CARD_H = 1311

/** The exact line the postcard back must carry. */
export const OPT_OUT_TEXT = 'housepost.co.uk/opt-out'

// Geometry as px on the 1819×1311 card. These match the historical template
// coords exactly: centre of the right/address half, baseline inside the 71px
// Stannp safe margin.
/** Centre x of the line: HALF (910) + HALF/2 (455). */
export const OPT_OUT_CX = 1365
/** Alphabetic baseline y: CARD_H − 86, so the 30px line clears the safe margin. */
export const OPT_OUT_BASELINE = 1225
/** Font size in px on the 300 DPI card. */
export const OPT_OUT_SIZE = 30
/** Mid-grey, so the line reads without competing with the design. */
export const OPT_OUT_COLOUR = '#666666'

// The same geometry as fractions of the card, so the line maps onto any canvas
// or PDF page whose pixel/point size differs from the 300 DPI reference (a
// print-ready PDF is measured in points, not pixels).
export const OPT_OUT_CX_FRAC = OPT_OUT_CX / CARD_W // ≈ 0.750412
export const OPT_OUT_BASELINE_FRAC = OPT_OUT_BASELINE / CARD_H // ≈ 0.934401
export const OPT_OUT_SIZE_FRAC = OPT_OUT_SIZE / CARD_H // ≈ 0.022883
/**
 * Distance of the baseline up from the BOTTOM edge, as a fraction. PDF pages use
 * a bottom-left origin (y up), so a PDF stamp measures the baseline from here.
 * Equals 86 / 1311.
 */
export const OPT_OUT_BASELINE_FROM_BOTTOM_FRAC = (CARD_H - OPT_OUT_BASELINE) / CARD_H

// The web-safe sans stack the templates render with, so a canvas-stamped line
// matches the template's Helvetica/Arial line rather than drifting to a
// different default face.
export const OPT_OUT_FONT_FAMILY = "'Helvetica Neue', Helvetica, Arial, sans-serif"

export interface OptOutPlacement {
  text: string
  /** Centre x in canvas px. */
  cx: number
  /** Alphabetic baseline y in canvas px. */
  baseline: number
  /** Font size in canvas px. */
  size: number
  colour: string
  fontFamily: string
}

/**
 * Resolve the opt-out geometry for a canvas of an arbitrary size. On the exact
 * 1819×1311 print canvas this returns the template's own coords (1365 / 1225 /
 * 30); on any other size it scales proportionally so the line stays in the same
 * relative spot.
 */
export function optOutPlacement(cardW: number, cardH: number): OptOutPlacement {
  return {
    text: OPT_OUT_TEXT,
    cx: cardW * OPT_OUT_CX_FRAC,
    baseline: cardH * OPT_OUT_BASELINE_FRAC,
    size: cardH * OPT_OUT_SIZE_FRAC,
    colour: OPT_OUT_COLOUR,
    fontFamily: OPT_OUT_FONT_FAMILY,
  }
}

/**
 * Draw the opt-out line onto a 2D canvas, centred in the right/address half at
 * the scaled baseline (mid-grey, sans-serif). Used by every in-browser back
 * that is composited on a canvas — the uploaded image backs and the default
 * blank back. Only ever called for the BACK, so the front stays untouched.
 */
export function drawOptOutOnCanvas(
  ctx: CanvasRenderingContext2D,
  cardW: number,
  cardH: number
): void {
  const p = optOutPlacement(cardW, cardH)
  ctx.save()
  ctx.fillStyle = p.colour
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${p.size}px ${p.fontFamily}`
  ctx.fillText(p.text, p.cx, p.baseline)
  ctx.restore()
}
