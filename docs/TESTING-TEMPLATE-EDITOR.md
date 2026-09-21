# Template editor: test and validation plan

Covers the six changes merged on 21 September 2026 (PRs #45, #46, #47, #48):
the opt-out line on every back, the interior-design re-theme, the front/back
preview toggle, undo/redo, the unsaved-changes guard, and the logo overlay.

The plan is written so someone who didn't build the feature can run it. Each
case has an ID, so a bug report can just say "LOGO-14 fails on iPhone Safari".
Expected results are stated; if the app does something else, that's a bug, even
if it looks reasonable.

## 1. Before you start

**Where to test.** Production (`housepost.co.uk/postcards/design`) once the
merge has deployed, or a local dev server. Never send a real card during
testing: "Use this design" only saves artwork, it does not post anything, but
stay off the send page unless Stannp is in test mode.

**Account.** Use a throwaway test user, not a customer. "Use this design"
overwrites that account's active front and back.

**Browsers and devices** (§10 has the matrix). At minimum: Chrome on a Mac,
Safari on an iPhone, Firefox on anything. Firefox is not optional for the logo
tests, it's the one browser that has historically refused to draw an SVG
containing a nested `<image>` onto a canvas.

**Test assets.** Put these in a folder before you begin:

| File | What it is | Used by |
|---|---|---|
| `logo-small.png` | 200×100 PNG, transparent background, coloured mark | most logo cases |
| `logo-huge.png` | 6000×3000 PNG, over 5 MB | LOGO-20, PERF-2 |
| `logo-tall.png` | 300×1200 PNG (portrait, 1:4) | LOGO-11 |
| `logo-wide.png` | 2400×100 PNG (24:1 strip) | LOGO-12 |
| `logo.jpg` | any JPEG, ~1500×800 | LOGO-3 |
| `logo-cmyk.jpg` | a CMYK JPEG (export from Photoshop / `convert in.jpg -colorspace CMYK out.jpg`) | LOGO-25 |
| `logo-exif.jpg` | phone photo with EXIF rotation = 6 (shot in portrait) | LOGO-26 |
| `logo.svg` | simple SVG with a `viewBox`, no external refs | LOGO-4 |
| `logo-nosize.svg` | SVG with **no** `width`/`height`/`viewBox` | LOGO-27 |
| `logo-external.svg` | SVG that references an external image or web font | LOGO-28 |
| `logo-script.svg` | SVG containing `<script>alert(1)</script>` | SEC-1 |
| `logo.pdf` | one-page vector PDF, landscape | LOGO-5 |
| `logo-multipage.pdf` | 3-page PDF with distinct pages | LOGO-29 |
| `logo-portrait.pdf` | one-page portrait PDF | LOGO-30 |
| `logo-locked.pdf` | password-protected PDF | LOGO-31 |
| `logo-11mb.pdf` | any PDF over 10 MB | LOGO-21 |
| `empty.png` | 0-byte file named `.png` | LOGO-22 |
| `fake.png` | a `.txt` renamed to `.png` | LOGO-23 |
| `photo.heic` | iPhone HEIC | LOGO-24 |
| `logo.gif`, `logo.webp` | any | LOGO-24 |

**Copy for stress tests** (paste exactly):

- Long business name: `Fitzwilliam-Ashcombe Bespoke Interior Design Studio Limited`
- Long headline: `WE JUST FINISHED A FULL TOP-TO-BOTTOM REDESIGN OF A HOUSE ON YOUR STREET`
- Long back message: 400 characters of any text, no line breaks.
- Awkward characters: `Smith & Jones <Interiors> "Quoted" 'Single' 50% off — café naïve 東京 🏠`
- Long website: `www.fitzwilliam-ashcombe-bespoke-interiors.co.uk`

## 2. Opt-out line (OPT)

The line is added once, in the shared `backSvg()` wrapper, so every template
gets it automatically. Position: centred on the right half (x = 1365 of 1819),
baseline 86 px above the bottom edge, 30 px Helvetica, colour `#666666`.

| ID | Steps | Expected |
|---|---|---|
| OPT-1 | Open each of the 16 templates, switch to Back | `housepost.co.uk/opt-out` visible at the bottom-centre of the right (white) half on every one |
| OPT-2 | Zoom in on the preview | Text is mid-grey, not black, not the accent colour; nothing from the left-half design overlaps it |
| OPT-3 | Pick the template with the darkest/busiest bottom band (Studio, Foundry) | The line still sits on white; the design's bottom band stops at the fold and does not run under it |
| OPT-4 | Click "Use this design", open the saved back PNG (from "View file", swap `design.png` → `design-back.png`) | Line present in the exported 1819×1311 PNG, crisp, same position |
| OPT-5 | Print that back PNG at 100% on A6 (or measure: baseline should be ~7.3 mm from the bottom edge) | Inside the safe area; above the 3 mm bleed + 3 mm safe margin |
| OPT-6 | Upload your own back PDF via "Upload custom design" | No opt-out line is added to uploaded backs (this feature is templates only). Confirm that's what we want; if uploaded backs also need it, that's a new task |
| OPT-7 | Order a proof from Stannp in test mode (see `docs/OPERATIONS.md`) | On the proof PDF the line does not touch the address block, indicia or barcode. Stannp's A6 template keeps the address clear zone above 9.19 cm from the top; our line is at ~10.2 cm |
| OPT-8 | Run `npx tsx .claude/skills/postcard-template-qa/qa-templates.ts` | 0 errors. The opt-out text is exempted from the fold check by its `id="opt-out"`; every other element in the right half is still an error |

Edge cases: the line is not user-editable and not affected by the accent colour,
Reset, undo or a logo. OPT-9: place a logo on the back, drag it as far right and
down as it goes; it must stop at x = 840 and never reach the line.

## 3. Interior-design re-theme (COPY)

Studio, Linen, Manor and Palette replaced Bold, Clean, Classic and Bright.
Atelier is also interior design and still exists.

| ID | Steps | Expected |
|---|---|---|
| COPY-1 | Open the template chooser | No template name, description or thumbnail mentions estate agents, valuations, "sold" or selling |
| COPY-2 | Open each of the four new templates | Default copy reads as an interior designer: consultation, room design, new home. Front and back |
| COPY-3 | Clear each field and read the placeholder | "Your business name", "What you do, in a line", "Free first consultation", "Just moved in?", "Book a free consultation". No "agency", no "valuation" |
| COPY-4 | Search the live page text for `estate`, `agency`, `valuation`, `agent` | No hits anywhere in the design flow, including the custom-design brief placeholder |
| COPY-5 | Paste the long business name into Studio, Linen, Manor and Palette; check front and back | Auto-shrinks to fit inside the safe area; nothing crosses the trim; back name does not cross the fold |
| COPY-6 | Paste the long headline into each of the four | Shrinks; if it drops below roughly 40 px it's arguably too small to read at A6, log it as a design note, not a bug |
| COPY-7 | Paste the 400-character back message | Wraps to at most the template's line cap and ends with `…`; never spills over the CTA or contact bar |
| COPY-8 | Paste the awkward-characters string into every field | Renders literally (`&`, `<`, quotes, accents, CJK, emoji). No broken SVG, no blank preview, no console error. Emoji may render as a box on export because the fonts are web-safe stacks; that is acceptable, note it |
| COPY-9 | Set the accent to `#ffffff` and to `#000000` | Text on accent bands flips to a readable colour automatically; nothing becomes white-on-white |
| COPY-10 | Type an invalid accent (`#12`, `red`, `zzzzzz`) in the hex box | Preview falls back to black rather than breaking; the colour picker stays usable |
| COPY-11 | Saved designs library after "Use this design" on Studio | Entry labelled "Studio template · 21 Sept" (template name, not the old id) |
| COPY-12 | Someone with a design saved from the old "Bold template · 18 Sept" | Their saved design still previews and can still be re-activated; the label keeps its old name (it's stored text) |

## 4. Front/back toggle (VIEW)

| ID | Steps | Expected |
|---|---|---|
| VIEW-1 | Open a template | Front is selected; one large preview; Front/Back segmented control above it |
| VIEW-2 | Click Back, then Front | Preview swaps; caption changes to "Back · right half kept clear for the address" and back |
| VIEW-3 | Click into any "Back of card" field | Preview flips to Back on focus, without a click on the tab |
| VIEW-4 | Click into any "Front & brand" field or the accent picker | Flips to Front |
| VIEW-5 | Tab through the form with the keyboard only | Focus moves in order; the preview follows the section being edited; tabs are reachable and switch with Enter/Space |
| VIEW-6 | Desktop, scroll the long form | Preview column stays pinned (sticky) so the card is always visible while typing |
| VIEW-7 | 390 px wide (iPhone) | Preview sits above the form, one card high; no horizontal scroll on the page; Front/Back control fits on one line |
| VIEW-8 | Switch template via "All templates" and choose another | Side resets to Front |
| VIEW-9 | Undo/redo while on Back | The preview stays on Back and updates; the side is not part of undo history |
| VIEW-10 | Dark mode (system setting) | The selected tab is readable (brand navy fill, white text); unselected tab text is legible |

## 5. Undo / redo (UNDO)

Rules the tests rely on: keystrokes in one field within 800 ms of each other
collapse into one step; changing field starts a new step; Reset is itself one
step; history caps at 100 steps; ⌘Z / Ctrl+Z is undo, ⇧⌘Z / Ctrl+Shift+Z is
redo; buttons disable when there's nothing to undo/redo.

| ID | Steps | Expected |
|---|---|---|
| UNDO-1 | Open a template | Both buttons disabled |
| UNDO-2 | Type `Interiors` quickly at the end of the business name, press ⌘Z once | The whole word goes; not one letter |
| UNDO-3 | ⇧⌘Z | Word comes back |
| UNDO-4 | Type in business name, wait 2 s, type more, ⌘Z | Only the second burst goes |
| UNDO-5 | Type in name, then in tagline, ⌘Z twice | Tagline change goes, then the name change |
| UNDO-6 | Change accent with the colour picker (drag around), ⌘Z | Colour returns to what it was before the drag; one step per picker interaction, or a few for a long drag, but never one per pixel |
| UNDO-7 | Edit three fields, click Reset, ⌘Z | All three edits come back in one go |
| UNDO-8 | Edit, ⌘Z, then type something new | Redo becomes disabled (new branch discards the redo stack) |
| UNDO-9 | Press ⌘Z with the cursor inside the back message textarea | Our undo runs, not the browser's native textarea undo; the field and preview agree afterwards |
| UNDO-10 | Press ⌘Z on the template chooser page (no template open) | Nothing happens, no error |
| UNDO-11 | Press ⌘Z while the leave dialog is open | Nothing changes behind the dialog |
| UNDO-12 | Make 120 distinct edits (change field, wait 1 s, repeat), then hold ⌘Z | Undo stops after 100 steps; app stays responsive |
| UNDO-13 | Add a logo, ⌘Z | Logo disappears. ⇧⌘Z brings it back at the same position and size |
| UNDO-14 | Drag the logo in one continuous motion, ⌘Z | Back to where it was, one step |
| UNDO-15 | Drag, pause 2 s mid-drag with the button held, continue, release, ⌘Z | **Known nit:** this may take two ⌘Z presses. Log it, don't block on it |
| UNDO-16 | Resize the logo, ⌘Z | Size restored |
| UNDO-17 | Remove the logo, ⌘Z | Logo restored, same place |
| UNDO-18 | "Use this design", then ⌘Z | Undo still works on the in-editor state (the save is not undone, and that's correct). The "unsaved changes" state comes back if you undo past the saved point — see LEAVE-8 |
| UNDO-19 | Windows/Linux: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | Ctrl+Z and Ctrl+Shift+Z work. Ctrl+Y is not bound; confirm it does nothing rather than something odd |
| UNDO-20 | Switch templates via "All templates" and pick another | History cleared: both buttons disabled |

## 6. Unsaved-changes guard (LEAVE)

"Dirty" means the editor state (text, colour, logos) differs from what was last
chosen or saved. Picking a template and changing nothing is not dirty.

| ID | Steps | Expected |
|---|---|---|
| LEAVE-1 | Open a template, change nothing, click a sidebar link | Navigates immediately, no dialog |
| LEAVE-2 | Edit a field, click **Leads** in the sidebar | "Leave without saving?" dialog. **Keep editing** closes it, you're still in the editor with the edit intact |
| LEAVE-3 | Same, click **Leave anyway** | Goes to Leads |
| LEAVE-4 | Edit, click **All templates** | Dialog. Leave anyway → chooser; Keep editing → still editing |
| LEAVE-5 | Edit, click **All design options** (top of page) | Dialog, same behaviour |
| LEAVE-6 | Edit, press ⌘R / reload, or close the tab | Browser's native "Leave site?" prompt. Cancel keeps the page |
| LEAVE-7 | Edit, click "Use this design", wait for the toast, then click a sidebar link | No dialog (saved state is now the baseline) |
| LEAVE-8 | After LEAVE-7, press ⌘Z, then click a sidebar link | Dialog again (you've moved away from the saved state) |
| LEAVE-9 | Edit, then Reset back to defaults, click a sidebar link | No dialog: state equals the original defaults. (If Reset is the only change, nothing is lost by leaving) |
| LEAVE-10 | Edit, then manually type the exact original value back, click away | No dialog: comparison is by value, not by "has typed" |
| LEAVE-11 | Add a logo only (no text change), click away | Dialog |
| LEAVE-12 | Add a logo, remove it, click away | No dialog |
| LEAVE-13 | Edit, press Escape while the dialog is open | Dialog closes, still editing |
| LEAVE-14 | Edit, ⌘-click / middle-click a sidebar link | Opens in a new tab; **no** dialog (current page untouched) |
| LEAVE-15 | Edit, click the "View file" link (external, `target=_blank`) | Opens the file in a new tab; no dialog |
| LEAVE-16 | Edit, click "Opt out of mail" or "Privacy policy" in the footer | These are in-app links: dialog |
| LEAVE-17 | Edit, click **Sign out** | Sign out is a button, not a link. Confirm what happens: if it signs out without warning, log it; the guard only covers links and the two back buttons |
| LEAVE-18 | Edit, use the browser Back button | Expected: Next.js client-side back is not intercepted; you leave without a dialog. Log as a known gap if it matters to Freddie |
| LEAVE-19 | Edit, then trigger a full-page navigation from the address bar | Native prompt (LEAVE-6) |
| LEAVE-20 | Open the editor in two tabs, edit in one, close the other | Only the edited tab prompts |
| LEAVE-21 | 390 px | Dialog fits, both buttons visible without scrolling |
| LEAVE-22 | Screen reader (VoiceOver) with the dialog open | Announces title and description; focus is trapped inside; Tab cycles between the two buttons |
| LEAVE-23 | Edit, click "Or upload your own print-ready PDF" | This switches the page mode inside the editor. Expected: dialog (it discards the template edits). If no dialog appears, log it |

## 7. Logo overlay (LOGO)

Facts the tests rely on: accepted types PNG, JPEG, SVG, PDF; 10 MB cap;
bitmaps over 2400 px on their longest edge are downscaled to 2400 (always to
PNG so transparency survives); SVGs are embedded as-is; PDFs use page 1 only,
rasterised to 2400 px. New logo lands top-right of the safe area at 360 px
wide. Minimum width 80 px. Front bounds: 71 px in from every edge. Back bounds:
same, but the right edge is 840 (70 px short of the fold at 910). One logo per
side. Switching template discards logos; Reset keeps them.

### 7.1 Adding

| ID | Steps | Expected |
|---|---|---|
| LOGO-1 | Front tab, "Add your logo to the front", pick `logo-small.png` | Logo appears top-right, 360 px wide (≈20% of card width), aspect preserved, transparent background shows the card through it |
| LOGO-2 | Back tab, add the same file | Lands top-right of the **left** half; right edge at x = 840 |
| LOGO-3 | Add `logo.jpg` | Appears; white/opaque background is expected for a JPEG |
| LOGO-4 | Add `logo.svg` | Appears, crisp at any preview size |
| LOGO-5 | Add `logo.pdf` | Page renders as an image; vector edges look sharp in the export (OPT-4 method) |
| LOGO-6 | With a logo on the front, click "Replace" and pick a different file | Old one replaced; position and size **reset** to the default slot (log if it instead keeps the old box, either is defensible but it must be consistent) |
| LOGO-7 | "Remove" | Gone; "Add your logo to the front" button returns |
| LOGO-8 | Hover the logo, click the small × in its corner | Same as Remove |
| LOGO-9 | Add a logo to the front, switch to Back | Back has no logo; the button says "Add your logo to the back" |
| LOGO-10 | Add different logos to front and back | Both persist independently; switching sides shows the right one |

### 7.2 Positioning and resizing

| ID | Steps | Expected |
|---|---|---|
| LOGO-11 | Add `logo-tall.png` (1:4) | Default width 360 → height 1440, taller than the card. Must be clamped: the box shrinks so it fits inside the safe area, aspect kept, and is fully visible |
| LOGO-12 | Add `logo-wide.png` (24:1) | 360 wide → 15 high; visible, draggable; resize handle still reachable |
| LOGO-13 | Drag the logo to each corner and edge, hard | Stops at the safe box (71 px in) on all four sides of the front; on the back, stops at 840 on the right |
| LOGO-14 | Drag fast, overshooting off the card entirely | Logo never leaves the card; it snaps to the edge and follows the pointer back in |
| LOGO-15 | Corner handle: drag out | Grows, aspect locked; stops at the max width (front 1677, back 769) |
| LOGO-16 | Corner handle: drag in | Shrinks to 80 px minimum, no smaller, never flips |
| LOGO-17 | Grow the logo, then drag it to the right edge, then grow again | Box is re-clamped so it never crosses the edge while growing |
| LOGO-18 | Back: move the logo near the fold, then grow it | Width caps so the right edge stays ≤ 840 |
| LOGO-19 | Touch (iPhone/iPad): drag with a finger, then use the corner handle | Both work; the page does not scroll while dragging; pinch-zoom on the page still works elsewhere |
| LOGO-19b | Keyboard: Tab to the logo box | It receives focus (visible outline). Arrow keys do **not** move it (not implemented). Log as an accessibility gap |

### 7.3 Files that should be handled or refused

| ID | Steps | Expected |
|---|---|---|
| LOGO-20 | `logo-huge.png` (6000×3000, > 5 MB, < 10 MB) | Accepted; downscaled to 2400×1200; export still sharp; the page stays responsive |
| LOGO-21 | `logo-11mb.pdf` | Toast "Logo must be under 10 MB"; nothing added |
| LOGO-22 | `empty.png` | Toast "That file is not a valid image" (or similar); nothing added, no console error |
| LOGO-23 | `fake.png` (text renamed) | Refused with a clear message |
| LOGO-24 | `logo.gif`, `logo.webp`, `photo.heic` | The file picker should hide them (accept list). If picked anyway (drag-drop or "All files"), toast "Use a PNG, JPG, SVG or PDF" |
| LOGO-25 | `logo-cmyk.jpg` | Browsers decode CMYK JPEGs inconsistently. Expected: either renders (colours may shift) or a clear error. A blank box with no message is a bug |
| LOGO-26 | `logo-exif.jpg` (rotated by EXIF) | Check orientation in the preview **and** in the export. Modern browsers honour EXIF in `<img>`; canvas drawing may not. If the export is rotated differently from the preview, that's a bug |
| LOGO-27 | `logo-nosize.svg` | The browser can't size it. Expected: a clear error, or it renders at a sensible default size. A 0×0 or NaN-sized box is a bug |
| LOGO-28 | `logo-external.svg` | External refs are blocked inside an `<image>`. Expected: the logo renders without the external part, no crash, and the export matches the preview |
| LOGO-29 | `logo-multipage.pdf` | Page 1 only |
| LOGO-30 | `logo-portrait.pdf` | Renders upright, aspect kept |
| LOGO-31 | `logo-locked.pdf` | Clear error, not a hang |
| LOGO-32 | Cancel the file picker | Nothing changes, no error, button still works next time |
| LOGO-33 | Pick the same file twice in a row (add, remove, add again) | Works both times (the input resets its value) |
| LOGO-34 | Start a PDF upload, type in a field while it's rendering | Both the keystrokes and the logo survive; neither is lost |

### 7.4 Export and print

| ID | Steps | Expected |
|---|---|---|
| LOGO-35 | Front: put the logo at a known place (e.g. bottom-left corner, snapped), "Use this design", open the exported front PNG | Logo in the same place, same size relative to the card; not blurry; transparency correct (card colour shows through) |
| LOGO-36 | Back: same, with the logo snapped to the right limit | In the exported back, the logo's right edge is at ≤ 840 px; pixels from 846 to 1819 are white except the opt-out line |
| LOGO-37 | Export with an SVG logo | Vector-crisp at 300 DPI, no rasterisation blur |
| LOGO-38 | Export with a PDF logo | Sharp (rendered at 2400 px source) |
| LOGO-39 | Export a JPEG logo after a resize to minimum (80 px) | Present and legible-ish; no error |
| LOGO-40 | Stannp test-mode proof with a logo on both sides | Proof PDF shows both logos; the back logo does not touch the address block |
| LOGO-41 | Firefox: LOGO-35 | Export succeeds (no "tainted canvas" / blank PNG). **This is the case most likely to fail; run it early** |
| LOGO-42 | Safari macOS and iOS: LOGO-35 | Export succeeds; iOS Safari has a canvas memory limit, so also run LOGO-20 there |
| LOGO-43 | Export twice in a row without changing anything | Second export identical; no duplicated logo |

### 7.5 Interactions with other features

| ID | Steps | Expected |
|---|---|---|
| LOGO-44 | Add logos, then Reset | Text returns to defaults; logos stay |
| LOGO-45 | Add logos, "All templates", pick another template | Logos gone (documented behaviour). Freddie may want them to carry over; log as a product question, not a bug |
| LOGO-46 | Add a logo, change the accent colour | Logo unaffected; preview redraws under it |
| LOGO-47 | Add a logo, then paste the long business name | Text shrinks under the logo; they may overlap visually (there is no collision avoidance). Confirm the export matches the preview |
| LOGO-48 | Logo on the back, then set the longest back message | Message and logo may overlap; export matches preview |
| LOGO-49 | Saved designs library after saving with logos | Entry previews show the logos |

## 8. Security (SEC)

| ID | Steps | Expected |
|---|---|---|
| SEC-1 | Add `logo-script.svg` | No alert, no script execution in the preview or on export. SVG inside `<image>` cannot run script; confirm |
| SEC-2 | In the business name, type `"><script>alert(1)</script>` and `<img src=x onerror=alert(1)>` | Rendered as literal text; no alert; export shows the text |
| SEC-3 | Business name `'; DROP TABLE designs; --` then "Use this design" | Saves fine; the library label is the literal text |
| SEC-4 | Check the saved PNG URLs | Served from the public `postcard-designs` bucket under the user's own id; you cannot guess another user's path from yours (ids are UUIDs) |
| SEC-5 | Logo data never leaves the browser except inside the exported PNG | Watch the network tab during add/drag/resize: no upload happens until "Use this design" |

## 9. Performance (PERF)

| ID | Steps | Expected |
|---|---|---|
| PERF-1 | Type a sentence quickly into the back message | Preview keeps up; no dropped characters |
| PERF-2 | `logo-huge.png` added, then drag it around for 10 s | Smooth; the SVG is not rebuilt per move (the layer moves an `<img>`, the SVG only gets the logo at export) |
| PERF-3 | Logos on both sides + type in fields | No noticeable lag vs no logos |
| PERF-4 | Old/slow phone (or Chrome CPU throttle 6×), "Use this design" with two large logos | Completes within ~10 s; toast appears; no white screen |
| PERF-5 | Memory: DevTools → Memory, add/remove a huge logo 10 times | No runaway growth (data URLs are released when replaced) |

## 10. Browser and device matrix

Run the **core set** (OPT-1, COPY-2, VIEW-2, VIEW-3, UNDO-2, LEAVE-2, LEAVE-6,
LOGO-1, LOGO-13, LOGO-15, LOGO-35) on every row; run **everything** on the
first row.

| Browser | Why |
|---|---|
| Chrome, macOS | primary |
| Safari, macOS | canvas/SVG differences; ⌘Z routing |
| Firefox, any | nested `<image>` in canvas (LOGO-41); `beforeunload` wording |
| Safari, iPhone (390 px) | touch drag (LOGO-19), canvas memory (LOGO-20), sticky preview |
| Chrome, Android | touch, file picker types (LOGO-24) |
| Edge, Windows | Ctrl shortcuts (UNDO-19), Windows file picker |

## 11. Accessibility (A11Y)

| ID | Expected |
|---|---|
| A11Y-1 | Front/Back control is a `tablist`; arrow keys or Tab+Enter switch; selected state announced |
| A11Y-2 | Undo/Redo/Reset buttons have accessible names and tooltips with the shortcut |
| A11Y-3 | Leave dialog: focus moves into it, Escape closes, focus returns to the trigger |
| A11Y-4 | Logo box: focusable, named ("Your logo. Drag to move…"); Remove × is a labelled button |
| A11Y-5 | Colour contrast: opt-out grey `#666` on white passes AA for small text (4.5:1 → 5.7:1) |
| A11Y-6 | Reduced motion: no animations rely on motion for meaning |

## 12. Automated checks (run before and after any follow-up fix)

```bash
npm test                      # 19 unit tests: history reducer, link filter, logo geometry + injection
npx tsx .claude/skills/postcard-template-qa/qa-templates.ts   # 16 templates, expect 0 errors
npm run build && npx eslint app lib components               # 0 errors
```

Suggested additions (not written yet): unit tests for `loadLogoFile` error
paths (LOGO-21..23), a Playwright smoke test for LEAVE-2/LEAVE-3 and LOGO-1/LOGO-13, and a
Firefox run of LOGO-41 in CI. The last one is the most valuable.

## 13. Exit criteria

- Every row in §10 has the core set passing.
- No open bug in OPT, SEC, or LOGO-35..43 (export correctness). These affect what prints.
- Known nits (UNDO-15, LEAVE-17/18, LOGO-19b, LOGO-45) are logged as tickets with a decision from Freddie: fix, or accept.
- A Stannp test-mode proof (OPT-7, LOGO-40) has been looked at by a human.

## 14. Reporting a bug

One line each: **ID**, browser/device, what you did (if different from the
steps), what you saw, screenshot or the exported PNG. For export bugs attach
the PNG, not a screenshot of it.
