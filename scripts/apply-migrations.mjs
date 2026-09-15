#!/usr/bin/env node
/**
 * Apply pending Supabase migrations via the Management API using a personal
 * access token — for when you only have the token and no dashboard/CLI access.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migrations.mjs
 *
 * Optional: SUPABASE_PROJECT_REF (defaults to the PostcardMonthly project).
 *
 * It reads supabase/migrations/*.sql, skips versions already recorded in
 * supabase_migrations.schema_migrations, applies the rest in order, and records
 * each so the Supabase CLI stays in sync. Stops on the first failure.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF || 'dgscubksafqxpccjsqis'
if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN (your sbp_… personal access token).')
  process.exit(1)
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`

async function run(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const appliedRows = await run('select version from supabase_migrations.schema_migrations')
const applied = new Set(appliedRows.map((r) => r.version))
const cols = await run(
  "select column_name from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations'"
)
const hasName = cols.some((c) => c.column_name === 'name')

let count = 0
for (const f of files) {
  const version = f.split('_')[0]
  if (applied.has(version)) continue
  const name = f.slice(version.length + 1).replace(/\.sql$/, '')
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
  process.stdout.write(`Applying ${f} ... `)
  try {
    await run(sql)
    const rec = hasName
      ? `insert into supabase_migrations.schema_migrations(version,name) values('${version}','${name.replace(/'/g, "''")}') on conflict (version) do nothing`
      : `insert into supabase_migrations.schema_migrations(version) values('${version}') on conflict (version) do nothing`
    await run(rec)
    console.log('done')
    count++
  } catch (e) {
    console.error('FAILED\n' + e.message + '\nStopping — nothing after this was applied.')
    process.exit(1)
  }
}
console.log(count ? `\nApplied ${count} migration(s).` : '\nNothing pending — already up to date.')
