# Proposed migrations (not applied)

SQL written during the 27 Nov 2026 site-test fixes that needs Benjy's go-ahead
before it runs against production. Nothing here is in `supabase/migrations/`,
so no tooling will pick it up by accident. To apply one, move it into
`supabase/migrations/` with a fresh timestamp and run it the usual way.

- `profiles_value_checks.sql`: database-level limits on the search and
  design fields. The settings API now checks these, but the same columns can
  be written straight through PostgREST with a user's own token, so the API
  check alone can be bypassed.
- `leads_read_subscribers_only.sql`: stops a non-subscriber reading their
  homes straight from PostgREST. Home already sends only five homes to a
  non-subscriber; without this, someone who knows the API could still list
  the rest. Read the notes in the file first: it changes what the archive and
  restore routes can see for non-subscribers.
