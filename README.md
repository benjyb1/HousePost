# Housepost

Automated UK property lead generation from HM Land Registry data with Stannp postcard dispatch. Built with Next.js 16, Supabase, Stripe, and Stannp. Solo-built end to end: schema, cron pipeline, billing, and the admin panel.

## How it works

1. **5th of each month** (deferred to Monday if weekend): streams the 100MB+ Land Registry monthly CSV straight from the download response into the parser — never buffers the whole file — filters to standard sales (category A), and batch-upserts into the database.
2. **6th of each month**: generates leads for each active subscriber — querying properties within their office radius, auto-expanding by 5-mile steps (up to 50 miles) until 15+ leads are found. A notification email is sent.
3. **Clients** log in, review leads, select properties, and confirm postcard dispatch. The first 5/month are included in the £15/month subscription; additional postcards cost £1.50 each via Stripe.

## Engineering details worth a second look

- **Race-safe lead claiming.** Postcard dispatch uses a two-phase commit: create a pending job row, then atomically claim leads with `UPDATE ... WHERE postcard_job_id IS NULL`. Two concurrent submits can't double-claim the same lead — the loser gets zero rows back, no application-level locking needed.
- **Idempotent by default.** Every Stannp order carries a SHA-256 tag (`postcard:{userId}:{leadId}:{month}`) for manual traceability, and a partial unique index on `dispatch_idempotency_key` stops a retried resend from creating a duplicate billable job.
- **Billing follows success, not intent.** A postcard is only marked included/overage after Stannp confirms dispatch, not when the send loop starts — a failed dispatch can't wrongly push someone else's postcard into overage.
- **Land Registry imports are idempotent too.** A unique constraint on `(transaction_id, import_month)` means re-running an import (say, after a partial failure) never duplicates rows.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Scheduling | Vercel Cron Jobs |
| Payments | Stripe (subscriptions + one-off charges) |
| Postcards | Stannp API (A6, Royal Mail) |
| Geocoding | Postcodes.io (free UK API) |
| Email | Resend |
| UI | Tailwind CSS v4 + shadcn/ui |
| Hosting | Vercel Pro (required for 300s function timeout) |

---

## Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com) project
- [Stripe](https://stripe.com) account
- [Stannp](https://www.stannp.com) account
- [Resend](https://resend.com) account
- [Vercel](https://vercel.com) **Pro** plan (for 300s cron functions)

---

## Local setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in all values:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → your endpoint |
| `STRIPE_PRICE_ID` | Create a £10/month recurring price in Stripe → Products |
| `STANNP_API_KEY` | Stannp → Settings → API (drives live dispatch + the test-mode proof) |
| `STANNP_RETURN_ADDRESS` | Optional single-line return address (defaults to your Stannp account address) |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender in Resend |
| `ADMIN_PASSWORD` | Any secure string you choose |
| `CRON_SECRET` | Any random 32-character string |
| `NEXT_PUBLIC_APP_URL` | http://localhost:3000 locally |
| `LAND_REGISTRY_CSV_URL` | Pre-set in .env.example |

### 3. Run database migrations

In the Supabase SQL editor, run each file in `supabase/migrations/` in order (0001 to 0006), or:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 4. Stripe setup

1. Create product: **Housepost Monthly**, £10/month recurring → copy Price ID to `STRIPE_PRICE_ID`
2. Create webhook → `https://your-domain.com/api/webhooks/stripe`
3. Subscribe to: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Testing cron jobs locally

```bash
curl -X POST http://localhost:3000/api/cron/import-land-registry   -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X POST http://localhost:3000/api/cron/generate-leads   -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Routes return `{ skipped: true }` unless today is the scheduled day. Comment out the `isScheduledRunDay()` check for local testing.

---

## Deploy to Vercel

1. Push to GitHub, import in Vercel
2. Add all env vars in Vercel → Settings → Environment Variables
3. Vercel auto-detects `vercel.json` and configures cron jobs
4. **Vercel Pro required** for the 300-second function timeout

---

## Admin panel

Visit `/admin` — enter `ADMIN_PASSWORD`. Shows all clients with lead counts, postcard history, and subscription status.

---

## Architecture notes

- **Cron guards**: Both crons run daily but skip unless today is the target day (5th/6th, deferred to Monday if weekend).
- **CSV streaming**: Uses `fetch().body` (ReadableStream) piped into `csv-parse`. Never buffers the full 100MB+ file.
- **Radius expansion**: SQL bounding-box pre-filter + Haversine in-app on the smaller result set.
- **Stripe webhooks**: `request.text()` for raw body — required for signature verification.
- **Admin auth**: `crypto.timingSafeEqual` timing-safe comparison. httpOnly + secure cookie, 24h expiry.
- **RLS**: `profiles` and `leads` use Supabase Row Level Security. Cron routes use service-role key (bypasses RLS).
