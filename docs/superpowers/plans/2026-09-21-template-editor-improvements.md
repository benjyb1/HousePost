# Template Editor Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Freddie's six requests for the in-browser postcard template editor: an opt-out line on every back, an unsaved-changes guard, a draggable/resizable logo overlay, interior-designer copy in place of estate-agent copy, a front/back preview toggle, and undo/redo.

**Architecture:** The editor is one client component (`components/postcards/SvgTemplateEditor.tsx`) that renders pure SVG-string templates (`components/postcards/svg-templates/`) live, then rasterises the same strings to PNG on save. Template changes stay in the pure SVG layer; editor changes stay in React. The logo is an *overlay* injected into the SVG string at export time and driven by an HTML drag layer in the preview, so no template renderer needs to know about it.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (radix-ui), lucide-react, sonner, pdfjs-dist (already installed, worker at `/pdf.worker.min.mjs`), Supabase storage. Vitest is added in Workstream B for the pure logic.

---

## Read this first (every agent)

**House rules** (from `CLAUDE.md`): never commit to `main`; one branch + one PR per workstream; never touch `lib/stripe/**`, `app/api/postcards/**`, `lib/postcards/**`, `supabase/migrations/**`, auth. UK English in anything a user reads. Plain, human copy (no "delve", no rule-of-three padding). `npm run build` and `npx eslint app lib components` must be clean before a PR.

**There is no test runner today.** Workstream B adds Vitest for pure functions. Everything else is verified by: `npm run build`, `npx eslint app lib components`, the template QA checker (`npx tsx .claude/skills/postcard-template-qa/qa-templates.ts`) for template changes, and looking at it in a browser at desktop **and ~390px** width. Put a screenshot in every PR.

**Browser verification:** Vercel builds a preview for every PR, but the Hobby plan has a daily build cap that has bitten us before. If the preview isn't building, run locally: `.env.local` exists on this machine; use the built-in browser's `preview_start` with the existing `"Housepost Dev"` entry in `.claude/launch.json` (port 3001). Never run the dev server via plain Bash. The editor lives at `/postcards/design` → "Use a template".

**Print geometry** (px @ 300 DPI, from `@postcard-template-qa`): card 1819×1311; bleed 35px; trim at 35px; **safe box 71px in** — all text and logos inside it; **back fold at x=910** — the right half is the printer's address area.

**Commit style:** short imperative subject, body only if it earns it. End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and every PR description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Parallel agent assignment and merge order

| Agent | Workstream | Branch (from) | Touches | PR |
|---|---|---|---|---|
| 1 | **A** Opt-out line on every back | `claude/back-opt-out` (from `main`) | `svg-templates/templates.ts` (one helper), QA script | PR-A |
| 1 | **D** Interior-designer re-theme | `claude/interior-templates` (from `claude/back-opt-out`) | `svg-templates/templates.ts` (4 templates), `types.ts`, dead Canva gallery | PR-D (base → `main` once PR-A merges) |
| 2 | **B** Editor UX: toggle, undo/redo, leave guard, Vitest | `claude/editor-ux` (from `main`) | `SvgTemplateEditor.tsx`, `app/(portal)/postcards/design/page.tsx`, new hooks/components | PR-B |
| 3 | **C** Logo overlay | `claude/logo-overlay` (from `main`; **rebase onto `claude/editor-ux` before Task C5**) | new `components/postcards/logo/*`, then `SvgTemplateEditor.tsx` | PR-C (base → `main` once PR-B merges) |

Why this shape: A and D both edit `templates.ts` but different regions, so one agent does them in order. B and C both rewrite the editor's preview column, so C builds its standalone pieces (Tasks C1–C4, no editor edits) in parallel and integrates last on top of B. **Merge order: A → B → D → C.**

Agents 1 and 3 must not touch `SvgTemplateEditor.tsx` until their integration task says so. Agent 2 must not touch `svg-templates/`.

---

## Workstream A — `housepost.co.uk/opt-out` on every back

Freddie: "bottom-centre of the right-hand side panel of the back page, medium grey (about 60% darkness), like the Canva template."

All 16 backs go through one wrapper, `backSvg()` at `components/postcards/svg-templates/templates.ts:197`, which paints the white card and clips the design into the left half. Add the line there once, outside the clip, and every template gets it.

### Task A1: Add the opt-out line to `backSvg`

**Files:**
- Modify: `components/postcards/svg-templates/templates.ts:186-202`

- [x] **Step 1: Add the constant and the text element**

Replace the `backSvg` function with:

```ts
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
```

`#666666` is 60% black. 30px at 300 DPI is ~2.5mm cap-to-baseline: small print, still legible.

- [x] **Step 2: Check every back uses `backSvg`**

Run: `grep -c "backSvg(" components/postcards/svg-templates/templates.ts`
Expected: **6** — the definition, the four legacy backs (`renderBackBold/Clean/Classic/Bright`) and `themedBack()` (~line 425), which the twelve themed `back*` functions all go through. Then confirm every `renderBack:` entry in the registry (lines ~1019-1319) points at one of those. If any back builds its own `svg(...)`, switch it to `backSvg`.

- [x] **Step 3: Build and lint**

Run: `npm run build && npx eslint app lib components`
Expected: build succeeds, 0 lint errors.

- [x] **Step 4: Commit**

```bash
git add components/postcards/svg-templates/templates.ts
git commit -m "Add opt-out line to every template back"
```

### Task A2: Teach the QA checker the line is allowed

The checker flags anything drawn in the address half. The opt-out line lives there on purpose.

**Files:**
- Modify: `.claude/skills/postcard-template-qa/qa-templates.ts`
- Modify: `.claude/skills/postcard-template-qa/SKILL.md`

- [x] **Step 1: Run the checker and read the report**

Run: `npx tsx .claude/skills/postcard-template-qa/qa-templates.ts`
Expected: every back now reports a `clips fold` ERROR for the `housepost.co.uk/opt-out` text (that's our line) and the script exits 1.

- [x] **Step 2: Exempt elements with `id="opt-out"` from the fold check**

The script measures every `<text>` and flags `xEnd > FOLD` (around `qa-templates.ts:96-98`). At the top of that `while` loop over text elements add `if (/id="opt-out"/.test(attrs)) continue` (use whatever the variable holding the tag's attributes is called). Keep the check strict for everything else.

- [x] **Step 3: Re-run and confirm clean; open the contact sheet**

Run: `npx tsx .claude/skills/postcard-template-qa/qa-templates.ts`
Expected: no address-half findings. Open the printed HTML path in the built-in browser and eyeball three or four backs: the line is centred in the right half, grey, above the trim line, and not overlapping any template decoration.

- [x] **Step 4: Add one line to `SKILL.md` under "Print geometry"**

`- **Opt-out line:** every back carries \`housepost.co.uk/opt-out\` at the bottom-centre of the address half (id="opt-out"); the checker exempts it.`

- [x] **Step 5: Commit**

```bash
git add .claude/skills/postcard-template-qa/
git commit -m "Exempt the opt-out line from the address-half QA check"
```

### Task A3: Check it against Stannp's address area

This is the one real risk: Stannp prints the address, indicia and barcode on the right half, and if their barcode strip runs along the bottom, our line collides with it.

- [x] **Step 1: Read Stannp's A6 postcard artwork guide** (search "Stannp A6 postcard template" — they publish a PDF with the address/barcode keep-out zones). Note the bottom keep-out height, if any.
- [x] **Step 2: If the bottom-centre of the right half is inside a keep-out zone**, move the line: try `OPT_OUT_Y = CARD_H - 86` → higher, or shift to left-of-centre. Record what you chose and why in the PR.
- [x] **Step 3: Rasterise one back and look at the PNG** — in the editor, pick any template, click "Use this design", open the saved back via the "View file" link (swap `design.png` for `design-back.png` in the URL). Confirm the grey line is there at print size.

### Task A4: Open PR-A

- [x] `npm run build && npx eslint app lib components` clean.
- [x] Push `claude/back-opt-out`, open a PR to `main` titled "Add opt-out line to every template back". Body: what changed, the Stannp keep-out finding from A3, one screenshot of a back from the contact sheet.

---

## Workstream D — Interior-designer copy replaces estate-agent copy

Freddie: "We do not sell to estate agents. Change these so each template reflects a trade we target." Decision: **all four become interior-design variants** (the existing `atelier` template is also interior design; that's fine — four more looks for the same trade).

Do this on `claude/interior-templates`, branched from `claude/back-opt-out` after A is committed.

### Task D1: Rewrite the four templates' defaults, names and descriptions

**Files:**
- Modify: `components/postcards/svg-templates/templates.ts:1000-1080` (the `bold`, `clean`, `classic`, `bright` entries) and the header comment at lines 13-16.

Keep the `id`s (`bold`, `clean`, `classic`, `bright`) — nothing persists them, but there's no reason to churn. Change `name`, `description` and `defaults`:

- [x] **Step 1: Replace the four entries' `name`/`description`/`defaults` with:**

```ts
  {
    id: 'bold',
    name: 'Studio',
    description: 'Colour-block statement for a confident design studio.',
    defaults: {
      businessName: 'Harbour & Vale Interiors',
      tagline: 'Interior design, done properly',
      offer: 'NEW PROJECT NEAR YOU',
      areaServed: 'Kingston & Surbiton',
      phone: '020 1234 5678',
      website: 'harbourvale.co.uk',
      accent: '#c02b3a',
      backHeadline: 'We just finished a home near you',
      backMessage:
        'A full redesign a few doors down. If your new place needs a fresh look, we’d love to show you what’s possible. First consultation is free.',
      backCta: 'Book a free design consultation',
    },
    render: renderBold,
    renderBack: renderBackBold,
  },
  {
    id: 'clean',
    name: 'Linen',
    description: 'Calm, airy and minimal. Lets a considered brand breathe.',
    defaults: {
      businessName: 'Meridian Interiors',
      tagline: 'Calm, considered interiors',
      offer: 'Free design consultation',
      areaServed: 'Richmond upon Thames',
      phone: '020 8765 4321',
      website: 'www.meridianinteriors.co.uk',
      accent: '#0f766e',
      backHeadline: 'Just moved in?',
      backMessage:
        'The first few months are when a home takes shape. We help you plan the rooms that matter, from one space to the whole house.',
      backCta: 'Arrange your free consultation',
    },
    render: renderClean,
    renderBack: renderBackClean,
  },
  {
    id: 'classic',
    name: 'Manor',
    description: 'Traditional serif and a formal frame for established, heritage-led studios.',
    defaults: {
      businessName: 'Ashcombe & Co',
      tagline: 'Timeless interiors since 1998',
      offer: 'Bespoke room design',
      areaServed: 'Bath & Somerset',
      phone: '01225 123 456',
      website: 'ashcombeandco.co.uk',
      accent: '#1e3a5f',
      backHeadline: 'Make it yours',
      backMessage:
        'A new home deserves more than the last owner’s choices. We design rooms around how you live, with fabric, colour and furniture sourced for you.',
      backCta: 'Request a design visit',
    },
    render: renderClassic,
    renderBack: renderBackClassic,
  },
  {
    id: 'bright',
    name: 'Palette',
    description: 'Playful colour and big type for studios that aren’t afraid of a bold room.',
    defaults: {
      businessName: 'Hue Studio',
      tagline: 'Colour-confident interiors',
      offer: 'Welcome to your new home',
      areaServed: 'Leeds & Harrogate',
      phone: '0113 496 0000',
      website: 'huestudio.co.uk',
      accent: '#f59e0b',
      backHeadline: 'Time for a fresh look?',
      backMessage:
        'Bold colour, clever storage and rooms that feel like you. One room or the whole home, and always to your budget.',
      backCta: 'Get a free colour consultation',
    },
    render: renderBright,
    renderBack: renderBackBright,
  },
```

Keep the existing `phone` values if you prefer; the ones above are just plausible UK formats.

- [x] **Step 2: Update the header comment (lines 13-16)** to: "The first four templates (Studio, Linen, Manor, Palette) are interior-design styles; the rest span the other trades the tool serves — interior design (Atelier), florist, builder, …". Also fix the line-76 comment `/* 2. CLEAN — minimal, airy, modern estate agent */` → `modern interior studio`.

- [x] **Step 3: Read the four FRONT and BACK renderers** (`renderBold`, `renderClean`, `renderClassic`, `renderBright` and their `renderBack*`, roughly lines 42-350) for estate-only motifs: a "SOLD" board, house icon, "for sale" sign, key graphic. Replace with a neutral or interior motif (a simple swatch bar of `accent`/`lighten(accent, x)` blocks, a thin frame, a monogram via `initials()`). If a renderer has no such motif, leave it alone. Don't restyle for the sake of it.

- [x] **Step 4: Build, lint, run the QA checker with the new defaults**

Run: `npm run build && npx eslint app lib components && npx tsx .claude/skills/postcard-template-qa/qa-templates.ts`
Expected: clean; open the contact sheet and check all four fronts and backs at default and stress content (`@postcard-template-qa` checklist). The new `backHeadline` for Studio is long — if it shrinks below ~56px or clips, shorten to "We just finished nearby".

- [x] **Step 5: Commit**

```bash
git add components/postcards/svg-templates/templates.ts
git commit -m "Re-theme the four estate-agent templates as interior design"
```

### Task D2: Take the estate-agent wording out of the form itself

The field placeholders and doc comments still say "agency" and "valuation" regardless of template.

**Files:**
- Modify: `components/postcards/svg-templates/types.ts:13-24, 58-81`

- [x] **Step 1: Replace the placeholders and comments**

```ts
  /** Short punchy offer / headline line, e.g. "Free first consultation". */
  offer: string
  /** Area the business covers, e.g. "Kingston & Surbiton". */
  areaServed: string
  ...
  /** Back-of-card headline, e.g. "Just moved in?". */
  backHeadline: string
  ...
  /** Back-of-card call to action, e.g. "Book a free consultation". */
  backCta: string
```

```ts
export const TEMPLATE_FIELDS: TemplateFieldDef[] = [
  { key: 'businessName', label: 'Business name', placeholder: 'Your business name', maxHint: 26 },
  { key: 'tagline', label: 'Tagline / service line', placeholder: 'What you do, in a line', maxHint: 40 },
  { key: 'offer', label: 'Offer / headline', placeholder: 'Free first consultation', maxHint: 30 },
  { key: 'areaServed', label: 'Area served', placeholder: 'Kingston & Surbiton', maxHint: 28 },
  { key: 'phone', label: 'Phone', placeholder: '020 1234 5678', maxHint: 20 },
  { key: 'website', label: 'Website', placeholder: 'www.yourbusiness.co.uk', maxHint: 30 },
]

export const TEMPLATE_BACK_FIELDS: TemplateFieldDef[] = [
  { key: 'backHeadline', label: 'Back headline', placeholder: 'Just moved in?', maxHint: 24 },
  { key: 'backMessage', label: 'Back message', placeholder: 'A friendly line or two about what you offer and why to get in touch.', maxHint: 150, multiline: true },
  { key: 'backCta', label: 'Back call to action', placeholder: 'Book a free consultation', maxHint: 28 },
]
```

- [x] **Step 2: Sweep for leftovers**

Run: `grep -rniE "\bestate\b|agency|valuation|\bagent\b" components/postcards app/\(portal\)/postcards` (the `\b` matters: a bare `estate` matches every `useState`).
Expected: hits in `components/postcards/templates.ts` and `TemplateGallery.tsx` (handled in D3) and one real one: `components/postcards/CustomDesignBrief.tsx:166` `placeholder="e.g. Bream & Co Estate Agents"` → change to `e.g. Bream & Co Interiors`. Fix anything else user-facing.

- [x] **Step 3: Build, lint, commit**

```bash
npm run build && npx eslint app lib components
git add components/postcards/svg-templates/types.ts
git commit -m "Drop estate-agent wording from template form placeholders"
```

### Task D3: Delete the dead Canva-era gallery

`components/postcards/TemplateGallery.tsx` and `components/postcards/templates.ts` ("Classic Estate Agent", "Free Valuation Offer", TODO Canva links) are imported nowhere (`grep -rn "TemplateGallery" app components` returns only the file itself). They'd confuse the next person and they're estate-agent flavoured.

- [x] **Step 1: Confirm unused**: `grep -rn "TemplateGallery\|postcards/templates'" app components lib` → only self-references.
- [x] **Step 2: Delete both files** and any `public/postcard-templates/*.png` they referenced (check `ls public/postcard-templates` and `grep -rn "postcard-templates/" app components lib` first; only delete images nothing else uses).
- [x] **Step 3: `npm run build && npx eslint app lib components`** clean.
- [x] **Step 4: Commit**: `git commit -am "Remove unused Canva-era template gallery"`

### Task D4: Open PR-D

- [x] Push `claude/interior-templates`. Open a PR with base `claude/back-opt-out`; once PR-A merges, retarget the base to `main` (GitHub: Edit → base).
- [x] Body: the four new template names, note that Atelier is also interior design by design, contact-sheet screenshots of the four fronts and backs, and the grep sweep result.

---

## Workstream B — Editor UX: front/back toggle, undo/redo, leave guard

Branch `claude/editor-ux` from `main`. Everything here is React; do not edit `svg-templates/`.

### File structure

- Create `components/postcards/useHistory.ts` — generic undo/redo state (pure logic in a reducer so it's testable; Workstream C reuses it for overlays).
- Create `components/postcards/useLeaveGuard.ts` — "you have unsaved changes" guard: `beforeunload`, in-app link clicks, and a `guard(action)` wrapper for buttons.
- Create `components/ui/alert-dialog.tsx` — shadcn primitive (via `npx shadcn@latest add alert-dialog`).
- Create `components/postcards/ConfirmLeaveDialog.tsx` — the one dialog, used by the page.
- Modify `components/postcards/SvgTemplateEditor.tsx` — toggle preview, undo/redo buttons and shortcuts, report `dirty` upward, route "All templates" through the guard.
- Modify `app/(portal)/postcards/design/page.tsx` — own the guard and dialog; guard "All design options".
- Add Vitest: `vitest.config.ts`, `"test": "vitest run"` script, tests under `components/postcards/__tests__/`.

### Task B1: Add Vitest

- [x] **Step 1:** `npm install -D vitest` (no jsdom needed; the tests are for pure functions).
- [x] **Step 2:** Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { include: ['**/__tests__/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
```

- [x] **Step 3:** Add `"test": "vitest run"` to `package.json` scripts.
- [x] **Step 4:** `npm test` → "No test files found" exits 0? If Vitest exits 1 with no files, add `passWithNoTests: true` to the config.
- [x] **Step 5:** Commit: `git add package.json package-lock.json vitest.config.ts && git commit -m "Add Vitest for pure editor logic"`

### Task B2: `useHistory` — reducer first, hook second

**Files:**
- Create: `components/postcards/useHistory.ts`
- Test: `components/postcards/__tests__/useHistory.test.ts`

- [x] **Step 1: Write the failing tests** for the pure reducer:

```ts
import { describe, it, expect } from 'vitest'
import { historyReducer, initialHistory, type History } from '../useHistory'

type V = { a: string }
const h0: History<V> = initialHistory({ a: '' })

describe('historyReducer', () => {
  it('pushes the previous value onto past and clears future', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    expect(h1.present).toEqual({ a: 'x' })
    expect(h1.past).toEqual([{ a: '' }])
    expect(h1.future).toEqual([])
  })

  it('coalesces rapid edits to the same key into one undo step', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'a', at: 300 })
    expect(h2.past).toEqual([{ a: '' }])
    const h3 = historyReducer(h2, { type: 'undo' })
    expect(h3.present).toEqual({ a: '' })
  })

  it('does not coalesce edits to a different key, or after the window', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'a', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'b', at: 100 })
    expect(h2.past).toHaveLength(2)
    const h3 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'a', at: 5000 })
    expect(h3.past).toHaveLength(2)
  })

  it('undo/redo walk the stacks and set clears redo', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, at: 0 })
    const h2 = historyReducer(h1, { type: 'undo' })
    expect(h2.present).toEqual({ a: '' })
    expect(h2.future).toEqual([{ a: 'x' }])
    const h3 = historyReducer(h2, { type: 'redo' })
    expect(h3.present).toEqual({ a: 'x' })
    const h4 = historyReducer(historyReducer(h3, { type: 'undo' }), { type: 'set', value: { a: 'z' }, at: 9999 })
    expect(h4.future).toEqual([])
  })

  it('undo on empty past and redo on empty future are no-ops', () => {
    expect(historyReducer(h0, { type: 'undo' })).toBe(h0)
    expect(historyReducer(h0, { type: 'redo' })).toBe(h0)
  })

  it('caps past at 100 entries', () => {
    let h = h0
    for (let i = 0; i < 150; i++) h = historyReducer(h, { type: 'set', value: { a: String(i) }, at: i * 10000 })
    expect(h.past.length).toBe(100)
  })

  it('reset replaces everything', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, at: 0 })
    const h2 = historyReducer(h1, { type: 'reset', value: { a: 'fresh' } })
    expect(h2).toEqual(initialHistory({ a: 'fresh' }))
  })

  it('seal ends a coalesced run without adding a step', () => {
    const h1 = historyReducer(h0, { type: 'set', value: { a: 'x' }, key: 'drag', at: 0 })
    const h2 = historyReducer(h1, { type: 'set', value: { a: 'xy' }, key: 'drag', at: 100 })
    const h3 = historyReducer(h2, { type: 'seal' })
    expect(h3.past).toEqual([{ a: '' }])
    expect(h3.present).toEqual({ a: 'xy' })
    // The next edit with the same key starts a new step.
    const h4 = historyReducer(h3, { type: 'set', value: { a: 'xyz' }, key: 'drag', at: 200 })
    expect(h4.past).toEqual([{ a: '' }, { a: 'xy' }])
  })
})
```

- [x] **Step 2: Run to see it fail**: `npm test` → fails, module not found.

- [x] **Step 3: Implement**

```ts
import { useCallback, useReducer, useRef } from 'react'

/** Undo/redo history for a single value. Pure reducer so it can be unit-tested. */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Which field the last `set` came from and when — used to merge keystrokes into one step. */
  lastKey: string | null
  lastAt: number
}

export type HistoryAction<T> =
  | { type: 'set'; value: T; key?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T }
  /** End a coalesced run (e.g. pointer-up after a drag) so the next edit is a new undo step. */
  | { type: 'seal' }

const MAX_PAST = 100
const COALESCE_MS = 800

export function initialHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [], lastKey: null, lastAt: 0 }
}

export function historyReducer<T>(h: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const merge =
        action.key !== undefined && action.key === h.lastKey && action.at - h.lastAt < COALESCE_MS
      const past = merge ? h.past : [...h.past, h.present].slice(-MAX_PAST)
      return { past, present: action.value, future: [], lastKey: action.key ?? null, lastAt: action.at }
    }
    case 'undo': {
      if (h.past.length === 0) return h
      const previous = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastKey: null, lastAt: 0 }
    }
    case 'redo': {
      if (h.future.length === 0) return h
      const [next, ...rest] = h.future
      return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 }
    }
    case 'reset':
      return initialHistory(action.value)
    case 'seal':
      return h.lastKey === null ? h : { ...h, lastKey: null, lastAt: 0 }
  }
}

/**
 * Undo/redo for an editor value. `set(value, key)` — pass the field key so a
 * run of keystrokes in one input collapses into a single undo step.
 */
export function useHistory<T>(initial: T) {
  const [h, dispatch] = useReducer(historyReducer<T>, initial, initialHistory)
  const set = useCallback((value: T, key?: string) => dispatch({ type: 'set', value, key, at: Date.now() }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), [])
  const seal = useCallback(() => dispatch({ type: 'seal' }), [])
  // Stable identity for consumers that only need the value in callbacks.
  const ref = useRef(h.present)
  ref.current = h.present
  return { value: h.present, set, undo, redo, reset, seal, canUndo: h.past.length > 0, canRedo: h.future.length > 0, ref }
}
```

Note: `useReducer(historyReducer<T>, …)` — if TypeScript complains about the generic instantiation, wrap: `const reducer = historyReducer as (h: History<T>, a: HistoryAction<T>) => History<T>`.

- [x] **Step 4: Run**: `npm test` → all pass.
- [x] **Step 5: Commit**: `git add components/postcards/useHistory.ts components/postcards/__tests__/ && git commit -m "Add undo/redo history reducer and hook"`

### Task B3: Front/back toggle + undo/redo in the editor

**Files:**
- Modify: `components/postcards/SvgTemplateEditor.tsx`

- [x] **Step 1: Swap `values` state for `useHistory`**

Replace `const [values, setValues] = useState<TemplateValues | null>(null)` with:

```ts
const history = useHistory<TemplateValues | null>(null)
const values = history.value
/** Every form edit goes through here so it lands in the undo stack. */
function edit(key: keyof TemplateValues, next: string) {
  if (!values) return
  history.set({ ...values, [key]: next }, key)
}
```

Then: `chooseTemplate` → `history.reset({ ...t.defaults })`; `resetToDefaults` → `history.set({ ...template.defaults })` (so Reset itself is undoable — Freddie's complaint was losing work); "All templates" → `history.reset(null)`; every `onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}` → `onChange={(e) => edit(field.key, e.target.value)}`; the two accent inputs → `edit('accent', e.target.value)`.

- [x] **Step 2: Keyboard shortcuts** (inside the component, after the hooks):

```ts
useEffect(() => {
  if (!template) return
  function onKey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
    e.preventDefault() // take over from the input's native undo so the two never disagree
    if (e.shiftKey) history.redo()
    else history.undo()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [template, history.undo, history.redo])
```

Import `useEffect` is already there. `history.undo`/`redo` are stable (`useCallback` with no deps).

- [x] **Step 3: Toolbar**: replace the top row (lines 332-349) with Back | Undo | Redo | Reset:

```tsx
<div className="flex items-center justify-between gap-3">
  <Button variant="ghost" size="sm" onClick={() => guard(() => history.reset(null))} className="-ml-2 text-slate-500 hover:text-slate-900">
    <ArrowLeft className="mr-1.5 h-4 w-4" />
    All templates
  </Button>
  <div className="flex items-center gap-1">
    <Button variant="ghost" size="sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo (⌘Z)" className="text-slate-500 hover:text-slate-900">
      <Undo2 className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" className="text-slate-500 hover:text-slate-900">
      <Redo2 className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-slate-500 hover:text-slate-900">
      <RotateCcw className="mr-1.5 h-4 w-4" />
      Reset
    </Button>
  </div>
</div>
```

Import `Undo2, Redo2` from `lucide-react`. `guard` comes from props in Task B5; until then use `const guard = (fn: () => void) => fn()` and replace in B5.

- [x] **Step 4: Toggle preview**. Add `const [side, setSide] = useState<'front' | 'back'>('front')`. Replace the two-figure grid (lines 354-369) with one large card and a segmented control:

```tsx
<div className="flex items-center justify-center">
  <div role="tablist" aria-label="Postcard side" className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-sm">
    {(['front', 'back'] as const).map((s) => (
      <button
        key={s}
        role="tab"
        type="button"
        aria-selected={side === s}
        onClick={() => setSide(s)}
        className={`rounded px-4 py-1.5 font-medium transition ${
          side === s ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        {s === 'front' ? 'Front' : 'Back'}
      </button>
    ))}
  </div>
</div>
<figure className="space-y-1.5">
  <Card className="overflow-hidden">
    <SvgFrame svgString={side === 'front' ? previewSvg : previewBackSvg} />
  </Card>
  <figcaption className="text-center text-xs font-medium text-slate-500">
    {side === 'front' ? 'Front' : 'Back · right half kept clear for the address'}
  </figcaption>
</figure>
```

- [x] **Step 5: Flip the preview to the side being edited.** On each front field `<Input>` add `onFocus={() => setSide('front')}`; on the accent inputs too; on each back field input/textarea add `onFocus={() => setSide('back')}`. This is the bit that fixes "hard to see what I'm editing".

- [x] **Step 6: Check the preview column is still `lg:sticky lg:top-4`** so it stays in view while scrolling the form on desktop; on mobile it's `order-first`, above the form, and the toggle keeps it to one card's height.

- [x] **Step 7: Build, lint, look at it**. `npm run build && npx eslint app lib components`. In the browser: type in a field → preview updates; ⌘Z steps back a word-ish, not a character; Undo/Redo buttons enable/disable correctly; Reset then ⌘Z restores your text; focusing a back field flips to Back; at 390px nothing overflows.

- [x] **Step 8: Commit**: `git commit -am "Editor: front/back preview toggle and undo/redo"`

### Task B4: Leave guard hook and dialog

**Files:**
- Create: `components/ui/alert-dialog.tsx` via `npx shadcn@latest add alert-dialog` (accept defaults; it uses the `radix-ui` package already installed. If the CLI wants to change `components.json` or other files, revert those — only the new file should land).
- Create: `components/postcards/useLeaveGuard.ts`
- Create: `components/postcards/ConfirmLeaveDialog.tsx`
- Test: `components/postcards/__tests__/useLeaveGuard.test.ts` for the pure link filter.

- [x] **Step 1: Failing test for the pure "should this link be intercepted" function**

```ts
import { describe, it, expect } from 'vitest'
import { isInAppNavigation } from '../useLeaveGuard'

const here = new URL('https://housepost.co.uk/postcards/design')

describe('isInAppNavigation', () => {
  it('intercepts same-origin path changes', () => {
    expect(isInAppNavigation(new URL('https://housepost.co.uk/dashboard'), here)).toBe(true)
  })
  it('ignores external links, hash links and the same page', () => {
    expect(isInAppNavigation(new URL('https://stannp.com/'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design#top'), here)).toBe(false)
    expect(isInAppNavigation(new URL('https://housepost.co.uk/postcards/design'), here)).toBe(false)
  })
})
```

- [x] **Step 2: `npm test`** → fails.

- [x] **Step 3: Implement the hook**

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** True for a click that would leave this page for another page in the app. */
export function isInAppNavigation(target: URL, current: URL): boolean {
  if (target.origin !== current.origin) return false
  return target.pathname + target.search !== current.pathname + current.search
}

/**
 * "You have unsaved changes" guard. While `dirty`:
 * - the browser asks before closing/reloading the tab;
 * - clicks on in-app links (sidebar etc.) are held until the user confirms;
 * - `guard(action)` holds any in-page action (back buttons) the same way.
 * When not dirty, `guard` just runs the action.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter()
  const [pending, setPending] = useState<(() => void) | null>(null)

  const guard = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action)
      else action()
    },
    [dirty]
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // legacy browsers need a value to show the prompt
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const target = new URL(anchor.href, window.location.href)
      if (!isInAppNavigation(target, new URL(window.location.href))) return
      // Capture phase, so this runs before Next's <Link> handler.
      e.preventDefault()
      e.stopPropagation()
      const href = target.pathname + target.search
      setPending(() => () => router.push(href))
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, router])

  const confirm = useCallback(() => {
    const action = pending
    setPending(null)
    action?.()
  }, [pending])
  const cancel = useCallback(() => setPending(null), [])

  return { guard, open: pending !== null, confirm, cancel }
}
```

- [x] **Step 4: The dialog**

```tsx
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function ConfirmLeaveDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits to this postcard haven&apos;t been saved. If you leave now they&apos;ll be lost. Click
            &ldquo;Use this design&rdquo; first to keep them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Leave anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [x] **Step 5: `npm test`** passes; `npm run build && npx eslint app lib components` clean.
- [x] **Step 6: Commit**: `git add components/ui/alert-dialog.tsx components/postcards/useLeaveGuard.ts components/postcards/ConfirmLeaveDialog.tsx components/postcards/__tests__/useLeaveGuard.test.ts && git commit -m "Add unsaved-changes leave guard and dialog"`

### Task B5: Wire the guard through the page and editor

**Files:**
- Modify: `app/(portal)/postcards/design/page.tsx`
- Modify: `components/postcards/SvgTemplateEditor.tsx`

- [x] **Step 1: Editor reports dirty and accepts `guard`**. Add props:

```ts
/** Called whenever the editor has unsaved edits (or stops having them). */
onDirtyChange?: (dirty: boolean) => void
/** Wrap navigation away from the editor so the page can ask about unsaved edits. */
guard?: (action: () => void) => void
```

Add both to the existing destructured props (`{ onUseUpload, onAddBack, onBackToOptions, onDirtyChange, guard: guardProp }`), then `const guard = guardProp ?? ((fn: () => void) => fn())`. Track what's saved:

```ts
// JSON of the values as last chosen/saved; dirty = current values differ from it.
const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
const dirty = values !== null && savedSnapshot !== null && JSON.stringify(values) !== savedSnapshot
useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]) // unmount clears it
```

In `chooseTemplate`: `setSavedSnapshot(JSON.stringify(t.defaults))`. After a successful save in `handleUse` (next to `setSavedUrl(frontUrl)`): `setSavedSnapshot(JSON.stringify(values))`. "All templates" already goes through `guard` (B3 step 3) — after confirming, also `setSavedSnapshot(null)`.

- [x] **Step 2: Page owns the guard and dialog**

```tsx
const [editorDirty, setEditorDirty] = useState(false)
const leave = useLeaveGuard(editorDirty)
```

"All design options" button: `onClick={() => leave.guard(() => setOption(null))}`. Editor: `<SvgTemplateEditor … onDirtyChange={setEditorDirty} guard={leave.guard} />`. Render `<ConfirmLeaveDialog open={leave.open} onConfirm={leave.confirm} onCancel={leave.cancel} />` once at the bottom of the page's root div. `setEditorDirty` is a stable state setter, so the editor's effect deps are fine.

- [x] **Step 3: Verify in the browser**: edit a field, then (a) click a sidebar link → dialog; "Keep editing" stays; "Leave anyway" navigates; (b) click "All templates" → dialog; (c) click "All design options" → dialog; (d) reload the tab → browser's native prompt; (e) click "Use this design" → after the toast, none of the above prompt any more; (f) pick a template and change nothing → no prompts. Check at 390px the dialog fits.

- [x] **Step 4: Build, lint, test, commit**: `npm run build && npx eslint app lib components && npm test` then `git commit -am "Ask before leaving the template editor with unsaved edits"`.

### Task B6: Open PR-B

- [x] Push `claude/editor-ux`; PR to `main` titled "Template editor: front/back toggle, undo/redo, unsaved-changes guard". Body: the three behaviours, keyboard shortcuts, a desktop screenshot of the toggle + toolbar, a 390px screenshot, and a screenshot of the dialog. Note that Vitest was added and how to run it.

---

## Workstream C — Logo overlay: drag and resize on either side

Freddie wants a logo; Benjy wants it freely positioned and resized, front or back or neither. **Verdict from the code read: viable, no new dependency.** Reasons:

1. **Export.** Templates are SVG strings rasterised by drawing the SVG into a `<canvas>` (`svgToPngBlob`, `SvgTemplateEditor.tsx:33`). An `<image href="data:image/png;base64,…">` inside that SVG renders in every current browser and does **not** taint the canvas, because nothing is fetched cross-origin. So the overlay is appended to the SVG string at export time; no template renderer changes.
2. **Interaction.** The live preview is a scaled box with the card's exact aspect ratio, so an HTML layer positioned in percentages maps 1:1 onto viewBox units. Pointer events (mouse + touch) with `touch-action: none` give drag and a corner-handle resize in ~150 lines. No library; `react-easy-crop` (installed) is for cropping, not this.
3. **PDF logos.** `pdfjs-dist` is already installed and its worker is copied to `/pdf.worker.min.mjs` on every build; `UploadCustomDesign.tsx:352-357` shows the exact import pattern. Render page 1 to a canvas → PNG data URL.
4. **Print quality.** Keep the uploaded bitmap up to 2400px on its longest edge (a 2400px logo covers the full 1819px card at 300 DPI); only downscale above that. Never re-encode a PNG as JPEG.

Two constraints worth knowing: the back overlay is clamped to the left half (fold at 910; safe right edge 840) so it can never sit in the printer's address area; and the preview does not embed the image in the SVG during editing (rebuilding a multi-MB SVG string on every pointer move would stutter) — the HTML layer shows the image, the SVG gets it only at export. Both layers derive from one state, so they can't drift.

### File structure

- Create `components/postcards/logo/types.ts` — `LogoOverlay` type + geometry helpers (`clampOverlay`, `defaultPlacement`). Pure.
- Create `components/postcards/logo/inject.ts` — `injectOverlay(svg, overlay)`. Pure.
- Create `components/postcards/logo/load-logo-file.ts` — file → `{ src, naturalW, naturalH }` (PNG/JPG/SVG/PDF). DOM + pdfjs.
- Create `components/postcards/logo/LogoLayer.tsx` — the drag/resize HTML layer.
- Modify `components/postcards/SvgTemplateEditor.tsx` (Task C5 only, on top of Workstream B).
- Tests: `components/postcards/__tests__/logo.test.ts` (needs Vitest from B1 — if B hasn't landed when you start, run B1's steps on your branch; the package.json conflict on rebase is one line).

### Task C1: Spike — prove the export path renders an embedded image

Ten minutes that de-risks the whole workstream. No repo changes.

- [x] **Step 1:** Write `<scratchpad>/logo-spike.html` containing a `<script>` that builds an SVG string `1819×1311` with a coloured rect and an `<image x="100" y="100" width="600" height="300" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" preserveAspectRatio="none"/>`, then runs the exact body of `svgToPngBlob` (copy from `SvgTemplateEditor.tsx:33-65`), and on success appends `<img src=URL.createObjectURL(blob)>` to the body and logs `blob.size`.
- [x] **Step 2:** Open it in the built-in browser (`navigate` to the `file://` path). Expected: the PNG appears with a visible 600×300 red block at (100,100); console shows a non-zero size and no "tainted" error.
- [x] **Step 3:** Repeat with `href` set to a data-URI **SVG** (`data:image/svg+xml;utf8,<svg xmlns=…><circle …/></svg>`). Expected: renders too. If it doesn't, drop SVG from the accepted upload types (PNG/JPG/PDF only) and say so in the PR.
- [x] **Step 4:** The built-in browser is Chromium. Firefox is the one that has historically refused nested `<image>` inside an SVG drawn to canvas — if Firefox is installed, open the same file there; either way, say in the PR which browsers were checked.

### Task C2: Overlay type, geometry and injection (pure, tested)

**Files:**
- Create: `components/postcards/logo/types.ts`, `components/postcards/logo/inject.ts`
- Test: `components/postcards/__tests__/logo.test.ts`

- [x] **Step 1: Failing tests**

```ts
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
```

- [x] **Step 2:** `npm test` → fails.

- [x] **Step 3: Implement `types.ts`**

```ts
import { CARD_W, CARD_H, HALF_W } from '../svg-templates/helpers'

export type CardSide = 'front' | 'back'

/** A user image laid over one side of the card. Units are card px (1819×1311). Height follows the aspect ratio. */
export interface LogoOverlay {
  side: CardSide
  /** Data URL (png/jpeg/svg). Never a remote URL — remote images would taint the export canvas. */
  src: string
  naturalW: number
  naturalH: number
  x: number
  y: number
  w: number
}

export const SAFE = 71
export const MIN_W = 80
/** Right-most usable x on the back: the fold is at HALF_W, keep a gutter before it. */
export const BACK_SAFE_RIGHT = HALF_W - 70 // 840

export function overlayHeight(o: Pick<LogoOverlay, 'w' | 'naturalW' | 'naturalH'>): number {
  return (o.w * o.naturalH) / o.naturalW
}

function bounds(side: CardSide) {
  return { left: SAFE, top: SAFE, right: side === 'back' ? BACK_SAFE_RIGHT : CARD_W - SAFE, bottom: CARD_H - SAFE }
}

/** Keep the box fully inside the safe area for its side; keep width sane. */
export function clampOverlay(o: LogoOverlay): LogoOverlay {
  const b = bounds(o.side)
  const maxW = b.right - b.left
  const w = Math.min(Math.max(o.w, MIN_W), maxW)
  const h = overlayHeight({ ...o, w })
  const x = Math.min(Math.max(o.x, b.left), b.right - w)
  const y = Math.min(Math.max(o.y, b.top), Math.max(b.top, b.bottom - h))
  return { ...o, x, y, w }
}

/** Where a freshly added logo lands: top-right of the usable area, 360px wide. */
export function defaultPlacement(side: CardSide, src: string, naturalW: number, naturalH: number): LogoOverlay {
  const b = bounds(side)
  return clampOverlay({ side, src, naturalW, naturalH, w: 360, x: b.right - 360, y: b.top })
}
```

Check `HALF_W` is exported from `helpers.ts` (it is, line 135).

- [x] **Step 4: Implement `inject.ts`**

```ts
import { CARD_H, HALF_W, escapeXml } from '../svg-templates/helpers'
import { overlayHeight, type LogoOverlay } from './types'

/**
 * Append the logo to a rendered card SVG so the export picks it up. On the back
 * it is wrapped in the same left-half clip the templates use, so it can never
 * print over the address area.
 */
export function injectOverlay(svg: string, o: LogoOverlay | null): string {
  if (!o) return svg
  const end = svg.lastIndexOf('</svg>')
  if (end === -1) return svg
  const h = Math.round(overlayHeight(o))
  const image = `<image x="${Math.round(o.x)}" y="${Math.round(o.y)}" width="${Math.round(o.w)}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(o.src)}"/>`
  const markup =
    o.side === 'back'
      ? `<svg x="0" y="0" width="${HALF_W}" height="${CARD_H}" viewBox="0 0 ${HALF_W} ${CARD_H}" overflow="hidden">${image}</svg>`
      : image
  return svg.slice(0, end) + markup + svg.slice(end)
}
```

- [x] **Step 5:** `npm test` → passes. Commit: `git add components/postcards/logo components/postcards/__tests__/logo.test.ts && git commit -m "Logo overlay: geometry and SVG injection"`

### Task C3: Turn an uploaded file into an overlay source

**Files:**
- Create: `components/postcards/logo/load-logo-file.ts`

- [x] **Step 1: Implement**

```ts
/** Accepted logo uploads. PDFs are rasterised (page 1); everything else is embedded as-is. */
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/svg+xml,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024
/** Longest edge kept for bitmaps: enough to cover the whole 1819px card at 300 DPI. */
const MAX_EDGE = 2400

export interface LogoSource {
  src: string
  naturalW: number
  naturalH: number
}

export async function loadLogoFile(file: File): Promise<LogoSource> {
  if (file.size > MAX_BYTES) throw new Error('Logo must be under 10 MB')
  if (file.type === 'application/pdf') return pdfToSource(file)
  if (!LOGO_ACCEPT.split(',').includes(file.type)) throw new Error('Use a PNG, JPG, SVG or PDF')
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)
  if (file.type === 'image/svg+xml' || Math.max(img.naturalWidth, img.naturalHeight) <= MAX_EDGE) {
    return { src: dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
  }
  return downscale(img)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not a valid image'))
    img.src = src
  })
}

/** Shrink an oversized bitmap to MAX_EDGE; always PNG so transparency survives. */
function downscale(img: HTMLImageElement): LogoSource {
  const scale = MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, w, h)
  return { src: canvas.toDataURL('image/png'), naturalW: w, naturalH: h }
}

async function pdfToSource(file: File): Promise<LogoSource> {
  // Same lazy import + worker path the custom-design uploader uses.
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = MAX_EDGE / Math.max(base.width, base.height)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  await page.render({ canvas, viewport }).promise // pdfjs 5 signature, same as UploadCustomDesign.tsx:373
  return { src: canvas.toDataURL('image/png'), naturalW: canvas.width, naturalH: canvas.height }
}
```

(`ctx` is then unused in `pdfToSource` — drop those two lines there; keep them in `downscale`.)

- [x] **Step 2:** `npx eslint components/postcards/logo` clean; `npx tsc --noEmit -p .` clean (or `npm run build`). Commit: `git add components/postcards/logo/load-logo-file.ts && git commit -m "Logo overlay: load PNG/JPG/SVG/PDF as an embedded image"`

### Task C4: The drag/resize layer

**Files:**
- Create: `components/postcards/logo/LogoLayer.tsx`

- [x] **Step 1: Implement**

```tsx
'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { CARD_W, CARD_H } from '../svg-templates/helpers'
import { clampOverlay, overlayHeight, type LogoOverlay } from './types'

/**
 * Sits over the SVG preview and lets the user drag and resize their logo.
 * Positions are percentages of the card, so the box lines up with where the
 * <image> lands in the export regardless of preview size.
 */
export function LogoLayer({
  overlay,
  onChange,
  onRemove,
}: {
  overlay: LogoOverlay
  /** Called on every pointer move with `commit` false; once on pointer-up with `commit` true (the value is unchanged then — it just closes the undo step). */
  onChange: (next: LogoOverlay, commit: boolean) => void
  onRemove: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: LogoOverlay } | null>(null)

  /** Card px per screen px, from the layer's rendered width. */
  function scale() {
    const width = layerRef.current?.getBoundingClientRect().width ?? CARD_W
    return CARD_W / width
  }

  function begin(mode: 'move' | 'resize') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      gesture.current = { mode, startX: e.clientX, startY: e.clientY, start: overlay }
    }
  }

  function move(e: React.PointerEvent) {
    e.stopPropagation() // the resize handle is inside the box; don't let one move fire twice
    const g = gesture.current
    if (!g) return
    const k = scale()
    const dx = (e.clientX - g.startX) * k
    const dy = (e.clientY - g.startY) * k
    const next =
      g.mode === 'move'
        ? { ...g.start, x: g.start.x + dx, y: g.start.y + dy }
        : { ...g.start, w: g.start.w + Math.max(dx, dy * (g.start.naturalW / g.start.naturalH)) }
    onChange(clampOverlay(next), false)
  }

  function end(e: React.PointerEvent) {
    e.stopPropagation()
    if (!gesture.current) return
    gesture.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    onChange(overlay, true)
  }

  const h = overlayHeight(overlay)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      <div
        role="img"
        aria-label="Your logo — drag to move, use the corner to resize"
        className="group pointer-events-auto absolute cursor-move touch-none select-none outline outline-1 outline-dashed outline-transparent hover:outline-blue-400 focus-visible:outline-blue-500"
        style={{ left: pct(overlay.x, CARD_W), top: pct(overlay.y, CARD_H), width: pct(overlay.w, CARD_W), height: pct(h, CARD_H) }}
        tabIndex={0}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={overlay.src} alt="" draggable={false} className="h-full w-full object-contain" />
        <button
          type="button"
          aria-label="Remove logo"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -right-2.5 -top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow group-hover:flex group-focus-visible:flex"
        >
          <X className="h-3 w-3" />
        </button>
        <span
          aria-hidden
          onPointerDown={begin('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-blue-500 shadow"
        />
      </div>
    </div>
  )
}
```

`object-contain` in the HTML layer and `preserveAspectRatio="xMidYMid meet"` in the export are the same rule, and because `w`/`h` already match the natural ratio neither has anything to letterbox — they will agree to the pixel.

- [x] **Step 2:** `npx eslint components/postcards/logo` clean; build. Commit: `git add components/postcards/logo/LogoLayer.tsx && git commit -m "Logo overlay: drag and resize layer"`

### Task C5: Integrate into the editor (after rebasing onto `claude/editor-ux`)

- [x] **Step 0:** `git fetch origin && git rebase origin/claude/editor-ux` (resolve the one-line `package.json`/lockfile conflict if you added Vitest yourself: keep B's). Confirm `npm test` still passes.

**Files:**
- Modify: `components/postcards/SvgTemplateEditor.tsx`

- [x] **Step 1: State.** The editor's history value becomes `{ values: TemplateValues; logos: { front: LogoOverlay | null; back: LogoOverlay | null } }` — one undo stack for both, so ⌘Z after a drag undoes the drag. Concretely: change the `useHistory<TemplateValues | null>` generic to `useHistory<EditorState | null>` with

```ts
interface EditorState { values: TemplateValues; logos: Record<CardSide, LogoOverlay | null> }
```

`chooseTemplate` → `history.reset({ values: { ...t.defaults }, logos: { front: null, back: null } })`; `edit()` spreads `values`; `resetToDefaults` keeps `logos` (Reset is about the text). Everywhere that read `values` now reads `state.values`.

The `dirty` snapshot must **not** be `JSON.stringify(state)` — a logo `src` is a multi-MB data URL and this runs on every render, including every pointer move. Use a cheap fingerprint:

```ts
function fingerprint(s: EditorState): string {
  const logo = (o: LogoOverlay | null) => (o ? `${Math.round(o.x)},${Math.round(o.y)},${Math.round(o.w)},${o.src.length}` : '')
  return JSON.stringify(s.values) + '|' + logo(s.logos.front) + '|' + logo(s.logos.back)
}
```

and compare `fingerprint(state)` against the saved fingerprint (set it in `chooseTemplate` and after a successful save, as B5 does with the JSON).

- [x] **Step 2: Rendering.** Preview SVGs stay logo-free (see the verdict above). Export becomes:

```ts
svgToPngBlob(injectOverlay(template.render(values), logos.front)),
svgToPngBlob(injectOverlay(template.renderBack(values), logos.back)),
```

- [x] **Step 3: Preview.** The layer must be positioned against the SVG box itself, **not** the `Card` — `Card` has `py-6` padding (`components/ui/card.tsx:10`), so an `absolute inset-0` sibling of `SvgFrame` would be 48px taller than the card art and every vertical percentage would land in the wrong place. Give `SvgFrame` a `children` slot and make it `relative`:

```tsx
function SvgFrame({ svgString, className, children }: { svgString: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-white ${className ?? ''}`} style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}>
      <div className="[&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svgString }} />
      {children}
    </div>
  )
}
```

then in the preview figure:

```tsx
<Card className="overflow-hidden">
  <SvgFrame svgString={side === 'front' ? previewSvg : previewBackSvg}>
    {logos[side] && (
      <LogoLayer
        overlay={logos[side]!}
        onChange={(next, commit) => setLogo(side, next, commit)}
        onRemove={() => removeLogo(side)}
      />
    )}
  </SvgFrame>
</Card>
```

with

```ts
function setLogo(s: CardSide, next: LogoOverlay, commit: boolean) {
  if (!state) return
  if (commit) {
    // Pointer-up: the value hasn't changed since the last move; just close the undo step.
    history.seal()
    return
  }
  // Every move in one gesture shares a key, so the whole drag is one undo step.
  history.set({ ...state, logos: { ...state.logos, [s]: next } }, `logo-${s}`)
}
function addLogo(s: CardSide, o: LogoOverlay) {
  if (state) history.set({ ...state, logos: { ...state.logos, [s]: o } })
}
function removeLogo(s: CardSide) {
  if (state) history.set({ ...state, logos: { ...state.logos, [s]: null } })
}
```

Why `seal` and not a plain `set` on pointer-up: an un-keyed `set` never merges, so it would push the final drag position onto `past` as its own step and the first ⌘Z would appear to do nothing. (The coalesce window is 800ms between moves; a slow drag still merges because each move is within 800ms of the previous one.)

- [x] **Step 4: Upload control.** Under the segmented control add:

```tsx
<div className="flex items-center justify-center gap-2 text-xs text-slate-500">
  <input ref={logoInputRef} type="file" accept={LOGO_ACCEPT} className="hidden" onChange={handleLogoFile} />
  {logos[side] ? (
    <>
      <span>Drag your logo to move it, use the corner to resize.</span>
      <button type="button" className="underline" onClick={() => logoInputRef.current?.click()}>Replace</button>
      <button type="button" className="underline" onClick={() => removeLogo(side)}>Remove</button>
    </>
  ) : (
    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
      <ImagePlus className="mr-1.5 h-4 w-4" />
      Add your logo to the {side}
    </Button>
  )}
</div>
```

```ts
async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !state) return
  try {
    const src = await loadLogoFile(file)
    addLogo(side, defaultPlacement(side, src.src, src.naturalW, src.naturalH))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not load that logo')
  }
}
```

Import `ImagePlus` from lucide and add `useRef` to the React import on line 3. Also update the confirmation-step copy and the "Text is kept inside the safe margin…" note to mention the logo is kept inside the safe area too, and off the address half on the back.

- [x] **Step 5: Browser verification** (desktop and 390px): add a PNG to the front → lands top-right; drag it → it moves and stops at the safe edge; corner-resize → aspect stays; ⌘Z → drag undone; switch to Back, add the same PNG → it cannot be dragged past the fold; add a PDF logo → renders; add an oversized JPG → still sharp; click "Use this design" → open the saved front PNG via "View file" and check the logo is where the preview showed it, crisp, and on the back it's left of the fold. Remove → gone from export. On a phone width, drag with touch (or the browser's touch emulation) works.

- [x] **Step 6:** `npm run build && npx eslint app lib components && npm test`. Commit: `git commit -am "Template editor: add, drag and resize a logo on either side"`

### Task C6 (stretch, only if C5 is done and verified): Remember the last logo

Store the loaded source at `postcard-designs/${userId}/logo` on save (same bucket/options as the design PNGs; keep the file's content type); on mount, `storage.from('postcard-designs').list(userId)` for `logo*`, fetch it → data URL → offer "Use your saved logo" next to "Add your logo". No profile column, no migration. Skip if anything about it is awkward; it's not in Freddie's ask.

### Task C7: Open PR-C

- [x] Push `claude/logo-overlay`; PR with base `claude/editor-ux`, retarget to `main` once PR-B merges. Body: what it does, the accepted formats and size rule, the "clamped off the address half" guarantee, a short screen recording or before/after screenshots of drag + export, and the spike result from C1.

---

## Final checks before telling Freddie it's live

- [ ] Each PR's Vercel preview (or local run) checked at desktop and ~390px, screenshots in the PR.
- [ ] PRs merged in order A → B → D → C; `main` builds.
- [ ] Deploy (`vercel --prod` if the Hobby build cap allows; otherwise the merge's own production build).
- [ ] Freddie-facing note: one or two plain sentences per change plus the live URL `/postcards/design`. No branch names, no diffs.
