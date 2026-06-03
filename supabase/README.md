# Database migrations

Migrations live in `supabase/migrations/` as `<timestamp>_<name>.sql` and are
tracked with the Supabase CLI. The production database records which migrations
have run in `supabase_migrations.schema_migrations`, so nothing gets applied
twice and nothing gets silently forgotten.

> History: before 2026-06-03 these were applied **by hand** (there was no
> tracking table). The schema was audited against the repo, found in sync, and
> the tracking table was baselined with all 14 existing migrations. From now on,
> use the CLI flow below.

## One-time setup (per machine)

```bash
# CLI via npx (no global install needed), or: brew install supabase/tap/supabase
export SUPABASE_ACCESS_TOKEN=...        # personal access token (sbp_...)
npx supabase link --project-ref dgscubksafqxpccjsqis
# (link will ask for the database password — get it from the Supabase dashboard:
#  Project Settings → Database → Connection string)
```

## Day-to-day

```bash
# 1. Create a new migration (generates a timestamped file)
npx supabase migration new add_widgets_table

# 2. Edit the generated SQL in supabase/migrations/

# 3. See what's pending vs applied on prod
npx supabase migration list

# 4. Apply pending migrations to prod
npx supabase db push
```

`db push` only runs migrations whose version isn't already in
`schema_migrations`, so the 14 baselined ones are skipped.

## Rules

- **One change per migration file.** Never edit a migration that's already been
  pushed — add a new one instead.
- Make migrations **idempotent where practical** (`if not exists`, `add column
  if not exists`) so a re-run can't break.
- A migration that adds a column/table is safe to push **before** the code that
  uses it deploys; a migration that drops/renames should go **after**. Push
  additive changes first.

## Emergency manual apply (avoid; use the CLI)

If the CLI isn't to hand, a migration can be run via the Management API:

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/dgscubksafqxpccjsqis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data "{\"query\": \"<SQL here>\"}"
```

If you do this, **also** insert the version into the tracking table so the CLI
stays in sync:

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('<timestamp>', '<name>') on conflict do nothing;
```
