# Postcard print-safety audit — the 16 SVG templates

**Date:** 21 September 2026 · **Scope:** `components/postcards/svg-templates/templates.ts` (16 designs, front + back) · **Print path:** browser SVG → `<canvas>` PNG (1819×1311) → Stannp A6 · **Status:** audit only, no template changed.

Companion contact sheet (every front and back, both content extremes, with Stannp's real guides overlaid): `docs/print-safety-contact-sheet.html`.

## Verdict in one paragraph

Housepost's print constants are **correct** — they match Stannp's own A6 artwork template to within a pixel on every axis, and are fractionally more conservative on the safe line and the address fold. So the 71px safe box is not too small; it *is* Stannp's safe zone. The problem is that the templates don't always stay inside it. Of 32 template-sides: **1 HARD fail** (Studio front — hero text reaches and crosses the physical trim), **17 safe-zone fails** (almost all the same thing: the bottom contact line sits ~1.3–2.4mm below the safe line, even at default content), **2 aesthetic concerns**, **12 clean**. The back address half is watertight everywhere (the fold clip does its job; the opt-out line is correctly placed below Stannp's clear zone). None of this needs a bigger safe margin — it needs the templates to honour the margin that's already there, plus a fix to the optimistic `fitSize` estimate that lets heroes render wider than they're measured.

---

## Task 1 — Stannp's A6 geometry, from Stannp's own template

**Source (current, verified this session):** Stannp's downloadable A6 postcard artwork template, `https://www.stannp.com/assets/pdfs/design-guides/a6_postcard_template.pdf`, linked from the design-specs page `https://stannp.com/design-specs` (page title "Design specs – Direct mail design specifications | Stannp UK"). The live PDF fetched this session is identical in size (641.4KB) to the copy measured here, so the figures below are current.

Figures quoted verbatim from the template artwork, then converted at 300 DPI (1mm = 300/25.4 = **11.811 px**):

| Stannp label (quoted) | Meaning | mm | px @ 300 DPI |
|---|---|---|---|
| `"TEMPLATE DIMENSIONS = 15.4CM X 11.1CM"`, `"1819 X 1311 PIXELS @ 300 DPI"` | Full artwork incl. bleed | 154 × 111 | 1819 × 1311 |
| `"TRIM AND BLEED"` band + `"Bleed Margins … This area is cut off"` | Bleed per edge = (154−148)/2 = (111−105)/2 | 3 per edge | 35.43 |
| (A6 trim, implied by the above) | Trim / finished size | 148 × 105 | 1748 × 1240 |
| `"A6 POSTCARD SAFE ZONE (14.2CM X 9.9CM)"` + `"0.6CM"` edge dimension | Safe zone; 0.6cm from artwork edge, 3mm inside trim | 142 × 99; **6 from edge / 3 from trim** | safe line at **70.87** from edge |
| `"Safe Zone … Keep important text and logos inside the safe zone … printers can sometimes print with a minor skew"` | Rule for the safe zone | — | — |
| `"INDICIA & ADDRESS BOX"` + `"Clear Zone … addresses and barcodes … machine readable … keep these areas clear"` | Back address/indicia keep-out | top-right block | see below |
| `"7.72CM"` | Clear-zone **left** edge, from left artwork edge | 77.2 | **911.8** |
| `"9.19CM"` | Clear-zone **bottom**, from top artwork edge | 91.9 | **1085.6** |

So Stannp's back keep-out is not the whole right half — it is the **top-right block**: x ≥ 911.8px **and** y ≤ 1085.6px. The lower ~19mm of the right half is not reserved.

### Reconciliation: Stannp vs Housepost's constants

| Quantity | Stannp (derived) | Housepost constant | Match? |
|---|---|---|---|
| Artwork px | 1819 × 1311 | `CARD_W`×`CARD_H` = 1819 × 1311 | **Exact** |
| Bleed / trim inset | 35.43px (3mm) | `BLEED = 35` | Match; HP trim line 0.43px more generous (0.04mm — immaterial) |
| Safe line from edge | 70.87px (6mm / 0.6cm) | `SAFE = 71` | **Match**; HP 0.13px *more* conservative |
| Address fold / clear-zone left | 911.8px (7.72cm) | `FOLD`/`HALF_W = 910` | Match; HP 1.8px *more* conservative (reserves slightly more) |
| Hero side margin | (n/a — Stannp only specs the safe zone) | `USABLE = CARD_W − 180` → 90px margin | Target sits inside safe (90 > 71) — good in principle |

**Is 71px safe enough? Yes — to the pixel.** `SAFE = 71` equals Stannp's published safe zone (70.87px). Do **not** enlarge it; that would just move the goalposts. Every finding below is a template overrunning the correct line, not a wrong line. The one place to be careful is the reverse: because our line is exactly Stannp's, there is zero slack, so text that "just touches" the safe line is genuinely at the edge of Stannp's skew-risk band.

---

## Task 2 — Measured clearances (real geometry, not the estimator)

**Method.** The live modules were bundled (esbuild IIFE) and rendered in headless Chromium — the *same engine and the same SVG→canvas pipeline the app uses to raster the card* (`SvgTemplateEditor.tsx` `svgToPngBlob`). Every drawn element's true bounds come from `getBoundingClientRect()` in card px (1 user-unit = 1px at viewBox `0 0 1819 1311`), so this is what actually ships, not `fitSize`'s guess. Each template was measured front and back at four content sets: **default**, two realistic interior-design businesses (medium and long), and the **stress** set from `qa-templates.ts`. Clearances are signed: positive = inside the line, negative = past it. (Harness: `scratchpad/audit/` — `measure.mjs`, `measurements.json`.)

Worst (smallest) clearance per template-side, across all four content sets:

| Template | Side | Tier | Worst → safe (mm, side) | Worst → trim (mm, side) | Back fold gap | Offending element [variant] |
|---|---|---|---|---|---|---|
| Studio | front | **HARD** | −12.32 (right) | **−9.31 (right)** | – | "KINGSTON, SURBITON, NEW MALDEN & NORBITON" [stress]; and the **default** offer "NEW PROJECT NEAR YOU" reaches trim (−0.13mm) |
| Studio | back | SAFETY | −2.36 (bottom) | 0.68 (bottom) | 6.27 | "020 1234 5678" [default] |
| Linen | front | OK | 1.62 (left) | 4.66 (left) | – | "Meridian Interiors" |
| Linen | back | SAFETY | −0.24 (bottom) | 2.79 (bottom) | 5.93 | "www.meridianinteriors.co.uk" [default] |
| Manor | front | CONCERN | 1.29 (left) | 4.32 (left) | – | "Wentworth & Farringdale Property Co." [stress] |
| Manor | back | OK | 2.26 (left) | 5.25 (left) | 8.30 | "New home, fresh start?" |
| Palette | front | OK | 8.22 (left) | 11.26 (left) | – | "Hue Studio" |
| Palette | back | OK | 4.67 (bottom) | 7.70 (bottom) | 14.90 | "huestudio.co.uk" |
| Atelier | front | SAFETY | −0.76 (bottom) | 2.20 (bottom) | – | "www.wentworth-farringdale-property.co.uk" [stress] |
| Atelier | back | SAFETY | −1.94 (bottom) | 1.10 (bottom) | 15.24 | "studiolarch.co.uk" [default] |
| Bloom | front | OK¹ | 6.02 (bottom) | 9.06 (bottom) | – | contact line; ¹sprig leaf tip crosses top trim (clipped at cut) |
| Bloom | back | SAFETY | −1.94 (bottom) | 1.10 (bottom) | 13.80 | "figandfern.co.uk" [default] |
| Foundry | front | SAFETY | −1.34 (bottom) | 1.69 (bottom) | – | "020 8123 4567" [default] |
| Foundry | back | SAFETY | −1.68 (bottom) | 1.35 (bottom) | 14.48 | "kingsworthbuild.co.uk" [default] |
| Spark | front | OK | 2.55 (bottom) | 5.59 (bottom) | – | "0118 950 7788" |
| Spark | back | SAFETY | −1.85 (bottom) | 1.19 (bottom) | 7.03 | "voltway.co.uk" [default] |
| Meadow | front | SAFETY | −0.41 (bottom) | 2.62 (bottom) | – | "01483 556 210" [default] |
| Meadow | back | SAFETY | −1.68 (bottom) | 1.35 (bottom) | 14.73 | "rowanandreed.co.uk" [default] |
| Fresh | front | OK | 3.31 (left) | 6.35 (left) | – | "BRISTOL & CLIFTON" |
| Fresh | back | SAFETY² | −1.68 (bottom) | 1.35 (bottom) | 14.73 | "brightwork.co.uk" [default]; ²bubble motif clipped at fold |
| Vogue | front | OK | 4.33 (bottom) | 7.37 (bottom) | – | contact line |
| Vogue | back | SAFETY | −1.94 (bottom) | 1.10 (bottom) | 15.24 | "maisonnoir.co.uk" [default] |
| Crust | front | OK | 2.55 (bottom) | 5.59 (bottom) | – | contact line |
| Crust | back | SAFETY | −1.70 (bottom) | 1.27 (bottom) | 11.35 | "poppyandrye.co.uk" [default] |
| Frame | front | OK | 1.62 (bottom) | 4.66 (bottom) | – | "0131 556 0042" |
| Frame | back | SAFETY | −1.85 (bottom) | 1.19 (bottom) | 7.03 | "northlight.studio" [default] |
| Ledger | front | OK | 2.94 (bottom) | 5.93 (bottom) | – | contact line |
| Ledger | back | SAFETY | −1.85 (bottom) | 1.19 (bottom) | 7.03 | "hartleyfinch.co.uk" [default] |
| Pulse | front | CONCERN | 0.44 (right) | 3.47 (right) | – | "WENTWORTH & FARRINGDALE PROPERTY CO." [stress] |
| Pulse | back | SAFETY | −1.68 (bottom) | 1.35 (bottom) | 14.48 | "ironandoak.fit" [default] |
| Heritage | front | OK | 3.47 (bottom) | 6.43 (bottom) | – | contact line |
| Heritage | back | SAFETY | −1.70 (bottom) | 1.27 (bottom) | 5.84 | "ashcombejoinery.co.uk" [default] |

**Reading the numbers.** Every negative "→ safe" is text; no negative "→ trim" exists except Studio front. Back **fold gaps are all healthy (5.8–15.2mm)** — the nested-SVG clip means left-half art can't reach the address half, and even stress content doesn't come close. The address/indicia clear zone stays white on every back at every content set; the only right-half ink is the intended `id="opt-out"` line, measured at x 1199–1531, y 1196–1231 — below Stannp's clear-zone bottom (1085.6) and inside the bottom safe line (1240). It is placed well.

**Two systemic patterns behind the "SAFETY" count:**

1. **Bottom contact line, 13 of 16 backs + 3 fronts.** The last contact line (website/phone) sits with its lower bound ~16–28px (1.3–2.4mm) below the 1240 safe line — at *default* content, not just stress. In the shared trade back (`themedBack`) the website baseline is `y=1252` (fs 38); in the Bold back the phone is `y=1258` (fs ~46); Foundry's front phone is `y=1245` on the bleeding amber bar. The text is never cut (it clears trim by ~1.1–2.8mm), but it lives in Stannp's 3mm skew-risk band. Note: for pure-digit phone lines this is mostly the font's descent metric (visible ink ~1mm higher); for names/URLs with a `g/p/y` (e.g. `figandfern`, `poppyandrye`) the descender genuinely reaches the measured bound.

2. **Back left gutter is on the line.** `BACK_M = 74`, and back headers use `x = BACK_M − 2 = 72`, so left-half text starts ~0.1–0.3mm inside the 71 safe line (Crust/Heritage serif backs measure 0.00mm — ink touching the line). Not a crossing, but zero slack.

Full per-side clearance table (L/R/T/B in mm) is in `scratchpad/audit/summary.json`.

---

## Task 3 — Ranked verdict (worst first)

Tiers: **HARD** = a non-bleed element crosses the trim (physically cut). **SAFETY** = crosses Stannp's real safe line (70.87px). **CONCERN** = inside safe but < ~1.5mm, or jammed against a coloured bar/frame. **OK** = clear. Intentional edge-bleed (backgrounds, bands, corner wedges, scallops, hills, side slashes) is expected to cross the trim and is not counted.

1. **Studio · front — HARD.** The only physical-cut risk in the set. The default offer "NEW PROJECT NEAR YOU" renders 1699px wide from x=86 → right edge 1785, past the 1784 trim line (−0.13mm) and 37px past safe. Long `areaServed` is worse: it's fixed at 52px + 12px letter-spacing with **no shrink**, so "Kingston, Surbiton, New Malden & Norbiton" runs 110px (9.3mm) off the card.
2. **Studio · back — SAFETY.** Phone bar text 2.36mm below safe; brand line also 1.1mm over the top safe line.
3. **Atelier / Bloom / Vogue · back — SAFETY** (−1.94mm bottom). Shared-back website line lowest of the group.
4. **Spark / Frame / Ledger · back — SAFETY** (−1.85mm bottom).
5. **Crust / Heritage · back — SAFETY** (−1.70mm bottom, and left gutter at 0.00mm).
6. Foundry / Meadow / Fresh / Pulse · back — SAFETY (−1.68mm bottom).
7. Foundry · front — SAFETY (−1.34mm, phone on the amber bar). Atelier · front — SAFETY (−0.76mm, stress URL). Meadow · front — SAFETY (−0.41mm, phone). Linen · back — SAFETY (−0.24mm, only just).
8. **Pulse · front — CONCERN.** Uppercase italic name at long input comes within 0.44mm of the right safe line.
9. **Manor · front — CONCERN.** Long centred name comes within 1.29mm of left safe and can touch the inner frame rule (frame at x92, name left ~x86).
10. **OK:** Palette (both — the roomiest), Manor back, Bloom front, Spark/Fresh/Crust/Frame/Ledger/Vogue/Heritage fronts, Linen front. Palette is the reference for how much air the others could have.

Two cosmetic notes inside otherwise-OK cards: **Bloom front** — a botanical sprig leaf tip pokes into the top bleed and will be trimmed off; **Fresh back** — the aqua bubble motif is drawn past the fold and gets a straight vertical clip at x=910 (a sliced semicircle on the centre line). Neither is a print-safety failure.

---

## Recommended fixes

### Global

1. **Keep `SAFE = 71`, `BLEED = 35`, `FOLD/HALF_W = 910`.** They are Stannp's published geometry to the pixel. Don't raise SAFE — the templates need to respect it, not the other way round.
2. **Cut `fitSize`'s optimism.** It under-measures real width, so a "fitted" hero renders wider than its target and can clear its own margin. Measured proof: Studio's offer targets 1639px but renders 1699px; the true glyph factor for that bold uppercase line is 0.644, the code assumed 0.62 (~4% low; wide faces are worse). Either raise the per-face factors ~8–12%, or multiply the width estimate by a ~1.08 safety buffer, so `fitSize` never over-promises. This single change fixes the Studio default-offer trim graze and de-risks every hero.
3. **Size heroes and eyebrows against the safe box, and start them at x ≥ 90.** Replace the ad-hoc widths (`USABLE`, `1480`, `1360`, `1300`…) and the odd `x=86` starts with a max width computed from the safe line (right limit 1748 minus the start x). Left-aligned heroes should never start left of 90.
4. **Make every editable line shrink-to-fit — including the fixed eyebrow/area lines.** The `maxHint` copy promises text "auto-shrinks", but `areaServed` and several small caps lines are fixed-size and don't. Wrap them in `fitSize` (Studio's 52px + 12px letter-spacing is the worst; the letter-spacing must be in the width budget), or hard-cap their length.
5. **Give the bottom contact block ~30px of air.** Lift the final contact line so its box bottom clears y=1240 on every back and on the Foundry/Atelier/Meadow fronts. In `themedBack`: raise the rule (y=1114), phone (y=1198) and website (y=1252) by ~28–34px; do the same for the Bold/Clean/Bright bespoke backs.
6. **Bump `BACK_M` to ~80 and drop the `−2` header offsets**, so back left-half text has a real gutter instead of sitting on the safe line.
7. **Fix the QA estimator so it would have caught this.** `qa-templates.ts` only checks the horizontal axis (left/right vs trim/fold) and never the vertical, so it reports every one of these bottom-safe crossings as clean; and its pass/fail uses trim, not the 71 safe line. Add top/bottom checks against `SAFE`, and use Stannp's 70.87 value. (Better still, fold the real `getBBox` harness in this audit into CI so the estimator isn't the gate.)

### Per template (element, direction, rough amount)

- **Studio (bold) front:** offer — start at x=92, size against safe with factor ≥0.66 (drops it ~10px, clears trim). `areaServed` — wrap in `fitSize` against ~1650px including letter-spacing so long areas shrink instead of overflowing.
- **Studio (bold) back:** raise the bottom brand-bar contact text ~30px (phone baseline 1258 → ~1228); nudge the top brand line down a few px so it's not on the top safe line.
- **`themedBack` (Atelier, Bloom, Foundry, Spark, Meadow, Fresh, Vogue, Crust, Frame, Ledger, Pulse, Heritage backs):** one change fixes all 12 — lift the contact block ~30px (website 1252 → ~1222, phone 1198 → ~1172, rule 1114 → ~1088) and raise `BACK_M`/drop the `−2`.
- **Clean (Linen) back:** website baseline 1234 → ~1214 (clears the −0.24mm).
- **Bright (Palette) back:** already fine (contact sits in a raised white card) — use it as the pattern for the others.
- **Foundry / Meadow / Atelier fronts:** raise the bottom phone/website ~18–22px above their current baselines (1245 / 1235 / 1238).
- **Manor (classic) front:** cap the name `fitSize` width to the inner frame minus a ~24px gutter (≈1360, not 1480) so long names don't kiss the frame rule.
- **Pulse front:** reduce the name width budget (~1240 → ~1180) or raise its factor so long uppercase names keep ≥18px off the right safe line.
- **Bloom front (cosmetic):** lower the two sprigs ~30px so the leaf tips aren't trimmed.
- **Fresh back (cosmetic):** shift the bubble motif left ~60px so it sits fully within the left half and isn't sliced at the fold.

---

## Caveats

- Measurements are Chromium-on-macOS, which is exactly the app's own raster engine (`svgToPngBlob` draws the SVG to a canvas in the browser). A user on a machine missing a font in a stack (e.g. Century Gothic → Avenir/Trebuchet) could get widths a few percent different; that variability is itself an argument for the conservative `fitSize` buffer in rec 2.
- "Crosses safe by X mm" is the element's geometric box (baseline + font descent). For descender-free phone numbers the *visible* ink is ~1mm higher than the figure; for names/URLs containing g/p/y it's real. Either way the line is below Stannp's safe zone.
- Stannp figures are read from their vector template PDF (the file carries no extractable text, so the labels were read from the rendered artwork); the quoted strings above are verbatim. The bleed (3mm) and safe (6mm) values are also consistent with A6 = 148×105mm and the 154×111mm artwork, which cross-checks the reading.

## How to reproduce

```
# from scratchpad/audit (playwright-core + a cached esbuild are already present)
<cached-esbuild> entry-audit.ts --bundle --format=iife --global-name=HP --outfile=hp-audit.js --platform=browser
node measure.mjs        # -> measurements.json (128 renders)
node analyze.mjs        # -> ranked report + summary.json
node gen-contact-sheet.mjs   # -> docs/print-safety-contact-sheet.html
```
