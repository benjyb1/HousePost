# PropertyLeads — Ownership Transfer Guide

This document covers everything needed to fully transfer ownership of PropertyLeads to a new owner.

---

## Accounts to transfer

### 1. GitHub
The source code lives here. The new owner needs their own GitHub account.

**Steps:**
1. New owner creates a GitHub account at [github.com](https://github.com)
2. Current owner goes to the repository → **Settings → Collaborators and teams → Add people**
3. Add the new owner's GitHub username with **Owner** role
4. New owner accepts the invite
5. Current owner transfers the repository: **Settings → General → scroll to Danger Zone → Transfer repository**

---

### 2. Vercel (website hosting)
This is where the website runs.

**Steps:**
1. New owner creates a Vercel account at [vercel.com](https://vercel.com) using their GitHub account
2. After the GitHub repository has been transferred (see Section 1), new owner logs into Vercel
3. Click **Add New → Project**
4. Import the transferred GitHub repository
5. Vercel will auto-detect Next.js — click **Deploy**
6. After deployment completes, add all environment variables under **Project → Settings → Environment Variables** (see list below)
7. If using a custom domain:
   - Go to **Project → Settings → Domains**
   - Add the domain
   - Update DNS records at the domain registrar to point to the new Vercel project

---

### 3. Supabase (database)
This stores all client data, leads, and postcard history.

**Steps:**
1. New owner creates a Supabase account at [supabase.com](https://supabase.com)
2. Current owner goes to [supabase.com/dashboard/org](https://supabase.com/dashboard/org) → **Members → Invite**
3. Invite the new owner's email as **Owner**
4. Once accepted, current owner can remove themselves

---

### 4. Stripe (payments)
This handles all subscription billing.

**Steps:**
1. New owner creates a Stripe account at [stripe.com](https://stripe.com)
2. Existing customer subscriptions **cannot** be automatically migrated — contact Stripe support at [support.stripe.com](https://support.stripe.com) for a business transfer
3. Update the Stripe keys in Vercel environment variables once the new account is ready

---

### 5. PostGrid (postcard printing)
This prints and posts the physical postcards.

**Steps:**
1. New owner creates a PostGrid account at [postgrid.com](https://postgrid.com)
2. Get new API keys from the PostGrid dashboard
3. Update `POSTGRID_API_KEY` in Vercel environment variables

---

### 6. Resend (email notifications)
This sends notification emails to clients.

**Steps:**
1. New owner creates a Resend account at [resend.com](https://resend.com)
2. Verify the sender domain in Resend → Domains
3. Get new API key from Resend dashboard
4. Update `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel environment variables

---

### 7. Domain name
The website's web address.

**Steps:**
1. Log in to the domain registrar (GoDaddy/Namecheap/etc.) where the domain was purchased
2. Go to **Account → Domain Transfer** and follow the transfer process to the new owner's registrar account
3. The DNS settings (pointing to Vercel) will need to be re-added after transfer

---

## Environment variables to add in Vercel after deployment

Once all accounts are set up, add these in **Project → Settings → Environment Variables**:

| Variable | Where to get the new value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → your endpoint |
| `STRIPE_PRICE_ID` | Stripe → Products → your subscription product |
| `POSTGRID_API_KEY` | PostGrid → Dashboard → API keys |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM_EMAIL` | Your verified sender email |
| `ADMIN_PASSWORD` | Set a new secure password |
| `CRON_SECRET` | Generate a new random string |
| `NEXT_PUBLIC_APP_URL` | Your domain (e.g. https://yourdomain.co.uk) |

---

## GitHub Actions secrets to update

After transferring GitHub, add the same secrets at:
**GitHub repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as Vercel |
| `LAND_REGISTRY_CSV_URL` | Keep the same (public URL, doesn't change) |
| `RESEND_API_KEY` | Same as Vercel |
| `RESEND_FROM_EMAIL` | Same as Vercel |

---

## Checklist

- [ ] GitHub repository transferred
- [ ] Vercel project deployed from transferred GitHub repo and environment variables added
- [ ] Supabase ownership transferred
- [ ] Stripe account set up and keys updated
- [ ] PostGrid account set up and keys updated
- [ ] Resend account set up and keys updated
- [ ] Domain transferred and DNS pointing to new Vercel account
- [ ] GitHub Actions secrets updated
- [ ] Admin password changed
- [ ] Test signup and postcard dispatch working on new setup
