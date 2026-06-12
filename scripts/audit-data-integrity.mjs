#!/usr/bin/env node
/**
 * Data integrity audit — READ ONLY.
 *
 * Verifies the core accounting invariant per account:
 *   stored balance === initial_balance + SUM(transactions.amount)
 *
 * Historical float arithmetic and the old partial-failure delete path may
 * have baked drift into stored balances; the 2026-06 atomic RPCs fixed the
 * mechanism going forward but cannot retroactively correct stored values.
 * This script measures the damage. It changes NOTHING — corrections are a
 * separate, reviewed step.
 *
 * Usage: node scripts/audit-data-integrity.mjs
 * Reads VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ── Env loading (same convention as run-supabase-smoke) ─────────────────────
const loadEnvFile = (file) => {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* file optional */
  }
};
loadEnvFile('.env.local');
loadEnvFile('.env.test.local');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 1000;
const fetchAll = async (table, columns) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
};

const d = (v) => new Decimal(v ?? 0);

const main = async () => {
  console.log('── Data integrity audit (read-only) ──────────────────────────');
  console.log(`Target: ${url}\n`);

  const accounts = await fetchAll(
    'accounts',
    'id, user_id, name, type, currency, balance, initial_balance, is_active'
  );
  const transactions = await fetchAll(
    'transactions',
    'id, account_id, amount, type, date'
  );

  console.log(`Accounts: ${accounts.length}`);
  console.log(`Transactions: ${transactions.length}\n`);

  // Sum transactions per account with Decimal — no float drift in the audit itself.
  const sums = new Map();
  const counts = new Map();
  const orphanTxns = [];
  const accountIds = new Set(accounts.map((a) => a.id));

  for (const t of transactions) {
    if (!accountIds.has(t.account_id)) {
      orphanTxns.push(t);
      continue;
    }
    sums.set(t.account_id, (sums.get(t.account_id) ?? d(0)).plus(d(t.amount)));
    counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1);
  }

  const results = accounts.map((a) => {
    const txnSum = sums.get(a.id) ?? d(0);
    const expected = d(a.initial_balance).plus(txnSum);
    const stored = d(a.balance);
    const drift = stored.minus(expected);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      active: a.is_active !== false,
      txnCount: counts.get(a.id) ?? 0,
      initial: d(a.initial_balance).toFixed(2),
      txnSum: txnSum.toFixed(2),
      expected: expected.toFixed(2),
      stored: stored.toFixed(2),
      drift: drift.toFixed(2),
      drifted: !drift.isZero()
    };
  });

  const drifted = results.filter((r) => r.drifted);
  const clean = results.length - drifted.length;

  console.log(`✓ Accounts where balance === initial + Σtransactions: ${clean}/${results.length}`);
  if (drifted.length > 0) {
    console.log(`\n✗ DRIFTED ACCOUNTS: ${drifted.length}`);
    console.log('account                          | txns | initial      | Σtxns        | expected     | stored       | drift');
    console.log('─'.repeat(120));
    for (const r of drifted) {
      console.log(
        `${(r.name + (r.active ? '' : ' [inactive]')).padEnd(32)} | ${String(r.txnCount).padStart(4)} | ${r.initial.padStart(12)} | ${r.txnSum.padStart(12)} | ${r.expected.padStart(12)} | ${r.stored.padStart(12)} | ${r.drift.padStart(10)}`
      );
    }
    const totalAbsDrift = drifted.reduce((s, r) => s.plus(d(r.drift).abs()), d(0));
    console.log(`\nTotal absolute drift: ${totalAbsDrift.toFixed(2)}`);
  }

  if (orphanTxns.length > 0) {
    console.log(`\n✗ ORPHANED TRANSACTIONS (account_id not in accounts): ${orphanTxns.length}`);
    for (const t of orphanTxns.slice(0, 10)) {
      console.log(`  ${t.id}  account=${t.account_id}  amount=${t.amount}  date=${t.date}`);
    }
    if (orphanTxns.length > 10) console.log(`  … and ${orphanTxns.length - 10} more`);
  }

  // Additional invariant checks
  const badAmounts = transactions.filter((t) => t.amount === null || Number.isNaN(Number(t.amount)));
  if (badAmounts.length > 0) {
    console.log(`\n✗ TRANSACTIONS WITH NULL/NaN AMOUNTS: ${badAmounts.length}`);
  }

  const report = {
    auditedAt: new Date().toISOString(),
    target: url,
    accounts: results.length,
    transactions: transactions.length,
    cleanAccounts: clean,
    driftedAccounts: drifted,
    orphanedTransactions: orphanTxns,
    nullAmountTransactions: badAmounts.length
  };
  mkdirSync('logs/data-integrity', { recursive: true });
  const file = path.join('logs/data-integrity', `${report.auditedAt.replace(/[:.]/g, '-')}_audit.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  writeFileSync('logs/data-integrity/latest.json', JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${file}`);

  if (drifted.length > 0 || orphanTxns.length > 0 || badAmounts.length > 0) {
    console.log('\nRESULT: DRIFT FOUND — do not trust stored balances until corrected.');
    process.exit(2);
  }
  console.log('\nRESULT: CLEAN — stored balances match the accounting invariant.');
};

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
