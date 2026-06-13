#!/usr/bin/env node
/**
 * Delete a single user and ALL their data, by Clerk id.
 *
 * The users-row FK cascade removes accounts, transactions, budgets, goals,
 * categories, investments, banking tables, etc. Tables keyed OUTSIDE that
 * cascade (financial_audit_log by user_id uuid; user_profiles and
 * recurring_transactions by clerk id) are deleted explicitly first.
 *
 * Dry-run by default — prints the exact row counts that WILL be deleted.
 * Pass --apply to delete.
 *
 *   node scripts/delete-user.mjs --clerk-id=user_xxx           # dry run
 *   node scripts/delete-user.mjs --clerk-id=user_xxx --apply   # delete
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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

const args = process.argv.slice(2);
const clerkId = args.find((a) => a.startsWith('--clerk-id='))?.split('=')[1];
const apply = args.includes('--apply');
if (!clerkId) {
  console.error('Provide --clerk-id=<clerk user id>');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// [table, fk column, key type] — uuid tables use the users.id; clerk tables use clerk id.
const UUID_TABLES = [
  'financial_audit_log', 'goal_contributions', 'investment_transactions',
  'investments', 'transactions', 'budgets', 'goals', 'categories', 'accounts',
  'subscriptions', 'invoices', 'payment_methods', 'subscription_usage',
  'subscription_logs', 'subscription_events', 'bank_connections',
  'linked_accounts', 'sync_history', 'dashboard_layouts'
];
const CLERK_TABLES = [['user_profiles', 'clerk_user_id'], ['recurring_transactions', 'user_id']];

const countRows = async (table, col, val) => {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(col, val);
  return error ? `(read failed: ${error.message})` : (count ?? 0);
};

const main = async () => {
  console.log(`── Delete user ${clerkId} ${apply ? '(APPLYING — permanent)' : '(dry run)'} ──`);
  console.log(`Target: ${url}\n`);

  const { data: user, error } = await supabase
    .from('users').select('id, email, created_at').eq('clerk_id', clerkId).maybeSingle();
  if (error) { console.error('users read failed:', error.message); process.exit(1); }
  if (!user) { console.log('No user with that clerk id — nothing to do.'); return; }

  console.log(`User: ${user.id}  email=${user.email}  created=${user.created_at?.slice(0, 10)}\n`);
  console.log('Rows that will be deleted:');
  for (const t of UUID_TABLES) console.log(`  ${t.padEnd(26)} ${await countRows(t, 'user_id', user.id)}`);
  for (const [t, col] of CLERK_TABLES) console.log(`  ${t.padEnd(26)} ${await countRows(t, col, clerkId)}`);
  console.log(`  ${'users'.padEnd(26)} 1`);

  if (!apply) { console.log('\nDry run only — re-run with --apply to delete.'); return; }

  console.log('\nDeleting…');
  // Non-cascade tables first.
  for (const t of ['financial_audit_log']) {
    const { error: e } = await supabase.from(t).delete().eq('user_id', user.id);
    if (e) console.log(`  ${t}: ${e.message}`);
  }
  for (const [t, col] of CLERK_TABLES) {
    const { error: e } = await supabase.from(t).delete().eq(col, clerkId);
    if (e) console.log(`  ${t}: ${e.message}`);
  }
  // The users row — cascade handles the rest.
  const { error: delErr } = await supabase.from('users').delete().eq('id', user.id);
  if (delErr) { console.error('users delete failed:', delErr.message); process.exit(1); }

  console.log('Done. Run npm run audit:data to confirm the remaining accounts are clean.');
};

main().catch((err) => { console.error('Delete failed:', err.message); process.exit(1); });
