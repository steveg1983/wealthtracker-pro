#!/usr/bin/env node
/**
 * Test-data cleanup — removes synthetic users and ALL their data.
 *
 * Deletion boundary: every users row whose email is NOT in KEEP_EMAILS
 * (these are the seeded complete-test@example.com rows, test.*@test.com
 * rows, and faker-generated smoke leftovers). Real users are never touched.
 *
 * Dry-run by default; pass --apply to delete.
 *
 *   node scripts/cleanup-test-data.mjs            # report only
 *   node scripts/cleanup-test-data.mjs --apply    # delete
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const KEEP_EMAILS = ['s.green1983@outlook.com'];

const loadEnvFile = (file) => {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* optional */ }
};
loadEnvFile('.env.local');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Child tables first so FKs never block. Each entry: [table, fk column].
const USER_TABLES = [
  ['financial_audit_log', 'user_id'],
  ['goal_contributions', 'user_id'],
  ['investment_transactions', 'user_id'],
  ['investments', 'user_id'],
  ['transactions', 'user_id'],
  ['budgets', 'user_id'],
  ['goals', 'user_id'],
  ['categories', 'user_id'],
  ['accounts', 'user_id'],
  ['subscriptions', 'user_id'],
];

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const main = async () => {
  console.log(`── Test-data cleanup ${apply ? '(APPLYING — deletions are permanent)' : '(dry run)'} ──`);
  console.log(`Target: ${url}`);
  console.log(`Keeping users with email in: ${KEEP_EMAILS.join(', ')}\n`);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, clerk_id, email');
  if (error) throw new Error(`users read failed: ${error.message}`);

  const junkUsers = users.filter((u) => !KEEP_EMAILS.includes(u.email));
  const keptUsers = users.filter((u) => KEEP_EMAILS.includes(u.email));

  console.log(`Users total: ${users.length} — keeping ${keptUsers.length}, deleting ${junkUsers.length}`);
  for (const u of keptUsers) console.log(`  KEEP ${u.email} (${u.clerk_id})`);

  const junkIds = junkUsers.map((u) => u.id);
  const junkClerkIds = junkUsers.map((u) => u.clerk_id).filter(Boolean);
  if (junkIds.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  // Count (and optionally delete) per table, chunked to keep URLs sane.
  for (const [table, fk] of USER_TABLES) {
    let total = 0;
    for (const ids of chunk(junkIds, 100)) {
      const { count, error: cErr } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .in(fk, ids);
      if (cErr) { console.log(`  ${table}: read failed (${cErr.message}) — skipping`); total = -1; break; }
      total += count ?? 0;
    }
    if (total < 0) continue;
    console.log(`  ${table.padEnd(26)} ${apply ? 'deleting' : 'would delete'} ${total}`);
    if (apply && total > 0) {
      for (const ids of chunk(junkIds, 100)) {
        const { error: dErr } = await supabase.from(table).delete().in(fk, ids);
        if (dErr) console.log(`    DELETE FAILED on ${table}: ${dErr.message}`);
      }
    }
  }

  // user_profiles is keyed by clerk_user_id (text), and recurring_transactions
  // stores the clerk id in user_id (text).
  for (const [table, fk] of [['user_profiles', 'clerk_user_id'], ['recurring_transactions', 'user_id']]) {
    let total = 0;
    for (const ids of chunk(junkClerkIds, 100)) {
      const { count, error: cErr } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .in(fk, ids);
      if (cErr) { console.log(`  ${table}: read failed (${cErr.message}) — skipping`); total = -1; break; }
      total += count ?? 0;
    }
    if (total < 0) continue;
    console.log(`  ${table.padEnd(26)} ${apply ? 'deleting' : 'would delete'} ${total}`);
    if (apply && total > 0) {
      for (const ids of chunk(junkClerkIds, 100)) {
        const { error: dErr } = await supabase.from(table).delete().in(fk, ids);
        if (dErr) console.log(`    DELETE FAILED on ${table}: ${dErr.message}`);
      }
    }
  }

  console.log(`  ${'users'.padEnd(26)} ${apply ? 'deleting' : 'would delete'} ${junkIds.length}`);
  if (apply) {
    for (const ids of chunk(junkIds, 100)) {
      const { error: dErr } = await supabase.from('users').delete().in('id', ids);
      if (dErr) console.log(`    DELETE FAILED on users: ${dErr.message}`);
    }
  }

  console.log(apply
    ? '\nDone. Re-run npm run audit:data to verify.'
    : '\nDry run only — re-run with --apply to delete.');
};

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
