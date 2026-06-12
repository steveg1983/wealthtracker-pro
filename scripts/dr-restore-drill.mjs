#!/usr/bin/env node
/**
 * Disaster-recovery restore drill — "an untested backup is not a backup."
 *
 * Proves, end to end, that backup-database.mjs artifacts are actually
 * restorable, WITHOUT touching any real user's rows:
 *
 *   1. create a scratch user with an account + transactions
 *   2. take a backup (captures the scratch data)
 *   3. DELETE the scratch user — simulated data-loss event
 *      (the users-row cascade wipes the account + transactions)
 *   4. restore the scratch user's rows from the backup
 *   5. verify the restored rows are identical to the originals
 *   6. clean the scratch user up again
 *
 * Prints RTO evidence (timings per stage). Exits non-zero on any mismatch.
 *
 * Usage: node scripts/dr-restore-drill.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

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
const supabase = createClient(url, key, { auth: { persistSession: false } });

const fail = (msg) => {
  console.error(`\n✗ DRILL FAILED: ${msg}`);
  process.exit(2);
};

const sortById = (rows) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));

const fetchScratch = async (userId) => {
  const [accounts, transactions] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId)
  ]);
  if (accounts.error || transactions.error) {
    fail(`scratch fetch failed: ${accounts.error?.message ?? transactions.error?.message}`);
  }
  return { accounts: sortById(accounts.data), transactions: sortById(transactions.data) };
};

const main = async () => {
  console.log('── DR restore drill ──\n');
  const drillId = randomUUID();
  const scratchEmail = `dr-drill+${drillId.slice(0, 8)}@invalid.local`;

  // ── 1. Seed scratch data ────────────────────────────────────────────────
  let t = Date.now();
  const userInsert = await supabase
    .from('users')
    .insert({ id: drillId, clerk_id: `dr_drill_${drillId}`, email: scratchEmail })
    .select()
    .single();
  if (userInsert.error) fail(`scratch user insert: ${userInsert.error.message}`);

  const accountInsert = await supabase
    .from('accounts')
    .insert({ user_id: drillId, name: 'DR Drill Account', type: 'checking', balance: 1234.56, initial_balance: 1000, currency: 'GBP' })
    .select()
    .single();
  if (accountInsert.error) fail(`scratch account insert: ${accountInsert.error.message}`);
  const accountId = accountInsert.data.id;

  const txns = Array.from({ length: 25 }, (_, i) => ({
    user_id: drillId,
    account_id: accountId,
    description: `Drill txn ${i}`,
    amount: i % 5 === 0 ? 250 : -(10 + i),
    type: i % 5 === 0 ? 'income' : 'expense',
    date: `2026-05-${String((i % 28) + 1).padStart(2, '0')}`
  }));
  const txnInsert = await supabase.from('transactions').insert(txns).select();
  if (txnInsert.error) fail(`scratch transactions insert: ${txnInsert.error.message}`);
  console.log(`1. Seeded scratch user (${drillId.slice(0, 8)}…): 1 account, ${txns.length} transactions  [${Date.now() - t} ms]`);

  const original = await fetchScratch(drillId);

  // ── 2. Backup ───────────────────────────────────────────────────────────
  t = Date.now();
  execFileSync('node', ['scripts/backup-database.mjs'], { stdio: 'pipe' });
  const backupDirs = readdirSync(path.join('backups', 'db')).sort();
  const backupDir = path.join('backups', 'db', backupDirs[backupDirs.length - 1]);
  const backupMs = Date.now() - t;
  console.log(`2. Backup taken → ${backupDir}  [${backupMs} ms]`);

  // ── 3. Simulated disaster ───────────────────────────────────────────────
  t = Date.now();
  const del = await supabase.from('users').delete().eq('id', drillId);
  if (del.error) fail(`disaster simulation delete: ${del.error.message}`);
  const afterDelete = await fetchScratch(drillId);
  if (afterDelete.accounts.length !== 0 || afterDelete.transactions.length !== 0) {
    fail('cascade delete left rows behind — disaster simulation invalid');
  }
  console.log(`3. Disaster simulated: scratch user deleted, cascade verified empty  [${Date.now() - t} ms]`);

  // ── 4. Restore ──────────────────────────────────────────────────────────
  t = Date.now();
  execFileSync('node', [
    'scripts/restore-database.mjs',
    `--dir=${backupDir}`,
    `--user-id=${drillId}`,
    '--apply'
  ], { stdio: 'pipe' });
  const restoreMs = Date.now() - t;
  console.log(`4. Restore executed from backup  [${restoreMs} ms]`);

  // ── 5. Verify byte-equality ─────────────────────────────────────────────
  const restored = await fetchScratch(drillId);
  if (restored.accounts.length !== original.accounts.length) {
    fail(`account count mismatch: ${restored.accounts.length} vs ${original.accounts.length}`);
  }
  if (restored.transactions.length !== original.transactions.length) {
    fail(`transaction count mismatch: ${restored.transactions.length} vs ${original.transactions.length}`);
  }
  const origJson = JSON.stringify(original);
  const restJson = JSON.stringify(restored);
  if (origJson !== restJson) {
    fail('restored rows differ from originals (field-level diff needed)');
  }
  console.log(`5. Verified: ${restored.accounts.length} account + ${restored.transactions.length} transactions byte-identical to pre-disaster state`);

  // ── 6. Cleanup ──────────────────────────────────────────────────────────
  await supabase.from('users').delete().eq('id', drillId);
  console.log('6. Scratch user cleaned up');

  console.log(`\n✓ DRILL PASSED — backup ${backupMs} ms, restore ${restoreMs} ms (RTO evidence for this dataset size)`);
};

main().catch((err) => {
  console.error('Drill failed:', err.message);
  process.exit(1);
});
