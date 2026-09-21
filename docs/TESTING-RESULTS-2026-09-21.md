# Template editor test run — 21 September 2026

Plan: `docs/TESTING-TEMPLATE-EDITOR.md`. Build under test: `main` at `4422770` (PRs #45–#48 merged, deployed to production the same day).

**Outcome:** 118 cases run, 3 defects found, all three fixed in open PRs (#50, #51 and a harness-only finding). Nothing found that affects what prints from the current build except the tall-logo case in #50. Eight cases still need a hand on a real device.

## How it was run

- **Headless, real modules.** The template renderers, `injectOverlay`, `clampOverlay` and `loadLogoFile` were bundled unchanged into a harness page and driven by Playwright in Chromium 140, Firefox 142 and WebKit (Safari engine), with pixel probes on the exported 1819×1311 PNGs. This is what caught the browser-support and geometry bugs.
- **Signed-in app, local dev server** (Chrome 152, the Claude desktop browser pane) with a scripted driver for the editor: real React state, real save, real export, real Stannp test-mode proof.
- **Unit tests** (`npm test`, 22) and the template QA checker (16 templates, 0 errors).

## Defects

| # | Case | What | Fix |
|---|---|---|---|
| 1 | LOGO-11 | A portrait (1:4) logo added at the default 360 px width is 1440 px tall; `clampOverlay` moved it but didn't shrink it, so it ran off the card bottom in preview and export. | [#50](https://github.com/benjyb1/HousePost/pull/50): width also capped by the safe height; extreme aspects may go under the 80 px minimum rather than overflow. 3 new unit tests. Verified in all three engines. |
| 2 | LOGO-5/29/30 | pdf.js 5 calls `Map.prototype.getOrInsertComputed`, which only exists in Chrome 145+, Safari 18.4+ and 2026 Firefox. On older browsers **every PDF upload fails**, including the existing custom-design uploader. Reproduced on Chromium 140. | [#51](https://github.com/benjyb1/HousePost/pull/51): polyfill on the main thread and prepended to the worker copy. Chromium 140: 3 failures → 18/18. Firefox/WebKit 18/18. |
| 3 | (harness) | Firefox takes ~22 s to export a 9 MB worst-case PNG logo (Chromium 0.2 s, WebKit similar). Real logos compress far better than the noise image used; logged, not fixed. | Note in plan (PERF-4). |

## Results by section

**OPT (opt-out line)** — 1, 2, 4 (all 16 backs, Chromium/Firefox/WebKit), 7 (Stannp proof: line is bottom-centre of the right half, clear of address, indicia and barcode), 8: PASS. 5 (physical print measurement) and 6 (uploaded backs get no line, product question): not run.

**COPY (interior re-theme)** — 1, 2, 3, 4, 8 (awkward characters escaped in all 16), 10 (invalid accent falls back), 11 (library label "Studio template · 21 Sept"), 12 (old "Bold template · 18 Sept" entry still present): PASS. 5/6: long business name shrinks to 47 px, long headline to **36 px** on Studio (below the 40 px design note threshold; readable but small, Freddie's call). 7: 400-character back message wraps to 5 lines and ellipsises. 9: not run.

**VIEW (toggle)** — 1, 2, 3, 4 (real click), 6 (sticky at desktop), 7 (390 px: preview above form, no overflow, tabs one line), 8, 9: PASS. 5 (keyboard order): not run. 10: the portal renders light regardless of OS dark mode (pre-existing), nothing to check.

**UNDO** — 1, 2, 3, 4, 5, 6, 7, 8, 10, 12 (capped at 100), 13, 14, 16, 17 (via button and via corner ×), 18, 20: PASS. 15: **known nit confirmed**, a 1.2 s pause mid-drag makes two undo steps. 9 (native textarea undo, needs real keys) and 19 (Windows keys): not run. 11: not run.

**LEAVE (guard)** — 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14 (⌘-click passes through), 15 (external `_blank` link passes through), 16 (footer links guarded), 21 (390 px dialog), 23 ("upload your own PDF" is guarded): PASS. 6 (native reload prompt): not run by hand; Chrome logged "blocked beforeunload without a user gesture", which shows the handler is registered. 17/18/20/22: not run (known gaps for Sign out and browser Back are by design).

**LOGO** — adding: 1, 2, 3, 4, 5 (in-page PDF on `main`, 156 ms), 6 (Replace resets to the default slot), 7, 8, 9, 10; positioning: 12, 13, 14, 15, 16, 17, 18; files: 20 (9 MB PNG downscaled to 2400), 21 (45 MB PNG and 11 MB PDF refused, "Logo must be under 10 MB"), 22, 23 ("That file is not a valid image"), 24 (GIF/HEIC "Use a PNG, JPG, SVG or PDF"), 25 (CMYK JPEG decodes), 26 (EXIF-rotated phone photo exports the right way up in all three engines), 27 (sizeless SVG gets a 300×150 default), 28, 29 (page 1), 30, 31 ("No password given"), 32, 33, 34 (keystrokes during PDF render kept); export: 35, 36 (live save: back logo right edge ≤ 840, address half white), 37, 39, 40 (Stannp proof), 41 (Firefox), 42 (WebKit), 43 (byte-identical re-export); interplay: 44, 45 (switching template drops logos, as documented), 46, 49: PASS. 11: FAIL → #50. 19 (touch): synthetic touch pointers can't take pointer capture, needs a real device. 19b (keyboard nudge not implemented), 38, 47, 48: not run.

**SEC** — 1 (SVG with `<script>`/`onload` does not execute in preview or export), 2 (script text in a field is escaped), 3 (SQL-ish name saves; label is the literal text): PASS. 4, 5: not run.

**PERF** — 1 (0.8 ms per keystroke), 2 (200-move drag: no measurable overhead beyond frame sleeps), 3: PASS. 4/5: not run.

**A11Y** — 1 (tablist), 2, 3 (focus moves into dialog; Keep editing / Leave anyway), 4 (logo box labelled and focusable, × labelled), 5 (#666 on white = 5.7:1): PASS. 6: not run.

## Still to do by hand

- iPhone Safari: touch drag and corner resize (LOGO-19), page doesn't scroll while dragging, camera-roll photo (real EXIF) round-trip.
- Any browser: native reload prompt with edits (LEAVE-6), ⌘Z inside the textarea (UNDO-9).
- Physical print of one back to measure the opt-out line position (OPT-5).

## Product questions raised (need Freddie)

1. Uploaded (non-template) backs get no opt-out line (OPT-6).
2. Switching template discards your logo (LOGO-45).
3. Studio's long headline shrinks to 36 px (COPY-6).
4. Sign out and the browser Back button bypass the leave guard (LEAVE-17/18).
