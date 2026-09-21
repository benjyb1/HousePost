// The postcard templates, as pure SVG builders — a FRONT and a coordinating BACK
// for each design.
//
// PRINT SPEC: A6 landscape + 3mm bleed = 1819 × 1311 px @ 300 DPI. Every template
// draws at viewBox "0 0 1819 1311" so it rasterises to a true 300 DPI file.
// Important text is kept inside the bleed/safe margin so nothing critical is lost
// when the card is trimmed.
//
// The BACK reserves the RIGHT half for the address, postage and barcode the
// printer adds, so a back design only decorates the LEFT half; `backSvg` clips at
// the fold so the right half always stays white.
//
// The first four templates (Bold, Clean, Classic, Bright) are estate-agent
// styles; the rest span the other trades the tool serves — interior design,
// florist, builder, electrician, landscaper, cleaner, salon, bakery,
// photographer, professional services, fitness and joinery.
//
// All fonts are common web-safe stacks (no external fetch) so the live preview
// and the rasterised export render identically.

import {
  CARD_W,
  CARD_H,
  FONTS,
  darken,
  lighten,
  readableOn,
  normaliseHex,
  escapeXml as esc,
  fitSize,
  wrapText,
  initials,
} from './helpers'
import type { SvgTemplate, TemplateValues } from './types'

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">${inner}</svg>`
}

const USABLE = CARD_W - 180 // rough safe width for left-aligned heros

/* ------------------------------------------------------------------ */
/* 1. BOLD — high-impact "just sold" style, big accent band            */
/* ------------------------------------------------------------------ */
function renderBold(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const onA = readableOn(a)
  const offer = esc(v.offer.toUpperCase())
  const offerSize = fitSize(v.offer, USABLE, 200, 0.62)
  const nameSize = fitSize(v.businessName, USABLE, 112, 0.58)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${CARD_W}" height="712" fill="${a}"/>
    <rect x="0" y="712" width="${CARD_W}" height="20" fill="${darken(a, 0.22)}"/>
    <text x="92" y="168" font-family="${FONTS.sans}" font-weight="700" font-size="52" letter-spacing="12" fill="${onA}" opacity="0.82">${esc(
      v.areaServed.toUpperCase()
    )}</text>
    <text x="86" y="490" font-family="${FONTS.sans}" font-weight="900" font-size="${offerSize}" fill="${onA}">${offer}</text>
    <text x="90" y="940" font-family="${FONTS.sans}" font-weight="800" font-size="${nameSize}" fill="#0f172a">${esc(
      v.businessName
    )}</text>
    <text x="92" y="1025" font-family="${FONTS.sans}" font-weight="400" font-size="48" fill="#475569">${esc(
      v.tagline
    )}</text>
    <rect x="0" y="1171" width="${CARD_W}" height="140" fill="${a}"/>
    <text x="92" y="1258" font-family="${FONTS.sans}" font-weight="700" font-size="50" fill="${onA}">${esc(
      v.phone
    )}</text>
    <text x="1727" y="1258" text-anchor="end" font-family="${FONTS.sans}" font-weight="700" font-size="50" fill="${onA}">${esc(
      v.website
    )}</text>
  `)
}

/* ------------------------------------------------------------------ */
/* 2. CLEAN — minimal, airy, modern estate agent                       */
/* ------------------------------------------------------------------ */
function renderClean(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, USABLE, 120, 0.56)
  const offerSize = fitSize(v.offer, USABLE, 112, 0.58)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <rect x="92" y="150" width="140" height="14" fill="${a}"/>
    <text x="92" y="270" font-family="${FONTS.sans}" font-weight="600" font-size="46" letter-spacing="8" fill="#64748b">${esc(
      v.areaServed.toUpperCase()
    )}</text>
    <text x="90" y="450" font-family="${FONTS.sans}" font-weight="700" font-size="${nameSize}" fill="#0f172a">${esc(
      v.businessName
    )}</text>
    <text x="92" y="552" font-family="${FONTS.sans}" font-weight="400" font-size="50" fill="#64748b">${esc(
      v.tagline
    )}</text>
    <text x="90" y="850" font-family="${FONTS.sans}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
      v.offer
    )}</text>
    <line x1="92" y1="1000" x2="1727" y2="1000" stroke="#e2e8f0" stroke-width="3"/>
    <text x="92" y="1200" font-family="${FONTS.sans}" font-weight="600" font-size="48" fill="#334155">${esc(
      v.phone
    )}</text>
    <text x="1727" y="1200" text-anchor="end" font-family="${FONTS.sans}" font-weight="600" font-size="48" fill="#334155">${esc(
      v.website
    )}</text>
  `)
}

/* ------------------------------------------------------------------ */
/* 3. CLASSIC — traditional serif, framed, centred, premium            */
/* ------------------------------------------------------------------ */
function renderClassic(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1480, 132, 0.5)
  const offerSize = fitSize(v.offer, 1400, 80, 0.5)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#faf8f3"/>
    <rect x="58" y="58" width="${CARD_W - 116}" height="${CARD_H - 116}" fill="none" stroke="${a}" stroke-width="8"/>
    <rect x="92" y="92" width="${CARD_W - 184}" height="${CARD_H - 184}" fill="none" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="300" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="42" letter-spacing="8" fill="${a}">${esc(
      v.areaServed.toUpperCase()
    )}</text>
    <text x="${cx}" y="560" text-anchor="middle" font-family="${FONTS.serif}" font-weight="700" font-size="${nameSize}" fill="#1f2937">${esc(
      v.businessName
    )}</text>
    <line x1="${cx - 160}" y1="640" x2="${cx - 40}" y2="640" stroke="${a}" stroke-width="3"/>
    <circle cx="${cx}" cy="640" r="9" fill="${a}"/>
    <line x1="${cx + 40}" y1="640" x2="${cx + 160}" y2="640" stroke="${a}" stroke-width="3"/>
    <text x="${cx}" y="760" text-anchor="middle" font-family="${FONTS.serif}" font-style="italic" font-weight="400" font-size="52" fill="#4b5563">${esc(
      v.tagline
    )}</text>
    <text x="${cx}" y="960" text-anchor="middle" font-family="${FONTS.serif}" font-weight="600" font-size="${offerSize}" fill="${a}">${esc(
      v.offer
    )}</text>
    <text x="${cx}" y="1150" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="46" fill="#374151">${esc(
      v.phone
    )}${v.phone && v.website ? '&#160;&#160;|&#160;&#160;' : ''}${esc(v.website)}</text>
  `)
}

/* ------------------------------------------------------------------ */
/* 4. BRIGHT — friendly, rounded, accent background with a white card   */
/* ------------------------------------------------------------------ */
function renderBright(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const onA = readableOn(a)
  const tint = lighten(a, 0.18)
  const nameSize = fitSize(v.businessName, 1360, 120, 0.58)
  const offerSize = fitSize(v.offer, 1360, 104, 0.6)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${a}"/>
    <circle cx="1660" cy="150" r="260" fill="${tint}" opacity="0.55"/>
    <circle cx="120" cy="1220" r="200" fill="${tint}" opacity="0.45"/>
    <rect x="90" y="110" width="${CARD_W - 180}" height="${CARD_H - 220}" rx="56" fill="#ffffff"/>
    <text x="170" y="300" font-family="${FONTS.rounded}" font-weight="700" font-size="44" letter-spacing="6" fill="${darken(
      a,
      0.1
    )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="168" y="480" font-family="${FONTS.rounded}" font-weight="700" font-size="${nameSize}" fill="#0f172a">${esc(
      v.businessName
    )}</text>
    <text x="170" y="580" font-family="${FONTS.rounded}" font-weight="400" font-size="50" fill="#475569">${esc(
      v.tagline
    )}</text>
    <text x="168" y="820" font-family="${FONTS.rounded}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
      v.offer
    )}</text>
    <rect x="150" y="960" width="${CARD_W - 300}" height="150" rx="75" fill="${a}"/>
    <text x="210" y="1055" font-family="${FONTS.rounded}" font-weight="700" font-size="50" fill="${onA}">${esc(
      v.phone
    )}</text>
    <text x="1609" y="1055" text-anchor="end" font-family="${FONTS.rounded}" font-weight="700" font-size="50" fill="${onA}">${esc(
      v.website
    )}</text>
  `)
}

/* ================================================================== */
/* BACK side — shared scaffold                                        */
/*                                                                    */
/* On a posted card the printer prints the address, postage and       */
/* barcode over the RIGHT half, splitting dead on the centre line. So  */
/* a template back only decorates the LEFT half (0…HALF); the right    */
/* half is left white. Each back carries its own editable headline,    */
/* message and call to action (plus the shared brand and contact).     */
/* ================================================================== */
const HALF = Math.round(CARD_W / 2) // 910 — the centre fold; the address sits to its right
const BACK_M = 74 // safe margin inside the trimmed edges (≈3mm bleed + 3mm safe)
const BACK_W = HALF - BACK_M * 2 // usable width for left-aligned text in the design half
const BACK_CX = Math.round(HALF / 2) // horizontal centre of the design (left) half

/**
 * Wrap a back's left-half artwork on a full white card. The artwork is drawn
 * inside a nested SVG viewport that clips at the fold (x=HALF), so even a
 * pathologically long line can never spill into the right half where the
 * printer prints the address — the right half always stays white.
 */
/** Compliance line every back carries; sits in the printer's address half, bottom-centre, inside the safe box. */
const OPT_OUT_LINE = 'housepost.co.uk/opt-out'
const OPT_OUT_X = HALF + Math.round(HALF / 2) // centre of the right half (1365)
const OPT_OUT_Y = CARD_H - 86 // baseline; 30px text sits inside the 71px safe margin

function backSvg(leftHalf: string): string {
  return svg(
    `<rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>` +
      `<svg x="0" y="0" width="${HALF}" height="${CARD_H}" viewBox="0 0 ${HALF} ${CARD_H}" overflow="hidden">${leftHalf}</svg>` +
      `<text id="opt-out" x="${OPT_OUT_X}" y="${OPT_OUT_Y}" text-anchor="middle" font-family="${FONTS.sans}" font-weight="400" font-size="30" fill="#666666">${OPT_OUT_LINE}</text>`
  )
}

/** One <text> per wrapped line; `attrs` is everything after the coordinates. */
function rows(
  lines: string[],
  x: number,
  y: number,
  lineH: number,
  attrs: string,
  anchor: 'start' | 'middle' = 'start'
): string {
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * lineH}" text-anchor="${anchor}" ${attrs}>${esc(line)}</text>`
    )
    .join('')
}

/* 1. BOLD back — brand band, big headline, message, CTA, contact bar */
function renderBackBold(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const onA = readableOn(a)
  const brandSize = fitSize(v.businessName, HALF - 148, 60, 0.58)
  const headSize = fitSize(v.backHeadline, BACK_W, 92, 0.58)
  const ctaSize = fitSize(v.backCta, BACK_W, 56, 0.58)
  const msg = wrapText(v.backMessage, BACK_W, 44, 0.52, 5)
  const barHalf = (BACK_W - 40) / 2
  const phoneSize = fitSize(v.phone, barHalf, 46, 0.56)
  const webSize = fitSize(v.website, barHalf, 46, 0.5)
  return backSvg(`
    <rect x="0" y="0" width="${HALF}" height="170" fill="${a}"/>
    <rect x="0" y="170" width="${HALF}" height="14" fill="${darken(a, 0.22)}"/>
    <text x="${BACK_M}" y="116" font-family="${FONTS.sans}" font-weight="800" font-size="${brandSize}" letter-spacing="1" fill="${onA}">${esc(
      v.businessName
    )}</text>
    <text x="${BACK_M - 2}" y="360" font-family="${FONTS.sans}" font-weight="800" font-size="${headSize}" fill="#0f172a">${esc(
      v.backHeadline
    )}</text>
    ${rows(msg, BACK_M, 470, 60, `font-family="${FONTS.sans}" font-weight="400" font-size="44" fill="#475569"`)}
    <text x="${BACK_M - 2}" y="1095" font-family="${FONTS.sans}" font-weight="800" font-size="${ctaSize}" fill="${a}">${esc(
      v.backCta
    )}</text>
    <rect x="0" y="1171" width="${HALF}" height="140" fill="${a}"/>
    <text x="${BACK_M}" y="1258" font-family="${FONTS.sans}" font-weight="700" font-size="${phoneSize}" fill="${onA}">${esc(
      v.phone
    )}</text>
    <text x="${HALF - BACK_M}" y="1258" text-anchor="end" font-family="${FONTS.sans}" font-weight="700" font-size="${webSize}" fill="${onA}">${esc(
      v.website
    )}</text>
  `)
}

/* 2. CLEAN back — minimal, airy, hairline rule, stacked contact */
function renderBackClean(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const brandSize = fitSize(v.businessName, BACK_W, 44, 0.56)
  const headSize = fitSize(v.backHeadline, BACK_W, 88, 0.56)
  const ctaSize = fitSize(v.backCta, BACK_W - 60, 50, 0.56)
  const msg = wrapText(v.backMessage, BACK_W, 42, 0.52, 5)
  return backSvg(`
    <rect x="${BACK_M}" y="120" width="120" height="12" fill="${a}"/>
    <text x="${BACK_M}" y="210" font-family="${FONTS.sans}" font-weight="700" font-size="${brandSize}" fill="#0f172a">${esc(
      v.businessName
    )}</text>
    <text x="${BACK_M - 2}" y="360" font-family="${FONTS.sans}" font-weight="700" font-size="${headSize}" fill="#0f172a">${esc(
      v.backHeadline
    )}</text>
    ${rows(msg, BACK_M, 470, 58, `font-family="${FONTS.sans}" font-weight="400" font-size="42" fill="#64748b"`)}
    <text x="${BACK_M}" y="940" font-family="${FONTS.sans}" font-weight="700" font-size="${ctaSize}" fill="${a}">${esc(
      v.backCta
    )} &#8594;</text>
    <line x1="${BACK_M}" y1="1060" x2="${HALF - BACK_M}" y2="1060" stroke="#e2e8f0" stroke-width="3"/>
    <text x="${BACK_M}" y="1168" font-family="${FONTS.sans}" font-weight="600" font-size="42" fill="#334155">${esc(
      v.phone
    )}</text>
    <text x="${BACK_M}" y="1234" font-family="${FONTS.sans}" font-weight="400" font-size="40" fill="#64748b">${esc(
      v.website
    )}</text>
  `)
}

/* 3. CLASSIC back — cream half, framed, centred serif */
function renderBackClassic(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = BACK_CX
  const brand = v.businessName.toUpperCase()
  const brandSize = fitSize(brand, HALF - 260 - 4 * brand.length, 34, 0.62)
  const headSize = fitSize(v.backHeadline, HALF - 240, 74, 0.5)
  const ctaSize = fitSize(v.backCta, HALF - 260, 48, 0.5)
  const msg = wrapText(v.backMessage, HALF - 300, 40, 0.5, 5)
  return backSvg(`
    <rect x="0" y="0" width="${HALF}" height="${CARD_H}" fill="#faf8f3"/>
    <rect x="46" y="58" width="${HALF - 92}" height="${CARD_H - 116}" fill="none" stroke="${a}" stroke-width="6"/>
    <rect x="74" y="86" width="${HALF - 148}" height="${CARD_H - 172}" fill="none" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="280" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="${brandSize}" letter-spacing="4" fill="#1f2937">${esc(
      brand
    )}</text>
    <line x1="${cx - 120}" y1="342" x2="${cx - 28}" y2="342" stroke="${a}" stroke-width="2"/>
    <circle cx="${cx}" cy="342" r="7" fill="${a}"/>
    <line x1="${cx + 28}" y1="342" x2="${cx + 120}" y2="342" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="500" text-anchor="middle" font-family="${FONTS.serif}" font-weight="700" font-size="${headSize}" fill="#1f2937">${esc(
      v.backHeadline
    )}</text>
    ${rows(msg, cx, 620, 56, `font-family="${FONTS.serif}" font-style="italic" font-weight="400" font-size="40" fill="#4b5563"`, 'middle')}
    <text x="${cx}" y="1030" text-anchor="middle" font-family="${FONTS.serif}" font-weight="600" font-size="${ctaSize}" fill="${a}">${esc(
      v.backCta
    )}</text>
    <text x="${cx}" y="1150" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="38" fill="#374151">${esc(
      v.phone
    )}</text>
    <text x="${cx}" y="1206" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="34" fill="#374151">${esc(
      v.website
    )}</text>
  `)
}

/* 4. BRIGHT back — accent half with a rounded white card and a CTA pill */
function renderBackBright(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const onA = readableOn(a)
  const tint = lighten(a, 0.18)
  const cardX = 60
  const cardW = 800 // white card spans x 60…860 — inside the left half
  const brandSize = fitSize(v.businessName, cardW - 200, 46, 0.58)
  const headSize = fitSize(v.backHeadline, cardW - 200, 80, 0.58)
  const ctaSize = fitSize(v.backCta, cardW - 300, 46, 0.56)
  const msg = wrapText(v.backMessage, cardW - 200, 40, 0.54, 5)
  const pillCx = cardX + 80 + (cardW - 160) / 2
  const phoneSize = fitSize(v.phone, cardW - 240, 34, 0.56)
  const webSize = fitSize(v.website, cardW - 240, 30, 0.5)
  return backSvg(`
    <rect x="0" y="0" width="${HALF}" height="${CARD_H}" fill="${a}"/>
    <circle cx="690" cy="150" r="170" fill="${tint}" opacity="0.5"/>
    <circle cx="120" cy="1210" r="150" fill="${tint}" opacity="0.4"/>
    <rect x="${cardX}" y="110" width="${cardW}" height="${CARD_H - 220}" rx="52" fill="#ffffff"/>
    <text x="${cardX + 90}" y="250" font-family="${FONTS.rounded}" font-weight="700" font-size="${brandSize}" letter-spacing="2" fill="${darken(
      a,
      0.1
    )}">${esc(v.businessName)}</text>
    <text x="${cardX + 88}" y="380" font-family="${FONTS.rounded}" font-weight="700" font-size="${headSize}" fill="#0f172a">${esc(
      v.backHeadline
    )}</text>
    ${rows(msg, cardX + 90, 480, 54, `font-family="${FONTS.rounded}" font-weight="400" font-size="40" fill="#475569"`)}
    <rect x="${cardX + 80}" y="900" width="${cardW - 160}" height="150" rx="75" fill="${a}"/>
    <text x="${pillCx}" y="992" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="700" font-size="${ctaSize}" fill="${onA}">${esc(
      v.backCta
    )}</text>
    <text x="${pillCx}" y="1132" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="600" font-size="${phoneSize}" fill="#334155">${esc(
      v.phone
    )}</text>
    <text x="${pillCx}" y="1178" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="400" font-size="${webSize}" fill="#64748b">${esc(
      v.website
    )}</text>
  `)
}

/* ================================================================== */
/* TRADE templates — fronts, motifs and a shared themed back           */
/* ================================================================== */

// Front safe bounds for the trade designs.
const FL = 110
const FR = CARD_W - 110 // 1709

/* --- Motifs (pure, no filters, so they rasterise crisply) --------- */

/** A single leaf, tip up, rooted at (x,y) then rotated. */
function leaf(x: number, y: number, len: number, w: number, angle: number, color: string, opacity = 1): string {
  return `<path d="M0 0 C ${-w} ${-len * 0.35} ${-w} ${-len * 0.72} 0 ${-len} C ${w} ${-len * 0.72} ${w} ${
    -len * 0.35
  } 0 0 Z" fill="${color}" opacity="${opacity}" transform="translate(${x} ${y}) rotate(${angle})"/>`
}

/** A leafy sprig for florist / garden designs. */
function sprig(x: number, y: number, s: number, color: string, opacity = 0.9): string {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${opacity}">
    <path d="M0 0 C 12 -80 -8 -150 0 -230" stroke="${color}" stroke-width="6" fill="none"/>
    ${leaf(0, -60, 72, 26, -34, color)}${leaf(0, -60, 72, 26, 34, color)}
    ${leaf(0, -122, 64, 23, -30, color)}${leaf(0, -122, 64, 23, 30, color)}
    ${leaf(0, -182, 54, 19, -26, color)}${leaf(0, -182, 54, 19, 26, color)}
    ${leaf(0, -230, 44, 15, 0, color)}
  </g>`
}

/** A lightning bolt for electrical designs. */
function bolt(x: number, y: number, s: number, color: string, opacity = 1): string {
  return `<path transform="translate(${x} ${y}) scale(${s})" opacity="${opacity}" d="M112 0 L8 176 L86 176 L44 340 L196 132 L120 132 L172 0 Z" fill="${color}"/>`
}

/** A four-point sparkle for cleaning designs. */
function sparkle(x: number, y: number, r: number, color: string, opacity = 1): string {
  const a = r * 0.16
  return `<path transform="translate(${x} ${y})" opacity="${opacity}" d="M0 ${-r} Q ${a} ${-a} ${r} 0 Q ${a} ${a} 0 ${r} Q ${-a} ${a} ${-r} 0 Q ${-a} ${-a} 0 ${-r} Z" fill="${color}"/>`
}

/** A double-ring roundel with initials, for a traditional / established mark. */
function roundel(cx: number, cy: number, r: number, ring: string, ink: string, font: string, name: string): string {
  const mono = esc(initials(name) || '·')
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring}" stroke-width="5"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 16}" fill="none" stroke="${ring}" stroke-width="2"/>
    <text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-family="${font}" font-weight="700" font-size="${
    r * 0.9
  }" fill="${ink}">${mono}</text>
  </g>`
}

/* --- Shared themed back for the trade designs --------------------- */

interface BackOpts {
  /** Left-half background; omit for white. */
  bg?: string
  ink: string
  sub: string
  accent: string
  font: string
  serif?: boolean
  /** Extra SVG drawn behind the text (a motif, panel or frame). */
  motif?: string
}

/** Brand + editable headline/message/CTA + contact, styled per template. */
function themedBack(v: TemplateValues, o: BackOpts): string {
  const a = normaliseHex(o.accent)
  // Conservative glyph factors so a heading shrinks before it reaches the fold —
  // serif/bold faces render wider than a naive 0.5 estimate assumes.
  const f = o.serif ? 0.6 : 0.58
  const brandSize = fitSize(v.businessName, BACK_W, 46, f)
  const headSize = fitSize(v.backHeadline, BACK_W, 86, f)
  const ctaSize = fitSize(v.backCta, BACK_W, 50, f)
  const msg = wrapText(v.backMessage, BACK_W, 40, 0.52, 5)
  return backSvg(`
    ${o.bg ? `<rect x="0" y="0" width="${HALF}" height="${CARD_H}" fill="${o.bg}"/>` : ''}
    ${o.motif ?? ''}
    <text x="${BACK_M}" y="178" font-family="${o.font}" font-weight="700" font-size="${brandSize}" fill="${o.ink}">${esc(
    v.businessName
  )}</text>
    <rect x="${BACK_M}" y="214" width="74" height="8" fill="${a}"/>
    <text x="${BACK_M - 2}" y="404" font-family="${o.font}" font-weight="${o.serif ? 700 : 800}" font-size="${headSize}" fill="${o.ink}">${esc(
    v.backHeadline
  )}</text>
    ${rows(msg, BACK_M, 504, 56, `font-family="${o.font}" font-weight="400" font-size="40" fill="${o.sub}"`)}
    <text x="${BACK_M - 2}" y="1052" font-family="${o.font}" font-weight="700" font-size="${ctaSize}" fill="${a}">${esc(
    v.backCta
  )}</text>
    <line x1="${BACK_M}" y1="1114" x2="${HALF - BACK_M}" y2="1114" stroke="${a}" stroke-width="2" opacity="0.55"/>
    <text x="${BACK_M}" y="1198" font-family="${o.font}" font-weight="700" font-size="${fitSize(
    v.phone,
    BACK_W,
    42,
    0.56
  )}" fill="${o.ink}">${esc(v.phone)}</text>
    <text x="${BACK_M}" y="1252" font-family="${o.font}" font-weight="400" font-size="${fitSize(
    v.website,
    BACK_W,
    38,
    0.6
  )}" fill="${o.sub}">${esc(v.website)}</text>
  `)
}

/* 5. ATELIER — interior design: editorial, calm, refined ----------- */
function frontAtelier(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1540, 156, 0.58)
  const offerSize = fitSize(v.offer, 1300, 52, 0.5)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#f6f4ef"/>
    <text x="${FL}" y="215" font-family="${FONTS.elegantSerif}" font-weight="600" font-size="34" letter-spacing="12" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <line x1="${FL}" y1="255" x2="${FL + 360}" y2="255" stroke="${a}" stroke-width="2"/>
    <text x="${FL}" y="675" font-family="${FONTS.elegantSerif}" font-weight="600" font-size="${nameSize}" fill="#2b2723">${esc(
    v.businessName
  )}</text>
    <text x="${FL + 4}" y="760" font-family="${FONTS.elegantSerif}" font-style="italic" font-weight="400" font-size="48" fill="#6b6259">${esc(
    v.tagline
  )}</text>
    <text x="${FL}" y="930" font-family="${FONTS.elegantSerif}" font-weight="400" font-size="${offerSize}" fill="${a}">${esc(
    v.offer
  )}</text>
    <line x1="${FL}" y1="1150" x2="${FR}" y2="1150" stroke="#d8d2c7" stroke-width="2"/>
    <text x="${FL}" y="1238" font-family="${FONTS.elegantSerif}" font-weight="400" font-size="40" fill="#3f3a34">${esc(
    v.phone
  )}</text>
    <text x="${FR}" y="1238" text-anchor="end" font-family="${FONTS.elegantSerif}" font-weight="400" font-size="40" fill="#3f3a34">${esc(
    v.website
  )}</text>
  `)
}
function backAtelier(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#f6f4ef',
    ink: '#2b2723',
    sub: '#6b6259',
    accent: a,
    font: FONTS.elegantSerif,
    serif: true,
    motif: `<rect x="54" y="54" width="${HALF - 108}" height="${CARD_H - 108}" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>`,
  })
}

/* 6. BLOOM — florist: soft, botanical ------------------------------ */
function frontBloom(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1360, 150, 0.5)
  const offerSize = fitSize(v.offer, 1240, 50, 0.52)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#fbf1f2"/>
    ${sprig(210, 360, 1.5, a, 0.85)}${sprig(CARD_W - 210, 360, 1.5, a, 0.85)}
    <text x="${cx}" y="300" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-weight="600" font-size="34" letter-spacing="10" fill="${darken(
    a,
    0.15
  )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="${cx}" y="600" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-weight="700" font-size="${nameSize}" fill="#4a3b3f">${esc(
    v.businessName
  )}</text>
    <text x="${cx}" y="695" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-style="italic" font-weight="400" font-size="48" fill="#8a6f74">${esc(
    v.tagline
  )}</text>
    <text x="${cx}" y="850" text-anchor="middle" font-family="${FONTS.sans}" font-weight="600" font-size="${offerSize}" fill="${darken(
    a,
    0.12
  )}">${esc(v.offer)}</text>
    <rect x="${cx - 450}" y="1085" width="900" height="118" rx="59" fill="${a}"/>
    <text x="${cx}" y="1160" text-anchor="middle" font-family="${FONTS.sans}" font-weight="700" font-size="42" fill="${readableOn(
    a
  )}">${esc(v.phone)}${v.phone && v.website ? '&#160;&#160;·&#160;&#160;' : ''}${esc(v.website)}</text>
  `)
}
function backBloom(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#fbf1f2',
    ink: '#4a3b3f',
    sub: '#8a6f74',
    accent: a,
    font: FONTS.elegantSerif,
    serif: true,
    motif: sprig(806, 300, 0.92, a, 0.8),
  })
}

/* 7. FOUNDRY — builder: industrial charcoal + amber ---------------- */
function frontFoundry(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const ink = '#1e2227'
  const offerSize = fitSize(v.offer, 1420, 150, 0.6)
  const nameSize = fitSize(v.businessName, 1360, 96, 0.6)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${ink}"/>
    <rect x="0" y="0" width="34" height="${CARD_H}" fill="${a}"/>
    <polygon points="${CARD_W},0 ${CARD_W},240 ${CARD_W - 240},0" fill="${a}"/>
    <text x="${FL}" y="235" font-family="${FONTS.mono}" font-weight="700" font-size="34" letter-spacing="6" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="${FL}" y="560" font-family="${FONTS.sans}" font-weight="900" font-size="${offerSize}" fill="#ffffff">${esc(
    v.offer.toUpperCase()
  )}</text>
    <rect x="${FL}" y="620" width="360" height="12" fill="${a}"/>
    <text x="${FL}" y="900" font-family="${FONTS.sans}" font-weight="800" font-size="${nameSize}" fill="#ffffff">${esc(
    v.businessName
  )}</text>
    <text x="${FL}" y="975" font-family="${FONTS.sans}" font-weight="400" font-size="42" fill="#a9b0b8">${esc(
    v.tagline
  )}</text>
    <rect x="0" y="1120" width="${CARD_W}" height="191" fill="${a}"/>
    <text x="${FL}" y="1245" font-family="${FONTS.sans}" font-weight="800" font-size="50" fill="${ink}">${esc(
    v.phone
  )}</text>
    <text x="${FR}" y="1245" text-anchor="end" font-family="${FONTS.sans}" font-weight="800" font-size="50" fill="${ink}">${esc(
    v.website
  )}</text>
  `)
}
function backFoundry(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#1e2227',
    ink: '#ffffff',
    sub: '#a9b0b8',
    accent: a,
    font: FONTS.sans,
    motif: `<rect x="0" y="0" width="20" height="${CARD_H}" fill="${a}"/><polygon points="0,0 190,0 0,190" fill="${a}" opacity="0.9"/>`,
  })
}

/* 8. SPARK — electrician: navy + electric yellow, bolt ------------- */
function frontSpark(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const ink = '#0f1f3a'
  const nameSize = fitSize(v.businessName, 1180, 118, 0.56)
  const offerSize = fitSize(v.offer, 1180, 96, 0.58)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${ink}"/>
    <polygon points="${CARD_W},0 ${CARD_W},${CARD_H} ${CARD_W - 620},${CARD_H} ${CARD_W - 430},0" fill="${darken(
    ink,
    0.35
  )}"/>
    ${bolt(CARD_W - 430, 470, 1.5, a, 1)}
    <text x="${FL}" y="235" font-family="${FONTS.geometric}" font-weight="700" font-size="36" letter-spacing="8" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="${FL}" y="500" font-family="${FONTS.geometric}" font-weight="700" font-size="${nameSize}" fill="#ffffff">${esc(
    v.businessName
  )}</text>
    <text x="${FL}" y="585" font-family="${FONTS.geometric}" font-weight="400" font-size="44" fill="#9fb3d1">${esc(
    v.tagline
  )}</text>
    <text x="${FL}" y="835" font-family="${FONTS.geometric}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
    v.offer.toUpperCase()
  )}</text>
    <rect x="${FL}" y="1120" width="1120" height="120" rx="16" fill="${a}"/>
    <text x="${FL + 44}" y="1198" font-family="${FONTS.geometric}" font-weight="700" font-size="48" fill="${ink}">${esc(
    v.phone
  )}</text>
    <text x="${FL + 1076}" y="1198" text-anchor="end" font-family="${FONTS.geometric}" font-weight="700" font-size="44" fill="${ink}">${esc(
    v.website
  )}</text>
  `)
}
function backSpark(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#0f1f3a',
    ink: '#ffffff',
    sub: '#9fb3d1',
    accent: a,
    font: FONTS.geometric,
    motif: bolt(720, 772, 0.72, a, 0.85),
  })
}

/* 9. MEADOW — landscaper: layered green hills ---------------------- */
function frontMeadow(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1500, 138, 0.56)
  const offerSize = fitSize(v.offer, 1300, 52, 0.54)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#f4f8f1"/>
    <path d="M0 980 Q 500 880 1000 960 T ${CARD_W} 940 L ${CARD_W} ${CARD_H} L 0 ${CARD_H} Z" fill="${lighten(
    a,
    0.35
  )}"/>
    <path d="M0 1070 Q 560 980 1120 1055 T ${CARD_W} 1040 L ${CARD_W} ${CARD_H} L 0 ${CARD_H} Z" fill="${lighten(
    a,
    0.1
  )}"/>
    <path d="M0 1170 Q 520 1110 1080 1165 T ${CARD_W} 1160 L ${CARD_W} ${CARD_H} L 0 ${CARD_H} Z" fill="${a}"/>
    <text x="${FL}" y="240" font-family="${FONTS.rounded}" font-weight="700" font-size="34" letter-spacing="8" fill="${darken(
    a,
    0.12
  )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="${FL}" y="470" font-family="${FONTS.rounded}" font-weight="700" font-size="${nameSize}" fill="#22331f">${esc(
    v.businessName
  )}</text>
    <text x="${FL}" y="560" font-family="${FONTS.rounded}" font-weight="400" font-size="46" fill="#4d6047">${esc(
    v.tagline
  )}</text>
    <text x="${FL}" y="740" font-family="${FONTS.rounded}" font-weight="700" font-size="${offerSize}" fill="${darken(
    a,
    0.18
  )}">${esc(v.offer)}</text>
    <text x="${FL}" y="1235" font-family="${FONTS.rounded}" font-weight="700" font-size="46" fill="${readableOn(
    a
  )}">${esc(v.phone)}</text>
    <text x="${FR}" y="1235" text-anchor="end" font-family="${FONTS.rounded}" font-weight="700" font-size="44" fill="${readableOn(
    a
  )}">${esc(v.website)}</text>
  `)
}
function backMeadow(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    ink: '#22331f',
    sub: '#4d6047',
    accent: a,
    font: FONTS.rounded,
    motif: `<path d="M0 0 H${HALF} V80 Q640 130 380 90 T0 100 Z" fill="${lighten(a, 0.3)}"/>`,
  })
}

/* 10. FRESH — cleaner: bright aqua, bubbles, sparkle --------------- */
function frontFresh(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1440, 132, 0.56)
  const offerSize = fitSize(v.offer, 1280, 60, 0.56)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <circle cx="1590" cy="250" r="240" fill="${lighten(a, 0.55)}"/>
    <circle cx="1720" cy="520" r="120" fill="${lighten(a, 0.4)}"/>
    <circle cx="1470" cy="470" r="70" fill="${lighten(a, 0.3)}"/>
    ${sparkle(1560, 250, 96, '#ffffff', 0.95)}${sparkle(1690, 190, 40, a, 0.9)}
    <text x="${FL}" y="245" font-family="${FONTS.rounded}" font-weight="700" font-size="34" letter-spacing="8" fill="${darken(
    a,
    0.15
  )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="${FL}" y="500" font-family="${FONTS.rounded}" font-weight="700" font-size="${nameSize}" fill="#123b41">${esc(
    v.businessName
  )}</text>
    <text x="${FL}" y="590" font-family="${FONTS.rounded}" font-weight="400" font-size="46" fill="#4a6d72">${esc(
    v.tagline
  )}</text>
    <text x="${FL}" y="800" font-family="${FONTS.rounded}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
    v.offer
  )}</text>
    <rect x="${FL}" y="1105" width="1180" height="126" rx="63" fill="${a}"/>
    <text x="${FL + 50}" y="1186" font-family="${FONTS.rounded}" font-weight="700" font-size="48" fill="${readableOn(
    a
  )}">${esc(v.phone)}</text>
    <text x="${FL + 1130}" y="1186" text-anchor="end" font-family="${FONTS.rounded}" font-weight="700" font-size="44" fill="${readableOn(
    a
  )}">${esc(v.website)}</text>
  `)
}
function backFresh(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    ink: '#123b41',
    sub: '#4a6d72',
    accent: a,
    font: FONTS.rounded,
    motif: `<circle cx="840" cy="180" r="100" fill="${lighten(a, 0.5)}"/><circle cx="900" cy="300" r="50" fill="${lighten(
      a,
      0.35
    )}"/>${sparkle(824, 180, 44, '#ffffff', 0.95)}`,
  })
}

/* 11. VOGUE — salon & beauty: dark, luxe, gold --------------------- */
function frontVogue(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const bg = '#141414'
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1420, 150, 0.5)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${bg}"/>
    <rect x="70" y="70" width="${CARD_W - 140}" height="${CARD_H - 140}" fill="none" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="320" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-weight="600" font-size="34" letter-spacing="16" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="${cx}" y="620" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-weight="700" font-size="${nameSize}" fill="#f5f1ea">${esc(
    v.businessName
  )}</text>
    <line x1="${cx - 130}" y1="700" x2="${cx + 130}" y2="700" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="800" text-anchor="middle" font-family="${FONTS.elegantSerif}" font-style="italic" font-weight="400" font-size="46" fill="#c9c2b6">${esc(
    v.tagline
  )}</text>
    <text x="${cx}" y="960" text-anchor="middle" font-family="${FONTS.sans}" font-weight="600" font-size="42" letter-spacing="4" fill="${a}">${esc(
    v.offer.toUpperCase()
  )}</text>
    <text x="${cx}" y="1180" text-anchor="middle" font-family="${FONTS.sans}" font-weight="400" font-size="40" letter-spacing="3" fill="#f5f1ea">${esc(
    v.phone
  )}${v.phone && v.website ? '&#160;&#160;·&#160;&#160;' : ''}${esc(v.website)}</text>
  `)
}
function backVogue(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#141414',
    ink: '#f5f1ea',
    sub: '#c9c2b6',
    accent: a,
    font: FONTS.elegantSerif,
    serif: true,
    motif: `<rect x="54" y="54" width="${HALF - 108}" height="${CARD_H - 108}" fill="none" stroke="${a}" stroke-width="2"/>`,
  })
}

/* 12. CRUST — bakery & café: warm cream + terracotta, scallop ------ */
function frontCrust(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1360, 146, 0.52)
  const offerSize = fitSize(v.offer, 1240, 50, 0.52)
  let scallop = ''
  const rad = 46
  for (let x = rad; x < CARD_W; x += rad * 2) scallop += `<circle cx="${x}" cy="0" r="${rad}" fill="${a}"/>`
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#f4e9d3"/>
    <rect x="0" y="0" width="${CARD_W}" height="30" fill="${a}"/>
    ${scallop}
    <text x="${cx}" y="330" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="700" font-size="34" letter-spacing="8" fill="${darken(
    a,
    0.1
  )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="${cx}" y="590" text-anchor="middle" font-family="${FONTS.serif}" font-weight="700" font-size="${nameSize}" fill="#5a3822">${esc(
    v.businessName
  )}</text>
    <text x="${cx}" y="680" text-anchor="middle" font-family="${FONTS.serif}" font-style="italic" font-weight="400" font-size="48" fill="#8a6a4a">${esc(
    v.tagline
  )}</text>
    <text x="${cx}" y="860" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
    v.offer
  )}</text>
    <text x="${cx}" y="1200" text-anchor="middle" font-family="${FONTS.rounded}" font-weight="700" font-size="46" fill="#5a3822">${esc(
    v.phone
  )}${v.phone && v.website ? '&#160;&#160;·&#160;&#160;' : ''}${esc(v.website)}</text>
  `)
}
function backCrust(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  let scallop = ''
  const rad = 40
  for (let x = rad; x < HALF; x += rad * 2) scallop += `<circle cx="${x}" cy="0" r="${rad}" fill="${a}"/>`
  return themedBack(v, {
    bg: '#f4e9d3',
    ink: '#5a3822',
    sub: '#8a6a4a',
    accent: a,
    font: FONTS.serif,
    serif: true,
    motif: scallop,
  })
}

/* 13. FRAME — photographer & creative: gallery mat ----------------- */
function frontFrame(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const ink = '#16161a'
  const nameSize = fitSize(v.businessName, 1360, 140, 0.54)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <rect x="46" y="46" width="${CARD_W - 92}" height="${CARD_H - 92}" fill="none" stroke="${ink}" stroke-width="10"/>
    <rect x="120" y="120" width="150" height="14" fill="${a}"/>
    <text x="130" y="250" font-family="${FONTS.geometric}" font-weight="700" font-size="32" letter-spacing="10" fill="#6b6b72">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="126" y="620" font-family="${FONTS.geometric}" font-weight="700" font-size="${nameSize}" fill="${ink}">${esc(
    v.businessName
  )}</text>
    <text x="130" y="710" font-family="${FONTS.geometric}" font-weight="400" font-size="46" fill="#5b5b62">${esc(
    v.tagline
  )}</text>
    <text x="130" y="900" font-family="${FONTS.geometric}" font-weight="700" font-size="${fitSize(
    v.offer,
    1300,
    52,
    0.54
  )}" fill="${a}">${esc(v.offer)}</text>
    <line x1="130" y1="1120" x2="${CARD_W - 130}" y2="1120" stroke="#e3e3e6" stroke-width="3"/>
    <text x="130" y="1210" font-family="${FONTS.geometric}" font-weight="700" font-size="42" fill="${ink}">${esc(
    v.phone
  )}</text>
    <text x="${CARD_W - 130}" y="1210" text-anchor="end" font-family="${FONTS.geometric}" font-weight="400" font-size="42" fill="#5b5b62">${esc(
    v.website
  )}</text>
  `)
}
function backFrame(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    ink: '#16161a',
    sub: '#5b5b62',
    accent: a,
    font: FONTS.geometric,
    motif: `<rect x="46" y="46" width="${HALF - 92}" height="${CARD_H - 92}" fill="none" stroke="#16161a" stroke-width="8"/>`,
  })
}

/* 14. LEDGER — professional services: structured navy grid --------- */
function frontLedger(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1360, 104, 0.55)
  const offerSize = fitSize(v.offer, 1300, 64, 0.55)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${CARD_W}" height="360" fill="${a}"/>
    <text x="${FL}" y="185" font-family="${FONTS.geometric}" font-weight="700" font-size="34" letter-spacing="6" fill="${lighten(
    a,
    0.7
  )}">${esc(v.areaServed.toUpperCase())}</text>
    <text x="${FL}" y="290" font-family="${FONTS.geometric}" font-weight="700" font-size="${nameSize}" fill="#ffffff">${esc(
    v.businessName
  )}</text>
    <text x="${FL}" y="510" font-family="${FONTS.geometric}" font-weight="400" font-size="46" fill="#44566a">${esc(
    v.tagline
  )}</text>
    <line x1="${FL}" y1="590" x2="${FR}" y2="590" stroke="#e2e8f0" stroke-width="3"/>
    <text x="${FL}" y="770" font-family="${FONTS.geometric}" font-weight="700" font-size="${offerSize}" fill="${a}">${esc(
    v.offer
  )}</text>
    <rect x="${FL}" y="1075" width="18" height="120" fill="${a}"/>
    <text x="${FL + 48}" y="1130" font-family="${FONTS.geometric}" font-weight="700" font-size="44" fill="#1f2937">${esc(
    v.phone
  )}</text>
    <text x="${FL + 48}" y="1195" font-family="${FONTS.geometric}" font-weight="400" font-size="40" fill="#44566a">${esc(
    v.website
  )}</text>
  `)
}
function backLedger(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: a,
    ink: '#ffffff',
    sub: lighten(a, 0.6),
    accent: '#ffffff',
    font: FONTS.geometric,
  })
}

/* 15. PULSE — fitness & PT: dark with a neon slash ----------------- */
function frontPulse(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const bg = '#141416'
  const nameSize = fitSize(v.businessName, 1240, 138, 0.6)
  const offerSize = fitSize(v.offer, 1240, 116, 0.6)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${bg}"/>
    <polygon points="0,0 300,0 130,${CARD_H} 0,${CARD_H}" fill="${a}"/>
    <polygon points="300,0 360,0 190,${CARD_H} 130,${CARD_H}" fill="${a}" opacity="0.35"/>
    <text x="440" y="250" font-family="${FONTS.sans}" font-weight="700" font-style="italic" font-size="36" letter-spacing="6" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="436" y="520" font-family="${FONTS.sans}" font-weight="900" font-style="italic" font-size="${nameSize}" fill="#ffffff">${esc(
    v.businessName.toUpperCase()
  )}</text>
    <text x="440" y="600" font-family="${FONTS.sans}" font-weight="400" font-size="44" fill="#9a9aa2">${esc(
    v.tagline
  )}</text>
    <text x="436" y="820" font-family="${FONTS.sans}" font-weight="900" font-style="italic" font-size="${offerSize}" fill="${a}">${esc(
    v.offer.toUpperCase()
  )}</text>
    <text x="440" y="1200" font-family="${FONTS.sans}" font-weight="700" font-size="46" fill="#ffffff">${esc(
    v.phone
  )}</text>
    <text x="${FR}" y="1200" text-anchor="end" font-family="${FONTS.sans}" font-weight="700" font-size="44" fill="${a}">${esc(
    v.website
  )}</text>
  `)
}
function backPulse(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#141416',
    ink: '#ffffff',
    sub: '#9a9aa2',
    accent: a,
    font: FONTS.sans,
    motif: `<polygon points="0,0 72,0 26,${CARD_H} 0,${CARD_H}" fill="${a}"/>`,
  })
}

/* 16. HERITAGE — joinery & trades: green, gold, roundel ------------ */
function frontHeritage(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const bg = '#23382f'
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1360, 130, 0.5)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="${bg}"/>
    <rect x="64" y="64" width="${CARD_W - 128}" height="${CARD_H - 128}" fill="none" stroke="${a}" stroke-width="3"/>
    ${roundel(cx, 300, 120, a, a, FONTS.serif, v.businessName)}
    <text x="${cx}" y="620" text-anchor="middle" font-family="${FONTS.serif}" font-weight="700" font-size="${nameSize}" fill="#f3ead4">${esc(
    v.businessName
  )}</text>
    <text x="${cx}" y="705" text-anchor="middle" font-family="${FONTS.serif}" font-style="italic" font-weight="400" font-size="46" fill="${lighten(
    a,
    0.25
  )}">${esc(v.tagline)}</text>
    <line x1="${cx - 200}" y1="800" x2="${cx + 200}" y2="800" stroke="${a}" stroke-width="2"/>
    <text x="${cx}" y="915" text-anchor="middle" font-family="${FONTS.serif}" font-weight="600" font-size="${fitSize(
    v.offer,
    1200,
    50,
    0.5
  )}" fill="#f3ead4">${esc(v.offer)}</text>
    <text x="${cx}" y="1190" text-anchor="middle" font-family="${FONTS.serif}" font-weight="400" font-size="42" fill="${lighten(
    a,
    0.2
  )}">${esc(v.phone)}${v.phone && v.website ? '&#160;&#160;·&#160;&#160;' : ''}${esc(v.website)}</text>
  `)
}
function backHeritage(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  return themedBack(v, {
    bg: '#23382f',
    ink: '#f3ead4',
    sub: lighten(a, 0.25),
    accent: a,
    font: FONTS.serif,
    serif: true,
    motif: `<rect x="54" y="54" width="${HALF - 108}" height="${CARD_H - 108}" fill="none" stroke="${a}" stroke-width="2"/>${roundel(
      792,
      252,
      60,
      a,
      a,
      FONTS.serif,
      v.businessName
    )}`,
  })
}

export const SVG_TEMPLATES: SvgTemplate[] = [
  {
    id: 'bold',
    name: 'Bold',
    description: 'High-impact accent band and a big headline — great for "just sold" drops.',
    defaults: {
      businessName: 'Harbour & Vale',
      tagline: 'Estate agents you can trust',
      offer: 'JUST SOLD NEARBY',
      areaServed: 'Kingston & Surbiton',
      phone: '020 1234 5678',
      website: 'harbourvale.co.uk',
      accent: '#c02b3a',
      backHeadline: 'Just sold on your street',
      backMessage:
        'We recently sold a home near you. Curious what yours could fetch in today’s market? We’ll tell you, free.',
      backCta: 'Book your free valuation',
    },
    render: renderBold,
    renderBack: renderBackBold,
  },
  {
    id: 'clean',
    name: 'Clean',
    description: 'Minimal, airy and modern. Lets your name and offer breathe.',
    defaults: {
      businessName: 'Meridian Homes',
      tagline: 'Local property experts',
      offer: 'Free valuation this month',
      areaServed: 'Richmond upon Thames',
      phone: '020 8765 4321',
      website: 'www.meridianhomes.co.uk',
      accent: '#0f766e',
      backHeadline: 'Thinking of selling?',
      backMessage:
        'A quick, honest valuation from a local team that knows your area. No pressure and no obligation.',
      backCta: 'Arrange your free valuation',
    },
    render: renderClean,
    renderBack: renderBackClean,
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional serif in a framed layout — trustworthy and premium.',
    defaults: {
      businessName: 'Ashworth & Co.',
      tagline: 'Selling fine homes since 1998',
      offer: 'Book your free market appraisal',
      areaServed: 'Established · Wimbledon Village',
      phone: '020 3456 7890',
      website: 'ashworthandco.co.uk',
      accent: '#1e3a5f',
      backHeadline: 'A considered move',
      backMessage:
        'For over twenty years we have guided local homeowners through their next move with care and discretion.',
      backCta: 'Request a market appraisal',
    },
    render: renderClassic,
    renderBack: renderBackClassic,
  },
  {
    id: 'bright',
    name: 'Bright',
    description: 'Friendly and rounded with a bold colour panel — warm and approachable.',
    defaults: {
      businessName: 'Sunnyside Move',
      tagline: 'Making your next move easy',
      offer: 'Thinking of selling?',
      areaServed: 'Twickenham & Teddington',
      phone: '020 2468 1357',
      website: 'sunnysidemove.co.uk',
      accent: '#f97316',
      backHeadline: 'Let’s get you moving',
      backMessage:
        'Friendly, straight-talking advice and a free valuation whenever you are ready. We would love to help.',
      backCta: 'Get your free valuation',
    },
    render: renderBright,
    renderBack: renderBackBright,
  },
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Editorial, calm and refined — made for interior designers and studios.',
    defaults: {
      businessName: 'Studio Larch',
      tagline: 'Interior design & styling',
      offer: 'Now taking projects for spring',
      areaServed: 'Cotswolds & Oxford',
      phone: '01865 224 118',
      website: 'studiolarch.co.uk',
      accent: '#9c8466',
      backHeadline: 'Let’s design your space',
      backMessage:
        'Thoughtful interiors for real life — considered, calm and made to last. Book a consultation and we’ll take it from there.',
      backCta: 'Arrange a consultation',
    },
    render: frontAtelier,
    renderBack: backAtelier,
  },
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Soft and botanical, with a hand-drawn sprig — lovely for florists.',
    defaults: {
      businessName: 'Fig & Fern',
      tagline: 'Seasonal flowers, grown with care',
      offer: 'Weddings & weekly bouquets',
      areaServed: 'Bath & Bradford-on-Avon',
      phone: '01225 447 902',
      website: 'figandfern.co.uk',
      accent: '#86a06b',
      backHeadline: 'Flowers for every moment',
      backMessage:
        'Seasonal bouquets, wedding flowers and weekly arrangements, grown and made with care. Order online or pop in.',
      backCta: 'Order your flowers',
    },
    render: frontBloom,
    renderBack: backBloom,
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Bold industrial charcoal and amber — built for builders and trades.',
    defaults: {
      businessName: 'Kingsworth Build',
      tagline: 'Extensions · renovations · groundwork',
      offer: 'Free site visit & quote',
      areaServed: 'Surrey & SW London',
      phone: '020 8123 4567',
      website: 'kingsworthbuild.co.uk',
      accent: '#f5a623',
      backHeadline: 'Built properly, first time',
      backMessage:
        'Extensions, renovations and groundwork done to a high standard, on time and on budget. Get a free site visit and quote.',
      backCta: 'Book your free quote',
    },
    render: frontFoundry,
    renderBack: backFoundry,
  },
  {
    id: 'spark',
    name: 'Spark',
    description: 'High-voltage navy and yellow with a bolt — sharp for electricians.',
    defaults: {
      businessName: 'Voltway Electrical',
      tagline: 'NICEIC approved · fully insured',
      offer: '24/7 call-outs',
      areaServed: 'Reading & Wokingham',
      phone: '0118 950 7788',
      website: 'voltway.co.uk',
      accent: '#ffd21e',
      backHeadline: 'Need an electrician?',
      backMessage:
        'Fully qualified and insured, for everything from a single socket to a full rewire. Fast, tidy and reliable.',
      backCta: 'Call for a free quote',
    },
    render: frontSpark,
    renderBack: backSpark,
  },
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Layered green landscape — a natural fit for gardeners and landscapers.',
    defaults: {
      businessName: 'Rowan & Reed',
      tagline: 'Garden design & landscaping',
      offer: 'Book your spring garden now',
      areaServed: 'Guildford & the Surrey Hills',
      phone: '01483 556 210',
      website: 'rowanandreed.co.uk',
      accent: '#4f8a4f',
      backHeadline: 'Love your garden again',
      backMessage:
        'Garden design, planting and landscaping that suits how you live outdoors. Book now for the spring season.',
      backCta: 'Book your garden visit',
    },
    render: frontMeadow,
    renderBack: backMeadow,
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Bright, bubbly and spotless — clean and friendly for cleaning services.',
    defaults: {
      businessName: 'Brightwork Cleaning',
      tagline: 'Homes & offices, sparkling',
      offer: 'First clean 20% off',
      areaServed: 'Bristol & Clifton',
      phone: '0117 244 9081',
      website: 'brightwork.co.uk',
      accent: '#21b8cf',
      backHeadline: 'A cleaner you can trust',
      backMessage:
        'Reliable, thorough cleaning for homes and offices, with the same friendly face each time. First clean 20% off.',
      backCta: 'Book your first clean',
    },
    render: frontFresh,
    renderBack: backFresh,
  },
  {
    id: 'vogue',
    name: 'Vogue',
    description: 'Dark, luxe and fashion-led — chic for salons and beauty.',
    defaults: {
      businessName: 'Maison Noir',
      tagline: 'Hair · colour · styling',
      offer: 'New clients — 15% off',
      areaServed: 'Marylebone, London',
      phone: '020 7123 8890',
      website: 'maisonnoir.co.uk',
      accent: '#c9a24b',
      backHeadline: 'Book your next look',
      backMessage:
        'Expert cuts, colour and styling in a relaxed, welcoming studio. New clients get 15% off their first visit.',
      backCta: 'Book an appointment',
    },
    render: frontVogue,
    renderBack: backVogue,
  },
  {
    id: 'crust',
    name: 'Crust',
    description: 'Warm cream and terracotta with a scalloped edge — inviting for bakeries and cafés.',
    defaults: {
      businessName: 'Poppy & Rye',
      tagline: 'Freshly baked, every morning',
      offer: 'Order your celebration cake',
      areaServed: 'Stroud & Nailsworth',
      phone: '01453 700 214',
      website: 'poppyandrye.co.uk',
      accent: '#c0632f',
      backHeadline: 'Freshly baked, every day',
      backMessage:
        'Real bread, pastries and celebration cakes made from scratch each morning. Order ahead or drop by.',
      backCta: 'Order your cake',
    },
    render: frontCrust,
    renderBack: backCrust,
  },
  {
    id: 'frame',
    name: 'Frame',
    description: 'Gallery-minimal with a bold border — for photographers and creatives.',
    defaults: {
      businessName: 'North Light Studio',
      tagline: 'Portrait & wedding photography',
      offer: 'Spring portrait sessions open',
      areaServed: 'Edinburgh & the Lothians',
      phone: '0131 556 0042',
      website: 'northlight.studio',
      accent: '#d98a4e',
      backHeadline: 'Let’s make something beautiful',
      backMessage:
        'Portraits, weddings and family sessions with a natural, unfussy style. Spring dates are open now.',
      backCta: 'Book a session',
    },
    render: frontFrame,
    renderBack: backFrame,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Structured and corporate navy — trustworthy for professional services.',
    defaults: {
      businessName: 'Hartley & Finch',
      tagline: 'Accountants for small business',
      offer: 'Free first consultation',
      areaServed: 'Manchester & Salford',
      phone: '0161 300 4477',
      website: 'hartleyfinch.co.uk',
      accent: '#1b3a5b',
      backHeadline: 'Accounts, sorted',
      backMessage:
        'Straightforward accountancy and tax for small businesses and the self-employed. Your first consultation is free.',
      backCta: 'Book a free chat',
    },
    render: frontLedger,
    renderBack: backLedger,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Dark with a neon slash — energetic for gyms and personal trainers.',
    defaults: {
      businessName: 'Iron & Oak',
      tagline: 'Personal training studio',
      offer: '2 sessions free this month',
      areaServed: 'Leeds city centre',
      phone: '0113 400 2211',
      website: 'ironandoak.fit',
      accent: '#c6f24e',
      backHeadline: 'Stronger starts here',
      backMessage:
        'Personal training built around your goals, in a friendly studio that gets results. Two sessions free this month.',
      backCta: 'Claim your free sessions',
    },
    render: frontPulse,
    renderBack: backPulse,
  },
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Traditional roundel and gold on deep green — an established feel for joiners and makers.',
    defaults: {
      businessName: 'Ashcombe Joinery',
      tagline: 'Bespoke carpentry since 1979',
      offer: 'Handmade kitchens & staircases',
      areaServed: 'Est. Hampshire',
      phone: '01962 880 340',
      website: 'ashcombejoinery.co.uk',
      accent: '#cba35a',
      backHeadline: 'Made by hand, made to last',
      backMessage:
        'Bespoke kitchens, staircases and fitted furniture, built by craftsmen in solid timber and made to your measure.',
      backCta: 'Request a quote',
    },
    render: frontHeritage,
    renderBack: backHeritage,
  },
]

export function getTemplate(id: string): SvgTemplate | undefined {
  return SVG_TEMPLATES.find((t) => t.id === id)
}
