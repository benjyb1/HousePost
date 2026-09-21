// QA every Housepost SVG postcard template (front + back) for print-safety.
//
// Two outputs:
//  1. A console report: each <text> element measured with a CONSERVATIVE glyph
//     factor, flagged if it crosses the trim, the safe box, or the back fold.
//  2. A contact-sheet HTML (path printed) rendering every front and back at both
//     DEFAULT and STRESS (deliberately long) content, with trim/safe/fold guides
//     overlaid, for the eyeball checks the estimator can't make (frames, rules).
//
// Run: npx tsx .claude/skills/postcard-template-qa/qa-templates.ts
// Override the output path with QA_OUT=/some/path.html

import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SVG_TEMPLATES } from '../../../components/postcards/svg-templates/templates'
import { CARD_W, CARD_H } from '../../../components/postcards/svg-templates/helpers'
import type { SvgTemplate, TemplateValues } from '../../../components/postcards/svg-templates/types'

const BLEED = 35 // 3mm @ 300 DPI — trimmed off
const SAFE = 71 // bleed + 3mm — keep all text inside this
const FOLD = Math.round(CARD_W / 2) // 910 — back address boundary
// Per-font glyph-width estimate (average glyph width : font-size). A single flat
// factor either misses wide faces (mono, bold serif) or over-flags narrow ones
// (regular sans body); glyphFactor() picks per element from its family + weight.

/** Long content to expose overflow that tidy defaults hide. */
const STRESS: Partial<TemplateValues> = {
  businessName: 'Wentworth & Farringdale Property Co.',
  tagline: 'Award-winning local specialists since 1992',
  offer: 'Book your free no-obligation valuation today',
  areaServed: 'Kingston, Surbiton, New Malden & Norbiton',
  website: 'www.wentworth-farringdale-property.co.uk',
  backHeadline: 'Thinking of selling your home this year?',
  backMessage:
    'A friendly, straight-talking local team who will give you an honest valuation and guide you through every step of your move, with no pressure at all.',
  backCta: 'Arrange your free market appraisal today',
}

interface Flag {
  side: 'front' | 'back'
  variant: 'default' | 'stress'
  text: string
  xStart: number
  xEnd: number
  level: 'ERROR' | 'WARN'
  why: string
}

/** Rough visible length: entities and tags each count as one glyph. */
function glyphLen(inner: string): number {
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/&#\d+;|&[a-zA-Z]+;/g, '.')
    .trim().length
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`))
  return m ? m[1] : undefined
}

/** Average glyph-width : font-size for the element's face and weight. */
function glyphFactor(attrs: string): number {
  const fam = (attr(attrs, 'font-family') ?? '').toLowerCase()
  const bold = parseInt(attr(attrs, 'font-weight') ?? '400', 10) >= 600
  if (/courier|monospace/.test(fam)) return 0.62 // fixed-width
  if (/century gothic|futura|avenir/.test(fam)) return bold ? 0.58 : 0.54 // geometric caps are wide
  if (/georgia|palatino|times|book antiqua/.test(fam)) return bold ? 0.56 : 0.52 // serif
  return bold ? 0.55 : 0.52 // helvetica / arial / trebuchet
}

/** Measure every <text> in an SVG string and flag boundary crossings. */
function checkSvg(svg: string, side: 'front' | 'back', variant: 'default' | 'stress'): Flag[] {
  const flags: Flag[] = []
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg))) {
    const attrs = m[1]
    // The opt-out compliance line deliberately sits in the back's address half.
    if (/id="opt-out"/.test(attrs)) continue
    const len = glyphLen(m[2])
    if (!len) continue
    const x = parseFloat(attr(attrs, 'x') ?? '0')
    const size = parseFloat(attr(attrs, 'font-size') ?? '0')
    if (!size) continue
    const anchor = attr(attrs, 'text-anchor') ?? 'start'
    const ls = parseFloat(attr(attrs, 'letter-spacing') ?? '0')
    const w = len * size * glyphFactor(attrs) + Math.max(0, len - 1) * ls
    let xStart = x
    let xEnd = x + w
    if (anchor === 'middle') { xStart = x - w / 2; xEnd = x + w / 2 }
    else if (anchor === 'end') { xStart = x - w; xEnd = x }

    const label = m[2].replace(/<[^>]*>/g, '').replace(/&#\d+;/g, ' ').replace(/&[a-zA-Z]+;/g, '&').trim().slice(0, 40)
    // Hard limits: the back clips at the fold; the front is cut at the trim.
    // Anything crossing these renders broken. A 25px band before is a warning.
    const rightLimit = side === 'back' ? FOLD : CARD_W - BLEED

    if (xEnd > rightLimit) flags.push({ side, variant, text: label, xStart: Math.round(xStart), xEnd: Math.round(xEnd), level: 'ERROR', why: side === 'back' ? `clips fold (x=${FOLD})` : `over trim (x=${CARD_W - BLEED})` })
    else if (xEnd > rightLimit - 25) flags.push({ side, variant, text: label, xStart: Math.round(xStart), xEnd: Math.round(xEnd), level: 'WARN', why: side === 'back' ? `at fold (x=${rightLimit})` : `at trim (x=${rightLimit})` })
    if (xStart < BLEED) flags.push({ side, variant, text: label, xStart: Math.round(xStart), xEnd: Math.round(xEnd), level: 'ERROR', why: `over trim left (x=${BLEED})` })
    else if (xStart < BLEED + 25) flags.push({ side, variant, text: label, xStart: Math.round(xStart), xEnd: Math.round(xEnd), level: 'WARN', why: `at trim left (x=${BLEED})` })
  }
  return flags
}

function values(t: SvgTemplate, variant: 'default' | 'stress'): TemplateValues {
  return variant === 'default' ? t.defaults : { ...t.defaults, ...STRESS }
}

/** Overlay guides (percent insets) for a card of the given side. */
function guides(side: 'front' | 'back'): string {
  const pct = (px: number, total: number) => (px / total) * 100
  const box = (inset: number, colour: string) =>
    `<div style="position:absolute;left:${pct(inset, CARD_W)}%;right:${pct(inset, CARD_W)}%;top:${pct(inset, CARD_H)}%;bottom:${pct(inset, CARD_H)}%;border:1px dashed ${colour};pointer-events:none"></div>`
  let g = box(BLEED, 'rgba(239,68,68,.9)') + box(SAFE, 'rgba(37,99,235,.85)')
  if (side === 'back') {
    g += `<div style="position:absolute;left:50%;right:0;top:0;bottom:0;background:rgba(245,158,11,.14);border-left:1px solid rgba(245,158,11,.9);pointer-events:none"></div>`
    g += `<div style="position:absolute;left:50%;top:6px;transform:translateX(6px);font:600 9px sans-serif;color:#b45309">ADDRESS</div>`
  }
  return g
}

function card(svg: string, side: 'front' | 'back', caption: string, flagged: boolean): string {
  return `<figure style="margin:0">
    <div style="position:relative;border:1px solid ${flagged ? '#ef4444' : '#e5e7eb'};border-radius:6px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)">
      <div style="[&_svg]:block">${svg}</div>${guides(side)}
    </div>
    <figcaption style="font:11px sans-serif;color:${flagged ? '#b91c1c' : '#94a3b8'};text-align:center;margin-top:4px">${caption}${flagged ? ' ⚠︎' : ''}</figcaption>
  </figure>`
}

const rows: string[] = []
const report: string[] = []
let errors = 0
let warns = 0

for (const t of SVG_TEMPLATES) {
  const cells: string[] = []
  const tFlags: Flag[] = []
  for (const variant of ['default', 'stress'] as const) {
    const v = values(t, variant)
    const front = t.render(v)
    const back = t.renderBack(v)
    const ff = checkSvg(front, 'front', variant)
    const bf = checkSvg(back, 'back', variant)
    tFlags.push(...ff, ...bf)
    cells.push(card(front, 'front', `Front · ${variant}`, ff.length > 0))
    cells.push(card(back, 'back', `Back · ${variant}`, bf.length > 0))
  }
  const err = tFlags.filter((f) => f.level === 'ERROR')
  const warn = tFlags.filter((f) => f.level === 'WARN')
  errors += err.length
  warns += warn.length

  report.push(`\n${err.length ? '✗' : warn.length ? '!' : '✓'} ${t.id.padEnd(10)} ${err.length} errors, ${warn.length} warnings`)
  for (const f of tFlags) report.push(`    [${f.level}] ${f.side}/${f.variant} "${f.text}" x=${f.xStart}..${f.xEnd} — ${f.why}`)

  rows.push(`<section style="background:#fff;border:1px solid ${err.length ? '#fecaca' : '#e5e7eb'};border-radius:12px;padding:16px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">
      <h2 style="margin:0;font:600 16px sans-serif">${t.name}</h2>
      <code style="font:12px monospace;color:#64748b">${t.id}</code>
      <span style="font:12px sans-serif;color:${err.length ? '#b91c1c' : warn.length ? '#b45309' : '#16a34a'}">${err.length} errors · ${warn.length} warnings</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start">${cells.join('')}</div>
  </section>`)
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Template QA</title>
<style>body{margin:0;background:#eef1f5;padding:24px;font-family:sans-serif} .card svg,section svg{display:block;width:100%;height:auto} h1{font-size:20px;margin:0 0 4px} .legend{font:12px sans-serif;color:#475569;margin:0 0 20px}</style></head>
<body>
<h1>Postcard template QA — trim/safe/fold guides</h1>
<p class="legend">Red dashed = trim (card edge). Blue dashed = safe zone (keep text inside). Amber shade = back address half (keep clear). Each template shown front + back at default and stress content. Cards outlined red have an estimated overflow.</p>
${rows.join('\n')}
</body></html>`

const out = process.env.QA_OUT || join(tmpdir(), 'template-qa.html')
writeFileSync(out, html)

console.log(report.join('\n'))
console.log(`\n${'='.repeat(56)}`)
console.log(`${SVG_TEMPLATES.length} templates · ${errors} errors · ${warns} warnings`)
console.log(`Contact sheet: ${out}`)
if (errors > 0) process.exitCode = 1
