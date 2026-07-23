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
 * ── Why trust-balance is now guarded ────────────────────────────────────────
 * On an account holding imported Microsoft Money history, trust-balance is
 * almost always the WRONG answer, and it has been the wrong answer twice.
 * The transactions there are a reconstructed ledger from the file: when the
 * stored balance disagrees with them the discrepancy is a fact about the
 * IMPORT — a double-counted overlap with a bank feed, a missed row — and
 * absorbing it into `initial_balance` does not fix it, it HIDES it. The
 * invariant then holds, the audit goes quiet, and the account's opening
 * balance is a fabricated number nobody can explain. Every subsequent
 * re-import preserves it, because the importer reuses an existing account
 * rather than rewriting it.
 *
 * So trust-balance refuses an account with `import_source = 'ms-money'` rows
 * unless a SECOND explicit flag is given, and every repair prints the size of
 * the rebase before it is written.
 *
 * Usage:
 *   node scripts/repair-balance-drift.mjs --strategy=trust-ledger          # dry run
 *   node scripts/repair-balance-drift.mjs --strategy=trust-ledger --apply  # write
 *   node scripts/repair-balance-drift.mjs --strategy=trust-balance \
 *     --i-know-this-hides-an-import-discrepancy   # required on imported accounts
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
// Optional: restrict the repair to one account (different accounts can need
// different strategies — e.g. a missing opening balance vs a corrupted total).
const accountArg = args.find((a) => a.startsWith('--account='));
const onlyAccountId = accountArg?.split('=')[1] ?? null;
// The second flag trust-balance needs before it will touch an account holding
// imported Money history. Named for what it actually does, not for what the
// operator hopes it does.
const OVERRIDE_IMPORTED = args.includes('--i-know-this-hides-an-import-discrepancy');
const MS_MONEY_IMPORT_SOURCE = 'ms-money';

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
  // `import_source` only exists once migration 20260722170000 is applied. Where
  // it does not, no row can be an import row and the guard simply never fires.
  const transactions = await fetchAll('transactions', 'account_id, amount, import_source')
    .catch(() => fetchAll('transactions', 'account_id, amount'));

  const sums = new Map();
  // Which accounts hold imported Money history? Counted, not just flagged, so
  // the refusal below can say how much of the account it is talking about.
  const importedRows = new Map();
  for (const t of transactions) {
    sums.set(t.account_id, (sums.get(t.account_id) ?? d(0)).plus(d(t.amount)));
    if (t.import_source === MS_MONEY_IMPORT_SOURCE) {
      importedRows.set(t.account_id, (importedRows.get(t.account_id) ?? 0) + 1);
    }
  }

  let repaired = 0;
  let refused = 0;
  for (const a of accounts) {
    if (onlyAccountId && a.id !== onlyAccountId) continue;
    const txnSum = sums.get(a.id) ?? d(0);
    const expected = d(a.initial_balance).plus(txnSum);
    const stored = d(a.balance);
    if (stored.minus(expected).isZero()) continue;

    const update = strategy === 'trust-ledger'
      ? { balance: expected.toNumber() }
      : { initial_balance: stored.minus(txnSum).toNumber() };

    // How big is this rebase? Printed for BOTH strategies, always, because the
    // number is the whole argument: a £26,727 "repair" is not a rounding fix,
    // it is a discrepancy being moved somewhere nobody will look at it again.
    const drift = stored.minus(expected);
    console.log(
      `${a.name.padEnd(32)} ${strategy === 'trust-ledger'
        ? `balance ${stored.toFixed(2)} → ${expected.toFixed(2)}`
        : `initial ${d(a.initial_balance).toFixed(2)} → ${stored.minus(txnSum).toFixed(2)}`}` +
      `   (moves ${drift.abs().toFixed(2)})`
    );

    const imported = importedRows.get(a.id) ?? 0;
    if (strategy === 'trust-balance' && imported > 0 && !OVERRIDE_IMPORTED) {
      console.log(
        `  REFUSED: ${imported} transaction(s) here came from the Microsoft Money import, so the\n` +
        `  ledger is a reconstruction and this ${drift.abs().toFixed(2)} discrepancy is a fact about the\n` +
        '  import — absorbing it into initial_balance hides it rather than fixing it.\n' +
        '  Fix the import (scripts/mnyReimportPlan.mts), or use --strategy=trust-ledger.\n' +
        '  If you have genuinely decided the stored balance is right, re-run with\n' +
        '  --i-know-this-hides-an-import-discrepancy.'
      );
      refused += 1;
      continue;
    }

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
  if (refused > 0) {
    console.log(`Refused: ${refused} account(s) holding imported Money history (see above).`);
  }
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
