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
    },
    render: renderBold,
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
    },
    render: renderClean,
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
    },
    render: renderClassic,
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
    },
    render: renderBright,
  },
]

export function getTemplate(id: string): SvgTemplate | undefined {
  return SVG_TEMPLATES.find((t) => t.id === id)
}
