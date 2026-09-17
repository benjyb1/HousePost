# Go-live checklist

Do this before inviting a paying customer, and again after any change to
printing, payments or email. Ten minutes. Tick every line.

## Printing (Stannp)

- [ ] A card is saved in Stannp and **auto top-up is on**.
- [ ] Balance is above £20 (`/admin/ops` shows it).
- [ ] Send **one real postcard to your own address** from a test account and
      wait for it to arrive. Test mode proofs do not count.

## Payments (Stripe)

- [ ] Production uses the live key; Preview uses the **test** key so a preview
      can never charge a real card.
- [ ] Confirm a paid send from a test account, cancel inside the cool-off, and
      check the refund appears in Stripe.

## Email (Resend)

- [ ] `housepost.co.uk` shows **Verified** on the Resend team whose API key is
      in Vercel.
- [ ] `RESEND_FROM_EMAIL` is a `@housepost.co.uk` address.
- [ ] `ADMIN_ALERT_EMAIL` is set in Vercel and that inbox is one a human reads.
- [ ] Trigger a test alert and see it land.

## Scheduling

- [ ] `cron.job_run_details` shows the release job succeeding in the last ten
      minutes.

## Access

- [ ] Both founders can log into Vercel, Supabase, Stannp, Stripe and Resend,
      or the logins are in the shared vault.
- [ ] Freddie can open a PR preview link without being asked to log in.

## Customer-facing

- [ ] The help page (`/help`) is linked from the portal and the error copy.
- [ ] A failed card shows a reason in Tracking and triggers an email.
