// The postcard templates, as pure SVG builders — a FRONT and a coordinating BACK
// for each design.
//
// PRINT SPEC: A6 landscape + 3mm bleed = 1819 × 1311 px @ 300 DPI. Every template
// draws at viewBox "0 0 1819 1311" so it rasterises to a true 300 DPI file.
// Important text is kept ~110px inside the edges (the bleed/safe margin) so
// nothing critical is lost when the card is trimmed.
//
// The BACK reserves the RIGHT HALF for the address, postage and barcode the
// printer adds, so a back design only occupies the LEFT half. `back()` paints the
// right half clean white last, as a guarantee.
//
// All fonts are common web-safe stacks (no external fetch) so the live preview and
// the rasterised export render from the exact same string.

import {
  CARD_W,
  CARD_H,
  HALF_W,
  FONTS,
  darken,
  lighten,
  readableOn,
  normaliseHex,
  escapeXml as esc,
  fitSize,
  initials,
} from './helpers'
import type { SvgTemplate, TemplateValues } from './types'

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">${inner}</svg>`
}

// Front safe bounds.
const FL = 110 // left
const FR = CARD_W - 110 // right (1709)

// Back safe bounds (left half only).
const BL = 120
const BR = 830
const BW = BR - BL

/* ---------------------------------------------------------------- */
/* Shared back layout                                               */
/* ---------------------------------------------------------------- */

interface BackOpts {
  /** Left-half background; omit for white. */
  bg?: string
  ink: string
  sub: string
  accent: string
  font: string
  /** Extra SVG drawn behind the text (a motif, panel, etc.). */
  motif?: string
  serif?: boolean
}

/** A calm, coordinated back: name + tagline up top, contact at the foot. */
function backBody(v: TemplateValues, o: BackOpts): string {
  const a = normaliseHex(o.accent)
  const nameSize = fitSize(v.businessName, BW, 88, o.serif ? 0.5 : 0.55)
  const factor = o.serif ? 0.5 : 0.55
  return `
    ${o.bg ? `<rect x="0" y="0" width="${HALF_W}" height="${CARD_H}" fill="${o.bg}"/>` : ''}
    ${o.motif ?? ''}
    <rect x="${BL}" y="250" width="86" height="10" fill="${a}"/>
    <text x="${BL}" y="400" font-family="${o.font}" font-weight="700" font-size="${nameSize}" fill="${o.ink}">${esc(
    v.businessName
  )}</text>
    <text x="${BL}" y="470" font-family="${o.font}" font-weight="400" font-size="38" fill="${o.sub}">${esc(
    v.tagline
  )}</text>
    <line x1="${BL}" y1="560" x2="${BR}" y2="560" stroke="${a}" stroke-width="2" opacity="0.55"/>
    <text x="${BL}" y="1000" font-family="${o.font}" font-weight="700" font-size="28" letter-spacing="4" fill="${a}">${esc(
    v.areaServed.toUpperCase()
  )}</text>
    <text x="${BL}" y="1082" font-family="${o.font}" font-weight="700" font-size="${fitSize(
    v.phone,
    BW,
    46,
    factor
  )}" fill="${o.ink}">${esc(v.phone)}</text>
    <text x="${BL}" y="1146" font-family="${o.font}" font-weight="400" font-size="${fitSize(
    v.website,
    BW,
    42,
    factor
  )}" fill="${o.sub}">${esc(v.website)}</text>
  `
}

/** Wrap back content: white card, the design, then a clean white right half. */
function back(inner: string): string {
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    ${inner}
    <rect x="${HALF_W}" y="0" width="${CARD_W - HALF_W}" height="${CARD_H}" fill="#ffffff"/>
  `)
}

/* ---------------------------------------------------------------- */
/* Motifs                                                           */
/* ---------------------------------------------------------------- */

/** A single leaf, tip pointing up, rooted at (x,y) then rotated. */
function leaf(x: number, y: number, len: number, w: number, angle: number, color: string, opacity = 1): string {
  return `<path d="M0 0 C ${-w} ${-len * 0.35} ${-w} ${-len * 0.72} 0 ${-len} C ${w} ${-len * 0.72} ${w} ${
    -len * 0.35
  } 0 0 Z" fill="${color}" opacity="${opacity}" transform="translate(${x} ${y}) rotate(${angle})"/>`
}

/** A little leafy sprig for florist / garden designs. */
function sprig(x: number, y: number, s: number, color: string, opacity = 0.9): string {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${opacity}">
    <path d="M0 0 C 12 -80 -8 -150 0 -230" stroke="${color}" stroke-width="6" fill="none"/>
    ${leaf(0, -60, 72, 26, -34, color)}
    ${leaf(0, -60, 72, 26, 34, color)}
    ${leaf(0, -122, 64, 23, -30, color)}
    ${leaf(0, -122, 64, 23, 30, color)}
    ${leaf(0, -182, 54, 19, -26, color)}
    ${leaf(0, -182, 54, 19, 26, color)}
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

/* ================================================================ */
/* 1. ATELIER — interior design: editorial, calm, refined            */
/* ================================================================ */
function frontAtelier(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1540, 156, 0.5)
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
  return back(
    backBody(v, {
      bg: '#f6f4ef',
      ink: '#2b2723',
      sub: '#6b6259',
      accent: a,
      font: FONTS.elegantSerif,
      serif: true,
      motif: `<rect x="60" y="60" width="${HALF_W - 90}" height="${CARD_H - 120}" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>`,
    })
  )
}

/* ================================================================ */
/* 2. BLOOM — florist: soft, botanical, hand-drawn sprig             */
/* ================================================================ */
function frontBloom(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1360, 150, 0.5)
  const offerSize = fitSize(v.offer, 1240, 50, 0.52)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#fbf1f2"/>
    ${sprig(210, 360, 1.5, a, 0.85)}
    ${sprig(CARD_W - 210, 360, 1.5, a, 0.85)}
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
  return back(
    backBody(v, {
      bg: '#fbf1f2',
      ink: '#4a3b3f',
      sub: '#8a6f74',
      accent: a,
      font: FONTS.elegantSerif,
      serif: true,
      motif: sprig(760, 340, 1.3, a, 0.8),
    })
  )
}

/* ================================================================ */
/* 3. FOUNDRY — builder: industrial charcoal + amber                 */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: '#1e2227',
      ink: '#ffffff',
      sub: '#a9b0b8',
      accent: a,
      font: FONTS.sans,
      motif: `<rect x="0" y="0" width="24" height="${CARD_H}" fill="${a}"/><polygon points="0,0 240,0 0,240" fill="${a}" opacity="0.9"/>`,
    })
  )
}

/* ================================================================ */
/* 4. SPARK — electrician: navy + electric yellow, bolt              */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: '#0f1f3a',
      ink: '#ffffff',
      sub: '#9fb3d1',
      accent: a,
      font: FONTS.geometric,
      motif: bolt(690, 360, 1.15, a, 0.9),
    })
  )
}

/* ================================================================ */
/* 5. MEADOW — landscaper: layered green hills                       */
/* ================================================================ */
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
  return back(
    backBody(v, {
      ink: '#22331f',
      sub: '#4d6047',
      accent: a,
      font: FONTS.rounded,
      motif: `<path d="M0 1120 Q 300 1050 620 1110 T ${HALF_W} 1120 L ${HALF_W} ${CARD_H} L 0 ${CARD_H} Z" fill="${lighten(
        a,
        0.2
      )}"/><path d="M0 1200 Q 320 1150 640 1200 T ${HALF_W} 1200 L ${HALF_W} ${CARD_H} L 0 ${CARD_H} Z" fill="${a}"/>`,
    })
  )
}

/* ================================================================ */
/* 6. FRESH — cleaner: bright aqua, bubbles, sparkle                 */
/* ================================================================ */
function frontFresh(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const nameSize = fitSize(v.businessName, 1440, 132, 0.56)
  const offerSize = fitSize(v.offer, 1280, 60, 0.56)
  return svg(`
    <rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>
    <circle cx="1590" cy="250" r="240" fill="${lighten(a, 0.55)}"/>
    <circle cx="1720" cy="520" r="120" fill="${lighten(a, 0.4)}"/>
    <circle cx="1470" cy="470" r="70" fill="${lighten(a, 0.3)}"/>
    ${sparkle(1560, 250, 96, '#ffffff', 0.95)}
    ${sparkle(1690, 190, 40, a, 0.9)}
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
  return back(
    backBody(v, {
      ink: '#123b41',
      sub: '#4a6d72',
      accent: a,
      font: FONTS.rounded,
      motif: `<circle cx="740" cy="300" r="150" fill="${lighten(a, 0.5)}"/><circle cx="820" cy="470" r="70" fill="${lighten(
        a,
        0.35
      )}"/>${sparkle(720, 300, 60, '#ffffff', 0.95)}`,
    })
  )
}

/* ================================================================ */
/* 7. VOGUE — salon & beauty: dark, luxe, gold                       */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: '#141414',
      ink: '#f5f1ea',
      sub: '#c9c2b6',
      accent: a,
      font: FONTS.elegantSerif,
      serif: true,
      motif: `<rect x="60" y="60" width="${HALF_W - 90}" height="${CARD_H - 120}" fill="none" stroke="${a}" stroke-width="2"/>`,
    })
  )
}

/* ================================================================ */
/* 8. CRUST — bakery & café: warm cream + terracotta, scallop        */
/* ================================================================ */
function frontCrust(v: TemplateValues): string {
  const a = normaliseHex(v.accent)
  const cx = CARD_W / 2
  const nameSize = fitSize(v.businessName, 1360, 146, 0.52)
  const offerSize = fitSize(v.offer, 1240, 50, 0.52)
  // Scalloped top edge.
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
  for (let x = rad; x < HALF_W; x += rad * 2) scallop += `<circle cx="${x}" cy="0" r="${rad}" fill="${a}"/>`
  return back(
    backBody(v, {
      bg: '#f4e9d3',
      ink: '#5a3822',
      sub: '#8a6a4a',
      accent: a,
      font: FONTS.serif,
      serif: true,
      motif: scallop,
    })
  )
}

/* ================================================================ */
/* 9. FRAME — photographer & creative: gallery mat, big type         */
/* ================================================================ */
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
  return back(
    backBody(v, {
      ink: '#16161a',
      sub: '#5b5b62',
      accent: a,
      font: FONTS.geometric,
      motif: `<rect x="46" y="46" width="${HALF_W - 92}" height="${CARD_H - 92}" fill="none" stroke="#16161a" stroke-width="8"/>`,
    })
  )
}

/* ================================================================ */
/* 10. LEDGER — professional services: structured navy grid          */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: a,
      ink: '#ffffff',
      sub: lighten(a, 0.6),
      accent: '#ffffff',
      font: FONTS.geometric,
    })
  )
}

/* ================================================================ */
/* 11. PULSE — fitness & PT: dark with a neon slash                  */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: '#141416',
      ink: '#ffffff',
      sub: '#9a9aa2',
      accent: a,
      font: FONTS.sans,
      motif: `<polygon points="0,0 96,0 34,${CARD_H} 0,${CARD_H}" fill="${a}"/>`,
    })
  )
}

/* ================================================================ */
/* 12. HERITAGE — joinery & trades: green, gold, roundel             */
/* ================================================================ */
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
  return back(
    backBody(v, {
      bg: '#23382f',
      ink: '#f3ead4',
      sub: lighten(a, 0.25),
      accent: a,
      font: FONTS.serif,
      serif: true,
      motif: roundel(720, 205, 74, a, a, FONTS.serif, v.businessName),
    })
  )
}

/* ================================================================ */

export const SVG_TEMPLATES: SvgTemplate[] = [
  {
    id: 'atelier',
    name: 'Atelier',
    description: 'Editorial, calm and refined — made for interior designers and studios.',
    suits: 'Interior design',
    defaults: {
      businessName: 'Studio Larch',
      tagline: 'Interior design & styling',
      offer: 'Now taking projects for spring',
      areaServed: 'Cotswolds & Oxford',
      phone: '01865 224 118',
      website: 'studiolarch.co.uk',
      accent: '#9c8466',
    },
    render: frontAtelier,
    renderBack: backAtelier,
  },
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Soft and botanical, with a hand-drawn sprig — lovely for florists.',
    suits: 'Florist',
    defaults: {
      businessName: 'Fig & Fern',
      tagline: 'Seasonal flowers, grown with care',
      offer: 'Weddings & weekly bouquets',
      areaServed: 'Bath & Bradford-on-Avon',
      phone: '01225 447 902',
      website: 'figandfern.co.uk',
      accent: '#86a06b',
    },
    render: frontBloom,
    renderBack: backBloom,
  },
  {
    id: 'foundry',
    name: 'Foundry',
    description: 'Bold industrial charcoal and amber — built for builders and trades.',
    suits: 'Builder',
    defaults: {
      businessName: 'Kingsworth Build',
      tagline: 'Extensions · renovations · groundwork',
      offer: 'Free site visit & quote',
      areaServed: 'Surrey & SW London',
      phone: '020 8123 4567',
      website: 'kingsworthbuild.co.uk',
      accent: '#f5a623',
    },
    render: frontFoundry,
    renderBack: backFoundry,
  },
  {
    id: 'spark',
    name: 'Spark',
    description: 'High-voltage navy and yellow with a bolt — sharp for electricians.',
    suits: 'Electrician',
    defaults: {
      businessName: 'Voltway Electrical',
      tagline: 'NICEIC approved · fully insured',
      offer: '24/7 call-outs',
      areaServed: 'Reading & Wokingham',
      phone: '0118 950 7788',
      website: 'voltway.co.uk',
      accent: '#ffd21e',
    },
    render: frontSpark,
    renderBack: backSpark,
  },
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Layered green landscape — a natural fit for gardeners and landscapers.',
    suits: 'Landscaper',
    defaults: {
      businessName: 'Rowan & Reed',
      tagline: 'Garden design & landscaping',
      offer: 'Book your spring garden now',
      areaServed: 'Guildford & the Surrey Hills',
      phone: '01483 556 210',
      website: 'rowanandreed.co.uk',
      accent: '#4f8a4f',
    },
    render: frontMeadow,
    renderBack: backMeadow,
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Bright, bubbly and spotless — clean and friendly for cleaning services.',
    suits: 'Cleaner',
    defaults: {
      businessName: 'Brightwork Cleaning',
      tagline: 'Homes & offices, sparkling',
      offer: 'First clean 20% off',
      areaServed: 'Bristol & Clifton',
      phone: '0117 244 9081',
      website: 'brightwork.co.uk',
      accent: '#21b8cf',
    },
    render: frontFresh,
    renderBack: backFresh,
  },
  {
    id: 'vogue',
    name: 'Vogue',
    description: 'Dark, luxe and fashion-led — chic for salons and beauty.',
    suits: 'Salon & beauty',
    defaults: {
      businessName: 'Maison Noir',
      tagline: 'Hair · colour · styling',
      offer: 'New clients — 15% off',
      areaServed: 'Marylebone, London',
      phone: '020 7123 8890',
      website: 'maisonnoir.co.uk',
      accent: '#c9a24b',
    },
    render: frontVogue,
    renderBack: backVogue,
  },
  {
    id: 'crust',
    name: 'Crust',
    description: 'Warm cream and terracotta with a scalloped edge — inviting for bakeries and cafés.',
    suits: 'Bakery & café',
    defaults: {
      businessName: 'Poppy & Rye',
      tagline: 'Freshly baked, every morning',
      offer: 'Order your celebration cake',
      areaServed: 'Stroud & Nailsworth',
      phone: '01453 700 214',
      website: 'poppyandrye.co.uk',
      accent: '#c0632f',
    },
    render: frontCrust,
    renderBack: backCrust,
  },
  {
    id: 'frame',
    name: 'Frame',
    description: 'Gallery-minimal with a bold border — for photographers and creatives.',
    suits: 'Photographer',
    defaults: {
      businessName: 'North Light Studio',
      tagline: 'Portrait & wedding photography',
      offer: 'Spring portrait sessions open',
      areaServed: 'Edinburgh & the Lothians',
      phone: '0131 556 0042',
      website: 'northlight.studio',
      accent: '#d98a4e',
    },
    render: frontFrame,
    renderBack: backFrame,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    description: 'Structured and corporate navy — trustworthy for professional services.',
    suits: 'Professional services',
    defaults: {
      businessName: 'Hartley & Finch',
      tagline: 'Accountants for small business',
      offer: 'Free first consultation',
      areaServed: 'Manchester & Salford',
      phone: '0161 300 4477',
      website: 'hartleyfinch.co.uk',
      accent: '#1b3a5b',
    },
    render: frontLedger,
    renderBack: backLedger,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Dark with a neon slash — energetic for gyms and personal trainers.',
    suits: 'Fitness',
    defaults: {
      businessName: 'Iron & Oak',
      tagline: 'Personal training studio',
      offer: '2 sessions free this month',
      areaServed: 'Leeds city centre',
      phone: '0113 400 2211',
      website: 'ironandoak.fit',
      accent: '#c6f24e',
    },
    render: frontPulse,
    renderBack: backPulse,
  },
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Traditional roundel and gold on deep green — an established feel for joiners and makers.',
    suits: 'Joinery & trades',
    defaults: {
      businessName: 'Ashcombe Joinery',
      tagline: 'Bespoke carpentry since 1979',
      offer: 'Handmade kitchens & staircases',
      areaServed: 'Est. Hampshire',
      phone: '01962 880 340',
      website: 'ashcombejoinery.co.uk',
      accent: '#cba35a',
    },
    render: frontHeritage,
    renderBack: backHeritage,
  },
]

export function getTemplate(id: string): SvgTemplate | undefined {
  return SVG_TEMPLATES.find((t) => t.id === id)
}
