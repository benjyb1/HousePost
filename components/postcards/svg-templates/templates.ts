// The postcard front templates, as pure SVG builders.
//
// PRINT SPEC: A6 landscape + 3mm bleed = 1819 × 1311 px @ 300 DPI.
// Every template draws at viewBox "0 0 1819 1311" so it rasterises to a true
// 300 DPI file. Important text is kept ~50px inside the edges (the bleed/safe
// margin) so nothing critical is lost when the card is trimmed.
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
/* BACK side                                                          */
/*                                                                    */
/* On a posted card the printer prints the address, postage and       */
/* barcode over the RIGHT half, splitting dead on the centre line. So  */
/* a template back only decorates the LEFT half (0…HALF); the right    */
/* half is left white. That is exactly the full card the uploader      */
/* composites for an uploaded back, so the send/proof pipeline treats  */
/* a template back like any other. Each back carries its own editable  */
/* headline, message and call to action (plus the shared brand and     */
/* contact), styled to match its front so the two sides read as one.    */
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
function backSvg(leftHalf: string): string {
  return svg(
    `<rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>` +
      `<svg x="0" y="0" width="${HALF}" height="${CARD_H}" viewBox="0 0 ${HALF} ${CARD_H}" overflow="hidden">${leftHalf}</svg>`
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
  // Phone and website share the bottom bar, so cap each to its own half — a long
  // website then shrinks rather than colliding with the phone.
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
]

export function getTemplate(id: string): SvgTemplate | undefined {
  return SVG_TEMPLATES.find((t) => t.id === id)
}
