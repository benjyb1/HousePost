---
name: postcard-template-qa
description: Use when adding, editing or reviewing Housepost SVG postcard templates (components/postcards/svg-templates), or before shipping any template change — for text overflow, text clipping at the back fold, elements crossing the trim/bleed, and the back address area staying clear.
---

# Postcard template QA

## Overview

Housepost postcard templates are hand-built SVG at the A6-plus-bleed print spec
(1819×1311 @ 300 DPI). The auto-shrink helper (`fitSize`) estimates text width
with an optimistic glyph factor, so a line that "should" fit can still run past
the trim or clip at the back's fold. This skill catches that before it prints.

## When to use

- After editing `components/postcards/svg-templates/templates.ts`.
- Before merging or shipping a template change.
- When a card looks wrong: text cut off, running off the edge, crossing a frame.

## Print geometry (px @ 300 DPI)

- **Card incl. bleed:** 1819 × 1311.
- **Bleed:** 35px each edge, trimmed off — put nothing important here.
- **Trim (finished edge):** 35px in. Backgrounds may run to the card edge; nothing else should cross this.
- **Safe:** 71px in. Keep ALL text and logos inside this box.
- **Back fold:** x = 910. The design lives to the LEFT; the right half is the address area and must stay clear.

## Run it

```bash
npx tsx .claude/skills/postcard-template-qa/qa-templates.ts
```

It prints a per-template overflow report (each `<text>` measured with a
conservative glyph factor) and writes a contact sheet HTML (path is printed)
showing every front and back at BOTH default and stress-test (deliberately long)
content, with trim/safe/fold guides overlaid. Open it and check each card.

## Checklist — every template, front and back, at default AND stress values

- [ ] No text crosses the red trim line; all text sits inside the blue safe box.
- [ ] Back: no text clips at the fold (x=910); nothing sits in the shaded address half.
- [ ] Frames, rules and bars sit inside the trim, with a clear gutter (≥20px) from text.
- [ ] A long business name / headline / website still fits — that is what the stress pass is for.
- [ ] Contact details are legible and inside safe.

## Common defects and fixes

- **Text clips at the fold or runs off the edge** → the `fitSize` factor is too low. Raise it toward ~0.6 (serif and mono glyphs are wider) or drop the `maxWidth`, so the line shrinks sooner.
- **A rule or frame touches the border** → inset the decoration or pull the text/line margin in; leave a visible gutter.
- **Something in the back's right (address) half** → keep back content left of ~840px. The fold clip is a backstop, not a licence to overflow.

## Validate the checker first

Before trusting a clean report, confirm the checker still flags a known-bad case
— e.g. temporarily force a long `backHeadline` on a serif template like
`heritage`. If the report stays green, the glyph factor is too lenient; raise it.
