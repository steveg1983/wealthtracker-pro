/**
 * MS Money re-import PLAN — read-only preview. NOTHING IS EVER DELETED HERE.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The transaction table holds two independent populations that overlap in time:
 *
 *   A. FILE IMPORT   — the full Microsoft Money history, written in one pass.
 *                      Recreatable at any time from the .mny file.
 *   B. BANK FEED     — live open-banking rows, each carrying
 *                      `external_transaction_id`. NOT recreatable: once
 *                      deleted, the provider's own record of it is gone from
 *                      this database and a future sync will not re-fetch it
 *                      (the feed only backfills once, at link time).
 *
 * Where the Money file's coverage and the feed's backfill window overlap, the
 * same real-world payment exists in BOTH populations, and nothing reconciled
 * them — so reports double-counted every transaction in that window.
 *
 * ── What a clean re-import has to do ───────────────────────────────────────
 *   1. delete ONLY population A (and its `transaction_splits` children);
 *   2. re-import the file with provenance, so every row carries a stable
 *      `import_source_id` and the unique index refuses a second copy;
 *   3. SUPPRESS the file rows that population B already covers, so the
 *      overlap is not recreated. Wiping and re-importing WITHOUT step 3 lands
 *      the file straight back on top of the feed and reproduces the very
 *      duplicates it was meant to remove.
 *
 * Where a file row and a feed row describe the same payment, the FEED row is
 * the one kept: it is what the bank actually reports, it carries the
 * provider's id, it is what future syncs reconcile against, and unlike the
 * file row it cannot be recreated.
 *
 * ── Discriminator for population A ─────────────────────────────────────────
 * `import_source = 'ms-money'` once migration 20260722170000 is applied and a
 * provenance-carrying import has run. For the CURRENT rows — written before
 * provenance existed — the script falls back to
 * `external_transaction_id IS NULL`, and prints the evidence for that fallback
 * (row counts per created_at day, per provenance state) so a human can confirm
 * the two populations really are cleanly separable before anything is run. If
 * they are not cleanly separable the script says so and refuses.
 *
 * ── Safety ─────────────────────────────────────────────────────────────────
 *   * READ-ONLY. There is no delete path in this file at all.
 *   * `--apply` is recognised and deliberately NOT IMPLEMENTED (see the guard
 *     at the bottom). Enabling it is a human decision.
 *   * A full JSON backup of every row the plan would delete is written to the
 *     output directory, which must be OUTSIDE the repository (the repo is
 *     public and these rows are real financial data).
 *
 * Usage:
 *   npx tsx scripts/mnyReimportPlan.mts --out /path/to/scratchpad
 *   npx tsx scripts/mnyReimportPlan.mts --out … --seed .mny-local/mny-local-seed.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { findFeedOverlap, type ExistingFeedTransaction } from '../src/services/import/msMoney/feedOverlap.ts';
import type { Transaction } from '../src/types/index.ts';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const outDir = flag('out');
const seedPath = flag('seed');
const toleranceDays = Number(flag('tolerance') ?? 3);

if (!outDir) {
  console.error('usage: tsx scripts/mnyReimportPlan.mts --out <dir outside the repo> [--seed seed.json] [--tolerance 3]');
  process.exit(1);
}
const outResolved = resolve(outDir);
if (outResolved.startsWith(resolve('.')) ) {
  console.error(`ABORT: --out must be OUTSIDE the repository (the repo is public). Got ${outResolved}`);
  process.exit(1);
}

// ── Environment (never printed) ──────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const fail = (msg: string): never => { console.error(`\nABORT: ${msg}`); process.exit(1); };

interface DbTxn {
  id: string;
  user_id: string;
  account_id: string;
  description: string | null;
  amount: string | number;
  type: string;
  date: string;
  category: string | null;
  is_split: boolean | null;
  linked_transfer_id: string | null;
  external_transaction_id: string | null;
  import_source: string | null;
  import_source_id: string | null;
  created_at: string;
}

async function fetchAll<T>(table: string, cols: string, filter?: (q: ReturnType<typeof sb.from>) => unknown): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).order('id').range(from, from + PAGE - 1);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q;
    if (error) fail(`reading ${table}: ${error.message}`);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const money = (v: string | number): Decimal => new Decimal(String(v));
const gbp = (d: Decimal): string => `£${d.abs().toFixed(2)}`;

(async () => {
  console.log('MS Money re-import PLAN — dry run, read-only, nothing is deleted.\n');

  const { data: users, error: uerr } = await sb.from('users').select('id, email');
  if (uerr || !users?.length) fail(`cannot read users: ${uerr?.message ?? 'none'}`);

  // Provenance columns are optional: this plan is most useful BEFORE migration
  // 20260722170000 is applied, when every file row is still unmarked.
  const probe = await sb.from('transactions').select('import_source_id').limit(1);
  const hasProvenance = !probe.error;
  if (!hasProvenance) {
    console.log('NOTE: migration 20260722170000 is not applied yet — no row carries import');
    console.log('      provenance, so population A is identified by the fallback discriminator.\n');
  }

  const BASE_COLS = 'id,user_id,account_id,description,amount,type,date,category,is_split,' +
    'linked_transfer_id,external_transaction_id,created_at';
  // The target is the user actually holding the imported history.
  const raw = await fetchAll<Omit<DbTxn, 'import_source' | 'import_source_id'> & Partial<DbTxn>>(
    'transactions',
    hasProvenance ? `${BASE_COLS},import_source,import_source_id` : BASE_COLS
  );
  const all: DbTxn[] = raw.map(t => ({
    ...t, import_source: t.import_source ?? null, import_source_id: t.import_source_id ?? null,
  }));
  const byUser = new Map<string, DbTxn[]>();
  for (const t of all) {
    const list = byUser.get(t.user_id);
    if (list) list.push(t); else byUser.set(t.user_id, [t]);
  }
  const [userId, rows] = [...byUser.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!userId || !rows) fail('no transactions found');
  console.log(`Target user: ${userId} — ${rows.length} transactions ` +
    `(other users hold ${all.length - rows.length}, untouched by this plan)\n`);

  // ── 1. Separate the two populations ────────────────────────────────────────
  const feedRows = rows.filter(t => t.external_transaction_id != null);
  const provenanced = rows.filter(t => t.import_source != null);
  const legacyImport = rows.filter(t => t.external_transaction_id == null && t.import_source == null);

  console.log('POPULATIONS');
  console.log(`  bank feed  (external_transaction_id set) : ${feedRows.length}  — NEVER deleted`);
  console.log(`  file import (import_source set)          : ${provenanced.length}`);
  console.log(`  file import (legacy, no provenance)      : ${legacyImport.length}`);

  // Both discriminators must agree that the populations are disjoint.
  const bothMarkers = rows.filter(t => t.external_transaction_id != null && t.import_source != null);
  if (bothMarkers.length) {
    fail(`${bothMarkers.length} row(s) carry BOTH a bank-feed id and file provenance — ` +
      'the two populations are not cleanly separable; resolve by hand before any deletion.');
  }

  const byDay = new Map<string, { feed: number; file: number }>();
  for (const t of rows) {
    const d = t.created_at.slice(0, 10);
    const e = byDay.get(d) ?? { feed: 0, file: 0 };
    if (t.external_transaction_id != null) e.feed++; else e.file++;
    byDay.set(d, e);
  }
  console.log('  evidence — rows by created_at day (feed / file):');
  for (const [d, e] of [...byDay].sort()) console.log(`    ${d}: ${e.feed} / ${e.file}`);

  const toDelete = [...provenanced, ...legacyImport];
  if (!toDelete.length) { console.log('\nNothing to re-import — no file-import rows found.'); return; }

  // ── 2. Which file rows would the feed already cover on re-import? ──────────
  // Modelled directly on the rows in the database: a re-import reproduces the
  // same transactions in the same accounts, so matching file rows against feed
  // rows here is equivalent to matching the seed against them.
  const asImportShape: Transaction[] = toDelete.map(t => ({
    id: t.import_source_id ?? t.id,
    date: new Date(`${t.date}T00:00:00.000Z`),
    description: t.description ?? '',
    accountId: t.account_id,
    amount: money(t.amount).toNumber(),
    type: t.type as Transaction['type'],
    category: t.category ?? '',
    cleared: false,
    isSplit: t.is_split === true,
  } as Transaction));

  const asFeedShape: ExistingFeedTransaction[] = feedRows.map(t => ({
    id: t.id,
    accountId: t.account_id,
    date: t.date,
    amount: String(t.amount),
    description: t.description ?? '',
  }));

  const overlap = findFeedOverlap(asImportShape, asFeedShape, { dateToleranceDays: toleranceDays });
  const suppressedById = new Map(toDelete.map(t => [t.import_source_id ?? t.id, t]));
  const suppressedRows = [...overlap.suppressedSourceIds].map(id => suppressedById.get(id)!).filter(Boolean);
  const suppressedValue = suppressedRows.reduce((s, t) => s.plus(money(t.amount)), new Decimal(0));

  console.log(`\nFEED OVERLAP (±${toleranceDays} days, exact pence, same account, 1:1)`);
  console.log(`  file rows the feed already covers   : ${overlap.matches.length}  (${gbp(suppressedValue)})`);
  console.log(`  feed rows with no file counterpart  : ${overlap.unmatchedFeedIds.length}  — genuine feed-only spending, kept`);
  console.log(`  overlaps deliberately NOT suppressed : ${overlap.keptDespiteOverlap.transfers} transfer leg(s), ` +
    `${overlap.keptDespiteOverlap.splitParents} split parent(s)`);
  const sameDay = overlap.matches.filter(m => m.dayGap === 0).length;
  const strongDesc = overlap.matches.filter(m => m.descriptionSimilarity > 0).length;
  console.log(`  match quality: ${sameDay}/${overlap.matches.length} same-day, ` +
    `${strongDesc}/${overlap.matches.length} with overlapping description text`);

  // ── 3. Relationships the delete path must handle ──────────────────────────
  const deleteIds = new Set(toDelete.map(t => t.id));
  const splits = await fetchAll<{ id: string; transaction_id: string; user_id: string }>(
    'transaction_splits', 'id,transaction_id,user_id'
  );
  const splitsUnderDelete = splits.filter(s => deleteIds.has(s.transaction_id));
  const orphanedSplits = splits.filter(s => !deleteIds.has(s.transaction_id) && s.user_id === userId);
  const feedLinkedToDeleted = feedRows.filter(t => t.linked_transfer_id && deleteIds.has(t.linked_transfer_id));

  console.log('\nRELATIONSHIPS');
  console.log(`  transaction_splits under deleted parents : ${splitsUnderDelete.length} (deleted with them)`);
  console.log(`  transaction_splits under KEPT parents    : ${orphanedSplits.length} (untouched)`);
  console.log(`  feed rows whose linked_transfer_id points at a deleted row: ${feedLinkedToDeleted.length}` +
    (feedLinkedToDeleted.length ? ' — must be NULLed before deletion, not left dangling' : ''));

  // ── 4. The plan ───────────────────────────────────────────────────────────
  const deletedValue = toDelete.reduce((s, t) => s.plus(money(t.amount)), new Decimal(0));
  const reimportCount = toDelete.length - overlap.matches.length;
  console.log('\nPLAN');
  console.log(`  DELETE  ${toDelete.length} file-import transactions (net ${gbp(deletedValue)}) ` +
    `+ ${splitsUnderDelete.length} split lines`);
  console.log(`  KEEP    ${feedRows.length} bank-feed transactions, all accounts, all categories, ` +
    'all budgets, all goals');
  console.log(`  IMPORT  ${reimportCount} transactions from the file ` +
    `(= ${toDelete.length} source rows − ${overlap.matches.length} the feed already covers)`);
  console.log(`  NET     ${feedRows.length + reimportCount} transactions afterwards ` +
    `(was ${rows.length}; ${rows.length - feedRows.length - reimportCount} fewer)`);

  if (seedPath) {
    if (!existsSync(seedPath)) fail(`seed not found: ${seedPath}`);
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as { transactions: unknown[] };
    console.log(`  seed check: ${seed.transactions.length} transactions in ${seedPath}` +
      (seed.transactions.length === toDelete.length ? ' — matches the rows to delete' :
        ` — DIFFERS from the ${toDelete.length} rows to delete; investigate before running`));
  }

  // ── 5. Backup (outside the repo) ──────────────────────────────────────────
  mkdirSync(outResolved, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(outResolved, `mny-reimport-plan-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    userId,
    discriminator: 'external_transaction_id IS NULL (legacy) OR import_source IS NOT NULL',
    toleranceDays,
    wouldDeleteTransactions: toDelete,
    wouldDeleteSplits: splitsUnderDelete,
    feedOverlapMatches: overlap.matches,
    feedRowsKept: feedRows.map(t => t.id),
  }, null, 1));
  console.log(`\nBACKUP of every row this plan would delete: ${backupPath}`);
  console.log('  (contains real financial data — keep it out of the repository)');

  // ── 6. The destructive path — deliberately absent ─────────────────────────
  if (APPLY) {
    console.error('\n--apply is NOT IMPLEMENTED.');
    console.error('');
    console.error('TODO (human): before enabling a delete path here, it must');
    console.error('  1. NULL linked_transfer_id / linked_transfer_split_id on any KEPT row that');
    console.error('     points at a row being deleted (feed rows can reference imported ones);');
    console.error('  2. delete transaction_splits children before their parents;');
    console.error('  3. re-run the importer with BOTH the provenance columns and the feed-overlap');
    console.error('     suppression set, or the overlap this plan measures comes straight back;');
    console.error('  4. re-assert the ledger invariant per account');
    console.error('     (initial_balance + Σ transactions = balance) afterwards — deleting rows');
    console.error('     changes the sum and `balance` must be rebased to match;');
    console.error('  5. run scripts/mnyIdempotencyCheck.mts against a scratch copy first.');
    process.exit(2);
  }
  console.log('\nDRY RUN complete — nothing was changed.');
})();
