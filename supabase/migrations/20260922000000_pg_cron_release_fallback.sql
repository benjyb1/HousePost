-- Reliable scheduling for the cron endpoints, independent of GitHub Actions.
--
-- Why: the release, status-poll and retention jobs run on GitHub Actions
-- `schedule:` triggers. GitHub disables a repo's scheduled workflows after 60
-- days with no commits (a stable, finished app hits this), and drops runs under
-- load — so held postcards could silently stop posting. This adds an in-database
-- schedule via pg_cron + pg_net that hits the SAME endpoints. Both can run; the
-- endpoints are idempotent (atomic 'held' -> 'dispatching' claim, letter-id
-- guard), so a double trigger just finds nothing to do. GitHub is left in place
-- as a secondary.
--
-- The bearer token is NOT stored in this file or in cron.job.command. It lives
-- in Supabase Vault under the name 'cron_secret' and is read at run time. Insert
-- it once, out of band (kept out of git):
--
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret',
--     'Bearer token for /api/cron/* endpoints');
--
-- Endpoints are hit on the canonical production origin.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: POST to one of our cron endpoints with the Vault-held bearer token.
-- SECURITY DEFINER so it can read the secret; only the postgres/cron owner runs
-- it (pg_cron jobs run as the job owner), and it is not granted to app roles.
create or replace function public.trigger_housepost_cron(p_path text)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'cron_secret';
  if v_secret is null then
    raise warning 'trigger_housepost_cron: no vault secret named cron_secret; skipping %', p_path;
    return null;
  end if;
  select net.http_post(
    url := 'https://www.housepost.co.uk' || p_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke execute on function public.trigger_housepost_cron(text) from public, anon, authenticated;

-- cron.schedule replaces the job if the name already exists, so this is
-- idempotent. Schedules mirror the GitHub workflows.
select cron.schedule('housepost-release-orders', '*/5 * * * *',
  $$select public.trigger_housepost_cron('/api/cron/release-orders')$$);

select cron.schedule('housepost-poll-postcard-status', '0 */6 * * *',
  $$select public.trigger_housepost_cron('/api/cron/poll-postcard-status')$$);

select cron.schedule('housepost-retention', '15 3 * * *',
  $$select public.trigger_housepost_cron('/api/cron/retention')$$);
