#!/usr/bin/env node
/**
 * Balance drift repair — companion to audit-data-integrity.mjs.
 *
 * Restores the accounting invariant (balance === initial_balance + Σtxns)
 * for accounts the audit flagged. NEVER deletes anything. Dry-run by default.
 *
 * Strategies (you must choose one — they encode different judgements about
 * which number is the truth):
 *
 *   --strategy=trust-ledger    balance := initial_balance + Σtransactions
 *       The transaction history is authoritative; the stored balance was
 *       corrupted by the old float/partial-failure update paths.
 *
 *   --strategy=trust-balance   initial_balance := balance − Σtransactions
 *       The stored balance is what the user believes they have; absorb the
 *       discrepancy into the opening balance. Right for rows seeded with a
 *       balance but no initial_balance.
 *
 * Usage:
 *   node scripts/repair-balance-drift.mjs --strategy=trust-ledger          # dry run
 *   node scripts/repair-balance-drift.mjs --strategy=trust-ledger --apply  # write
 */

import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { readFileSync } from 'node:fs';

const loadEnvFile = (file) => {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* optional */ }
};
loadEnvFile('.env.local');
loadEnvFile('.env.test.local');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const strategyArg = args.find((a) => a.startsWith('--strategy='));
const strategy = strategyArg?.split('=')[1];
if (strategy !== 'trust-ledger' && strategy !== 'trust-balance') {
  console.error('Choose a strategy: --strategy=trust-ledger | --strategy=trust-balance');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const d = (v) => new Decimal(v ?? 0);

const PAGE = 1000;
const fetchAll = async (table, columns) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

const main = async () => {
  console.log(`── Balance drift repair — strategy=${strategy} ${apply ? '(APPLYING)' : '(dry run)'} ──`);
  console.log(`Target: ${url}\n`);

  const accounts = await fetchAll('accounts', 'id, name, balance, initial_balance');
  const transactions = await fetchAll('transactions', 'account_id, amount');

  const sums = new Map();
  for (const t of transactions) {
    sums.set(t.account_id, (sums.get(t.account_id) ?? d(0)).plus(d(t.amount)));
  }

  let repaired = 0;
  for (const a of accounts) {
    const txnSum = sums.get(a.id) ?? d(0);
    const expected = d(a.initial_balance).plus(txnSum);
    const stored = d(a.balance);
    if (stored.minus(expected).isZero()) continue;

    const update = strategy === 'trust-ledger'
      ? { balance: expected.toNumber() }
      : { initial_balance: stored.minus(txnSum).toNumber() };

    console.log(
      `${a.name.padEnd(32)} ${strategy === 'trust-ledger'
        ? `balance ${stored.toFixed(2)} → ${expected.toFixed(2)}`
        : `initial ${d(a.initial_balance).toFixed(2)} → ${stored.minus(txnSum).toFixed(2)}`}`
    );

    if (apply) {
      const { error } = await supabase
        .from('accounts')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', a.id);
      if (error) {
        console.error(`  FAILED: ${error.message}`);
        continue;
      }
    }
    repaired += 1;
  }

  console.log(`\n${apply ? 'Repaired' : 'Would repair'}: ${repaired} account(s)`);
  if (!apply && repaired > 0) {
    console.log('Re-run with --apply to write the corrections.');
  }
  if (apply) {
    console.log('Re-run scripts/audit-data-integrity.mjs to verify the invariant now holds.');
  }
};

main().catch((err) => {
  console.error('Repair failed:', err.message);
  process.exit(1);
});
