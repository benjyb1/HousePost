# Operations runbook

Who to ask, where to look, and what to do when Housepost misbehaves. Written
for whoever is on the phone when a customer says "it says Failed".

## Accounts and who owns them

| Service | What it does | Owner / login |
|---|---|---|
| Vercel (`freddie-postmate`) | Hosts the site, runs the API routes | Benjy's Vercel account |
| Supabase (`PostcardMonthly`) | Database, auth, file storage, cron | Benjy's Supabase account |
| GitHub (`benjyb1/HousePost`) | Code, pull requests, previews | Benjy (admin), Freddie (push) |
| Stannp (account 90536) | Prints and posts the postcards. **Prepaid.** | info@housepost.co.uk |
| Stripe | Charges customers | info@housepost.co.uk |
| Resend | Sends email | see "Email" below |
| Zoho | The info@housepost.co.uk mailbox and DNS | Freddie |

Put all of these in a shared password manager vault. Neither person should be
the only one who can get into any of them.

## The postcard pipeline in one paragraph

A customer confirms a send. The app charges any paid cards up front, creates one
`postcard_jobs` row per card in status `held`, and sets `release_at` fifteen
minutes ahead. Every five minutes pg_cron calls `/api/cron/release-orders`,
which picks up due `held` rows, flips each to `dispatching`, and asks Stannp to
print it. On success the row becomes `dispatched` and carries Stannp's id. The
status poller then advances it through `received`, `production`, `printed`,
`dispatched` over the following days.

## When a card shows "Failed" or "Delayed"

1. Open `/admin/ops` (admin password). It shows the print balance and every
   failed or delayed card with the raw supplier error and the category the
   app assigned.
2. Read the category:
   - **print_credit**: the Stannp balance is empty. Top up in Stannp (or use the
     top-up button on the ops page). Delayed cards retry on their own; nothing
     else to do.
   - **printer**: Stannp rejected or timed out for a reason that is not about
     this card. Delayed cards retry on their own. If it persists for more than
     an hour, check https://status.stannp.com and the raw error.
   - **address** or **design**: the card itself is the problem. It has been
     failed, refunded if paid, and the lead returned to New leads. The customer
     has been emailed. Fix the address or design, then send again.
   - **unknown**: read the raw error. If it looks transient, it will retry.
3. Nothing in the ops page? Query the cron's own responses (kept ~6 hours):

   ```sql
   select created, content from net._http_response
   where content not like '%"released":0%' order by created desc limit 20;
   ```

   Run it through the Supabase Management API with the personal access token
   from `.env.local`, or the `housepost-supabase` connector.

## Print balance

Stannp is pay-as-you-go. An A6 card costs about £0.96 including postage. The
app checks the balance before accepting a send and refuses politely if it
cannot cover the batch, and it emails admin when the balance drops below the
low-water mark. Keep **auto top-up switched on in Stannp** so this never
matters. Balance endpoint:

```bash
curl -s -u "$STANNP_API_KEY:" https://api-eu1.stannp.com/v1/accounts/balance
```

## Email

All customer email and admin alerts go through Resend from
`RESEND_FROM_EMAIL`. The sending domain must be verified on the **same Resend
team whose API key is in Vercel**, otherwise every send is rejected and nothing
is logged. If customers stop getting "your leads are ready" or "postcards on
the way" emails, check Resend's domain page first.

Admin alerts go to `ADMIN_ALERT_EMAIL` (defaults to info@housepost.co.uk).

## Vercel

Benjy's account is on the Hobby plan. That means one seat, so Freddie cannot
log in to see logs or preview deployments unless Vercel Authentication is
turned off for previews (Project, Settings, Deployment Protection) or he is
granted access as the one allowed external user. Logs are only kept for an
hour on Hobby, which is why the app now stores failure reasons itself.

Useful CLI commands (already logged in on Benjy's machine):

```bash
vercel ls freddie-postmate --prod
```

```bash
vercel env ls production
```

## Cron

Three jobs run from pg_cron inside Supabase and call the app with a bearer
token held in Supabase Vault (`cron_secret`):

| Job | Schedule | Endpoint |
|---|---|---|
| housepost-release-orders | every 5 min | /api/cron/release-orders |
| housepost-poll-postcard-status | every 6 h | /api/cron/poll-postcard-status |
| housepost-retention | 03:15 daily | /api/cron/retention |

Check they are firing:

```sql
select jobid, status, start_time from cron.job_run_details
order by start_time desc limit 10;
```
