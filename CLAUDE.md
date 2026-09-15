# Housepost — working notes for Claude

Housepost is a UK property-leads tool: it finds recently-sold homes near a
tradesperson's or agent's office (from HM Land Registry data) and posts them a
personalised postcard. Next.js 16 (App Router), React 19, TypeScript, Tailwind
v4, shadcn/ui, Supabase (auth + Postgres), Stripe (billing), Resend (email),
Stannp (postcard print/post). Hosted on Vercel.

## How to work here (read this first)

1. **Never commit to `main` directly.** Make a branch, commit there, open a pull
   request. Vercel builds a **preview deployment** for every PR — open that URL
   to see your change live before it's merged. That preview is how you check
   design work.
2. **Never commit secrets.** All keys live in Vercel and Supabase, never in the
   repo. `.env.local` is gitignored — don't add it, don't paste keys into any
   file, don't print key values.
3. **`npm run build` must pass** before you open a PR. Keep `npx eslint` clean
   (0 errors).
4. Use **UK English** everywhere users can read (colour, organise, personalise).
5. Write like a person, not an AI. No inflated adjectives, no "delve / crucial /
   landscape / testament", no rule-of-three padding, no em-dash pile-ups. Vary
   sentence length, be plain, have an opinion. This applies to marketing copy,
   UI text and emails.

## What's safe to change (design & content — go ahead)

- **Pages & layout:** `app/page.tsx` (homepage), `app/houses-sold/`,
  `app/opt-out/`, `app/privacy/`, and the portal pages under `app/(portal)/`
  (dashboard, leads, postcards, settings, account).
- **Components:** anything in `components/` — especially `components/marketing/`,
  `components/layout/` (Sidebar, footer, banners) and the shadcn/ui primitives
  in `components/ui/`.
- **Styling:** `app/globals.css`, Tailwind classes, spacing, colour, type.
- **Copy:** headings, body text, button labels, email wording in
  `lib/email/resend.ts`.

## What NOT to touch for a design job (ask Benjy first)

These are the money, delivery, auth and data paths. A "make it look nicer" task
should never change how they behave:

- `app/api/postcards/**`, `lib/stripe/**`, `lib/postcards/**` — charging,
  refunds, the postcard send/hold/cancel pipeline, the monthly spend cap.
- `app/(auth)/**`, `app/auth/**`, `proxy.ts`, `lib/supabase/**` — login,
  sign-up, password reset, session handling.
- `supabase/migrations/**` — database schema. Never edit or add migrations for a
  design task.
- `app/api/cron/**`, `lib/leads/**` (suppression / opt-out screening),
  `app/api/opt-out/` logic — compliance and scheduled jobs.

You can restyle the *pages* that use these (e.g. make the send modal prettier),
just don't change the request/response logic, amounts, statuses or SQL.

## Design system

- **Brand colours are CSS variables**, defined in `app/globals.css` under
  `@theme`. Use them, don't hardcode hex:
  - `bg-brand` / `text-brand` — deep navy `#0f1f3d` (primary).
  - `brand-dark`, `brand-light`, `brand-border`, `brand-accent` (`#93c5fd`),
    `signal` (`#6ee7b7`).
  - The "Send" actions use a lighter `blue-500`; keep that distinct from brand.
- **Components:** prefer the shadcn/ui primitives already in `components/ui`
  (Button, Card, Input, Badge, Checkbox, Label). Match existing patterns.
- **Icons:** `lucide-react`.
- **Dark mode:** `next-themes` is wired in; if you add colours, make sure they
  read in both themes.
- **Responsive:** the app is used on phones. Check ~390px width — tables scroll,
  rows stack, nothing overflows.

## Running it locally (optional)

Design tweaks usually don't need a local server — push a branch and use the
Vercel PR preview. If you do want to run it, you'll need the env vars from Benjy
in a local `.env.local`, then `npm install` and `npm run dev`. Without those,
pages that need Supabase/Stripe won't fully load.

## Before you open a PR

- `npm run build` passes.
- `npx eslint app lib components` shows 0 errors.
- You looked at the change on the Vercel preview (or locally) — desktop **and**
  ~390px phone width.
- The PR description says what you changed and includes a screenshot for visual
  changes.
