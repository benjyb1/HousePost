# Housepost design reference

A map of the look-and-feel of the site, so a design change lands on-brand and in
the right place first time. Pairs with the guardrails in `/CLAUDE.md`.

## Colours — change them in ONE place

All brand colours are CSS variables in `app/globals.css` under `@theme`. Change
the value there and it updates everywhere the token is used. Don't hardcode hex
in components — use the token classes (`bg-brand`, `text-brand`, etc.).

| Token | Value | Used for |
|---|---|---|
| `--color-brand` | `#0f1f3d` deep navy | navbar, primary buttons, dark sections |
| `--color-brand-dark` | `#0a1733` | hover/darker navy |
| `--color-brand-light` | `#e8ecf4` | tints, subtle backgrounds |
| `--color-brand-border` | `#c7d0e3` | borders on light navy |
| `--color-brand-accent` | `#93c5fd` | highlighted hero text |
| `--color-signal` | `#6ee7b7` | map pins, active dots, pricing ticks |

shadcn/ui tokens (`--primary`, `--background`, `--foreground`, `--border`, `--muted`,
etc.) are also in `app/globals.css`, defined for light mode under `:root` and for
dark mode under `.dark`. If you add a colour, set it in both.

Small known inconsistency (easy to tidy): the "Send" buttons use raw `blue-500`
and a couple of modals use `blue-900` instead of a token. If you want a single
"action" colour you can control globally, ask for these to be moved to a token.

## Type, spacing, components

- **UI kit:** shadcn/ui primitives live in `components/ui/` — `Button`, `Card`,
  `Input`, `Badge`, `Checkbox`, `Label`, `sonner` (toasts). Reuse these; match
  existing usage rather than inventing new patterns.
- **Icons:** `lucide-react`.
- **Fonts:** the system/geist stack set in `app/layout.tsx` + `globals.css`.
- **Dark mode:** wired via `next-themes`. Check both themes for new colours.
- **Responsive:** used on phones — always check ~390px. Tables scroll, rows
  stack. Nothing should overflow horizontally.

## Where the pieces live

- `components/marketing/` — homepage hero pieces (`HeroBackground`, `HeroTradeHeadline`).
- `components/layout/` — `Sidebar`, `SiteFooter`, `SubscriptionBanner`.
- `components/leads/` — `LeadsTable` (the big leads screen), `AddAddressModal`.
- `components/postcards/` — the design/upload/preview flow (`DesignOptionChooser`,
  `SvgTemplateEditor`, `UploadCustomDesign`, `CustomDesignBrief`, `DesignLibrary`,
  `PostcardPreview`, `ResendButton`, `CancelOrderButton`).
- `components/dashboard/RecentActivity.tsx` — the dashboard activity feed.

## Pages, and how to preview each

**Public — no login needed (easiest to design):**
`/` (homepage), `/houses-sold`, `/opt-out`, `/privacy`, `/login`, `/signup`,
`/forgot-password`, `/reset-password`. Just open them on the Vercel PR preview.

**Portal — needs a logged-in account (and usually an active subscription):**
`/dashboard`, `/leads`, `/postcards`, `/postcards/design`, `/settings`,
`/account`, `/notifications`. To see these on a preview you need to log in with a
demo account — ask Benjy for the demo login. Restyle the layout and components;
don't change the send/billing logic (see `/CLAUDE.md`).

**Admin:** `/admin` is password-gated and not part of design work.

## Working loop

Edit → the PR's Vercel preview updates → look at it on desktop and ~390px → tweak
by replying → merge when it looks right. Ask your Claude to screenshot the
preview so it can check its own visual changes.
