/**
 * MS Money re-import — PLAN (read-only) and APPLY (scoped delete + re-import).
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
 * provenance-carrying import has run. For rows written before provenance
 * existed the discriminator is `external_transaction_id IS NULL`, and the
 * script prints the evidence for it (row counts per created_at day, per
 * provenance state) so a human can confirm the two populations really are
 * cleanly separable. If they are not — if any single row carries BOTH markers
 * — the script refuses, in dry run and in apply alike.
 *
 * ── The two modes ──────────────────────────────────────────────────────────
 * DRY RUN (default) is read-only. It prints the plan and writes it, with the
 * rows it would delete, to a file OUTSIDE the repository. That file is also
 * the BASELINE: apply re-reads it and refuses to run if the database has moved
 * since (see PlanBaseline / compareToBaseline in
 * src/services/import/msMoney/reimportGuards.ts).
 *
 * APPLY is destructive and, in order:
 *   0. refuses unless the target database is the one the confirmation flag
 *      claims it is, and unless the plan file, the seed and the live database
 *      still agree;
 *   0b. does NOTHING AT ALL if the database is already in the target state —
 *      so a second run is a no-op, not a second demolition;
 *   1. writes a complete backup of every row it will delete, reads it back and
 *      verifies it row for row. No verified backup ⇒ no delete (the delete
 *      function cannot even be called without the receipt that check issues);
 *   2. deletes the file rows, each DELETE carrying
 *      `external_transaction_id IS NULL` so the database itself refuses to
 *      hand over a bank-feed row;
 *   3. re-imports through the REAL importer (`planCloudImport` +
 *      `executeCloudPlan` — batched, retrying, idempotent), with the
 *      feed-overlap suppression set and full provenance;
 *   4. verifies: counts, the bank-feed population unchanged row for row, no
 *      orphaned category, no parentless split, provenance on every imported
 *      row, and the per-account ledger invariant. Any breach exits non-zero.
 *
 * THIS OPERATION IS NOT ATOMIC ACROSS TABLES. If it dies partway it says
 * exactly what it had done and where the backup is.
 *
 * Usage:
 *   # preview (read-only) — writes the plan + baseline outside the repo
 *   npx tsx scripts/mnyReimportPlan.mts --out /path/outside/repo \
 *     --seed .mny-local/mny-local-seed.json
 *
 *   # apply, against the database the plan was taken from
 *   npx tsx scripts/mnyReimportPlan.mts --apply --out /path/outside/repo \
 *     --seed .mny-local/mny-local-seed.json \
 *     --plan /path/outside/repo/mny-reimport-plan-<stamp>.json \
 *     --i-understand-this-deletes-production-rows
 *
 *   # the same against the scratch project (--env .env.scratch)
 *   npx tsx scripts/mnyReimportPlan.mts --apply --env .env.scratch … \
 *     --i-know-this-is-a-scratch-database
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { findFeedOverlap, type ExistingFeedTransaction, type FeedOverlapResult } from '../src/services/import/msMoney/feedOverlap.ts';
import {
  planCloudImport, executeCloudPlan, fetchExistingImportState, MS_MONEY_IMPORT_SOURCE,
} from '../src/services/import/msMoney/msMoneyImport.ts';
import {
  splitPopulations, findFeedRowsInDeleteSet, compareToBaseline, verifyBackupContents,
  describeTargetState, mapFeedRowsToSeedNamespace, findOrphanedCategoryIds, findParentlessSplitIds,
  deleteFileOriginRows, REIMPORT_PLAN_VERSION,
  type PlanBaseline, type LivePlanState,
} from '../src/services/import/msMoney/reimportGuards.ts';
import type { MsMoneyImportResult } from '../src/services/import/msMoney/transform.ts';
import type { Transaction } from '../src/types/index.ts';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const CONFIRM_PRODUCTION = args.includes('--i-understand-this-deletes-production-rows');
const CONFIRM_SCRATCH = args.includes('--i-know-this-is-a-scratch-database');
const outDir = flag('out');
const seedPath = flag('seed');
const planPath = flag('plan');
const envPath = flag('env') ?? '.env.local';
const toleranceDays = Number(flag('tolerance') ?? 3);

const USAGE = 'usage: tsx scripts/mnyReimportPlan.mts --out <dir outside the repo> ' +
  '[--seed seed.json] [--env .env.local] [--tolerance 3]\n' +
  '       …--apply --seed <seed.json> --plan <plan from the dry run> ' +
  '(--i-understand-this-deletes-production-rows | --i-know-this-is-a-scratch-database)';

// ── Where the run got to, for the message it prints if it dies ──────────────
// Declared before the first guard, because the first guard can already abort.
const progress = {
  backupPath: null as string | null,
  splitsDeleted: 0,
  transactionsDeleted: 0,
  deleteFinished: false,
  importFinished: false,
  verified: false,
};

function reportInterruptedState(): void {
  console.error('\n──────────────────────────────────────────────────────────────');
  console.error('STATE AT FAILURE — this operation is NOT atomic across tables.');
  console.error(`  backup written      : ${progress.backupPath ?? 'NO — nothing was deleted'}`);
  console.error(`  split lines deleted : ${progress.splitsDeleted}`);
  console.error(`  transactions deleted: ${progress.transactionsDeleted}` +
    (progress.deleteFinished ? ' (delete pass finished)' : ' (delete pass INCOMPLETE)'));
  console.error(`  re-import           : ${progress.importFinished ? 'finished' : 'NOT finished'}`);
  console.error(`  verification        : ${progress.verified ? 'passed' : 'NOT run / not passed'}`);
  console.error('');
  if (!progress.backupPath) {
    console.error('  Nothing was deleted. The database is untouched.');
  } else {
    console.error('  Every deleted row is in the backup above (complete rows, transactions + splits).');
    console.error('  RECOVERY: re-run the DRY RUN to take a fresh plan of the database as it now is,');
    console.error('  then run --apply again with that plan. The importer is idempotent and the seed is');
    console.error('  the source of truth, so a resumed run finishes the job rather than duplicating it.');
    console.error('  Bank-feed rows are untouched by every path in this script.');
  }
  console.error('──────────────────────────────────────────────────────────────');
}

/** Declared, not inferred: TS only narrows on a never-returning call when the type is written down. */
function fail(msg: string): never {
  console.error(`\nABORT: ${msg}`);
  // Once the backup exists, every abort is an abort MID-OPERATION: say what was
  // done before saying goodbye.
  if (APPLY && progress.backupPath) reportInterruptedState();
  process.exit(1);
}

if (!outDir) {
  console.error(USAGE);
  process.exit(1);
}
const outResolved = resolve(outDir);
const repoRoot = resolve('.');
if (outResolved === repoRoot || outResolved.startsWith(repoRoot + sep)) {
  console.error(`ABORT: --out must be OUTSIDE the repository (the repo is public). Got ${outResolved}`);
  process.exit(1);
}
if (!Number.isFinite(toleranceDays) || toleranceDays < 0) fail(`--tolerance must be a non-negative number, got ${flag('tolerance')}`);

// ── Environment (never printed) ──────────────────────────────────────────────
const readEnv = (path: string): Record<string, string> => Object.fromEntries(
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const urlOf = (path: string): string | undefined =>
  existsSync(path) ? readEnv(path).VITE_SUPABASE_URL : undefined;

if (!existsSync(envPath)) fail(`env file not found: ${envPath}`);
const env = readEnv(envPath);
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail(`Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ${envPath}`);

/**
 * Which database is this, really?
 *
 * The confirmation flag is not a formality, it is an ASSERTION about the
 * target, and each one is checked against the file that defines that target.
 * Claiming production while pointed at scratch means the numbers just reviewed
 * belong to a different database; claiming scratch while pointed at production
 * is the accident this whole script exists to avoid. Both are refused.
 *
 * (The mirror image of the guard in scripts/mnyIdempotencyCheck.mts, which only
 * ever writes to scratch and so refuses production outright. This script's
 * normal home IS production, so it cannot use that rule — it has to check the
 * claim instead.)
 */
if (APPLY) {
  const prodUrl = urlOf('.env.local');
  const scratchUrl = urlOf('.env.scratch');
  if (CONFIRM_PRODUCTION === CONFIRM_SCRATCH) {
    fail('--apply needs exactly ONE of --i-understand-this-deletes-production-rows / ' +
      '--i-know-this-is-a-scratch-database — the flag states which database this is, and it is verified.');
  }
  if (CONFIRM_PRODUCTION) {
    if (scratchUrl && url === scratchUrl) {
      fail('--i-understand-this-deletes-production-rows was given, but the target is the SAME project as ' +
        '.env.scratch. Use --i-know-this-is-a-scratch-database for scratch runs.');
    }
    if (!prodUrl) fail('.env.local is missing, so "this is production" cannot be verified. Refusing.');
    if (url !== prodUrl) {
      fail(`--i-understand-this-deletes-production-rows was given, but ${envPath} does not name the same ` +
        'project as .env.local. Refusing to delete from a database nobody has identified.');
    }
  }
  if (CONFIRM_SCRATCH) {
    if (!scratchUrl) fail('.env.scratch is missing, so "this is scratch" cannot be verified. Refusing.');
    if (url !== scratchUrl) {
      fail(`--i-know-this-is-a-scratch-database was given, but ${envPath} does not name the same project as ` +
        '.env.scratch. Refusing.');
    }
    if (prodUrl && url === prodUrl) fail('.env.scratch and .env.local name the SAME project. Refusing to touch it.');
  }
  if (!seedPath) fail('--apply needs --seed: the re-import is driven by the extracted .mny seed.');
  if (!planPath) fail('--apply needs --plan <file written by the dry run>: it is the baseline the live database is checked against.');
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

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
interface DbSplit { id: string; transaction_id: string; user_id: string }

/** Paged read of one table. `userId` scopes it to the target user when given. */
async function fetchAll<T>(table: string, cols: string, userId?: string): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // `.returns<T[]>()` is PostgREST's own way to state the row shape when the
    // column list is a runtime string — no cast, and no `as unknown as`. It has
    // to come after the filters: it hands back a transform builder, not a
    // filter builder.
    const filtered = sb.from(table).select(cols);
    const scoped = userId ? filtered.eq('user_id', userId) : filtered;
    const { data, error } = await scoped.order('id').range(from, from + PAGE - 1).returns<T[]>();
    if (error) fail(`reading ${table}: ${error.message}`);
    const page: T[] = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const money = (v: string | number): Decimal => new Decimal(String(v));
const gbp = (d: Decimal): string => `£${d.abs().toFixed(2)}`;

// ── The seed ────────────────────────────────────────────────────────────────
interface SeedShape {
  accounts: MsMoneyImportResult['accounts'];
  categories: MsMoneyImportResult['categories'];
  transactions: MsMoneyImportResult['transactions'];
  transactionSplits: MsMoneyImportResult['transactionSplits'];
  summary?: MsMoneyImportResult['summary'];
}
interface LoadedSeed { result: MsMoneyImportResult; sha256: string }

function loadSeed(path: string): LoadedSeed {
  if (!existsSync(path)) fail(`seed not found: ${path}`);
  const raw = readFileSync(path, 'utf8');
  const seed = JSON.parse(raw) as SeedShape;
  if (!Array.isArray(seed.transactions) || !Array.isArray(seed.accounts)) {
    fail(`seed ${path} does not look like an .mny extract (no transactions/accounts arrays)`);
  }
  return {
    sha256: createHash('sha256').update(raw).digest('hex'),
    result: {
      accounts: seed.accounts,
      categories: seed.categories,
      transactions: seed.transactions,
      transactionSplits: seed.transactionSplits,
      summary: seed.summary ?? {
        accounts: { total: 0, open: 0, closed: 0, investmentCashPairs: 0 },
        categories: { subs: 0, details: 0, hidden: 0 },
        transactions: { imported: 0, standalone: 0, transfers: 0, splitTransactions: 0, splitLines: 0 },
        simplifications: [],
      },
    },
  };
}

// ── Plan computation, shared by both modes ──────────────────────────────────
interface LivePlan {
  userId: string;
  rows: DbTxn[];
  feedRows: DbTxn[];
  toDelete: DbTxn[];
  allSplits: DbSplit[];
  splitsUnderDelete: DbSplit[];
  dbOverlap: FeedOverlapResult;
  seedOverlap: FeedOverlapResult | null;
  unmappedFeedRows: number;
  duplicateAccountNames: string[];
  hasProvenanceColumns: boolean;
}

async function computeLivePlan(seed: LoadedSeed | null): Promise<LivePlan> {
  const { data: users, error: uerr } = await sb.from('users').select('id, email');
  if (uerr || !users?.length) fail(`cannot read users: ${uerr?.message ?? 'none'}`);

  // Provenance columns are optional only for the preview: this plan is most
  // useful BEFORE migration 20260722170000 is applied, when every file row is
  // still unmarked. Applying without them would write an import that is not
  // idempotent, so apply requires them.
  const probe = await sb.from('transactions').select('import_source_id').limit(1);
  const hasProvenance = !probe.error;
  if (!hasProvenance) {
    if (APPLY) {
      fail('provenance columns missing — apply ' +
        'supabase/migrations/20260722170000_transaction_import_provenance.sql first, or the re-import ' +
        'cannot be idempotent and this whole exercise repeats itself.');
    }
    console.log('NOTE: migration 20260722170000 is not applied yet — no row carries import');
    console.log('      provenance, so population A is identified by the fallback discriminator.\n');
  }

  const BASE_COLS = 'id,user_id,account_id,description,amount,type,date,category,is_split,' +
    'linked_transfer_id,external_transaction_id,created_at';
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
  // The target is the user actually holding the imported history.
  const [userId, rows] = [...byUser.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!userId || !rows) fail('no transactions found');
  console.log(`Target user: ${userId} — ${rows.length} transactions ` +
    `(other users hold ${all.length - rows.length}, untouched by this plan)\n`);

  // ── 1. Separate the two populations ────────────────────────────────────────
  const populations = splitPopulations(rows);
  console.log('POPULATIONS');
  console.log(`  bank feed  (external_transaction_id set) : ${populations.feed.length}  — NEVER deleted`);
  console.log(`  file import (import_source set)          : ${populations.provenanced.length}`);
  console.log(`  file import (legacy, no provenance)      : ${populations.legacy.length}`);

  // Both discriminators must agree that the populations are disjoint.
  if (populations.conflicted.length) {
    fail(`${populations.conflicted.length} row(s) carry BOTH a bank-feed id and file provenance — ` +
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

  const toDelete = [...populations.provenanced, ...populations.legacy];
  // Belt and braces: the delete set is derived from the split above, so this
  // can only fire if that ever changes. It is still asserted, every run.
  const contaminated = findFeedRowsInDeleteSet(toDelete);
  if (contaminated.length) {
    fail(`${contaminated.length} row(s) in the delete set carry a bank-feed id (${contaminated[0].id}, …) — refusing.`);
  }

  // ── 2. Which file rows would the feed already cover on re-import? ──────────
  // Measured twice, deliberately:
  //   * in the DATABASE's namespace, file rows against feed rows — the evidence
  //     a human reads, since both sides are rows they can go and look at;
  //   * in the SEED's namespace, the actual .mny rows against the same feed rows
  //     translated onto the seed's accounts — which is what the re-import will
  //     really suppress, and therefore what apply uses.
  // On an unedited database the two agree. Where they do not, the difference is
  // printed rather than averaged away.
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

  const asFeedShape: ExistingFeedTransaction[] = populations.feed.map(t => ({
    id: t.id,
    accountId: t.account_id,
    date: t.date,
    amount: String(t.amount),
    description: t.description ?? '',
  }));

  const dbOverlap = findFeedOverlap(asImportShape, asFeedShape, { dateToleranceDays: toleranceDays });

  let seedOverlap: FeedOverlapResult | null = null;
  let unmappedFeedRows = 0;
  let duplicateAccountNames: string[] = [];
  if (seed) {
    const dbAccounts = await fetchAll<{ id: string; name: string }>('accounts', 'id,name', userId);
    const mapped = mapFeedRowsToSeedNamespace(
      seed.result.accounts.map(a => ({ id: a.id, name: a.name })),
      dbAccounts,
      populations.feed.map(t => ({
        id: t.id, account_id: t.account_id, date: t.date, amount: t.amount, description: t.description,
      }))
    );
    unmappedFeedRows = mapped.unmapped.length;
    duplicateAccountNames = mapped.duplicateNames;
    seedOverlap = findFeedOverlap(seed.result.transactions, mapped.rows, { dateToleranceDays: toleranceDays });
  }

  const suppressedById = new Map(toDelete.map(t => [t.import_source_id ?? t.id, t]));
  const suppressedRows = [...dbOverlap.suppressedSourceIds]
    .map(id => suppressedById.get(id))
    .filter((t): t is DbTxn => t != null);
  const suppressedValue = suppressedRows.reduce((s, t) => s.plus(money(t.amount)), new Decimal(0));

  console.log(`\nFEED OVERLAP (±${toleranceDays} days, exact pence, same account, 1:1)`);
  console.log(`  file rows the feed already covers   : ${dbOverlap.matches.length}  (${gbp(suppressedValue)})`);
  console.log(`  feed rows with no file counterpart  : ${dbOverlap.unmatchedFeedIds.length}  — genuine feed-only spending, kept`);
  console.log(`  overlaps deliberately NOT suppressed : ${dbOverlap.keptDespiteOverlap.transfers} transfer leg(s), ` +
    `${dbOverlap.keptDespiteOverlap.splitParents} split parent(s)`);
  const sameDay = dbOverlap.matches.filter(m => m.dayGap === 0).length;
  const strongDesc = dbOverlap.matches.filter(m => m.descriptionSimilarity > 0).length;
  console.log(`  match quality: ${sameDay}/${dbOverlap.matches.length} same-day, ` +
    `${strongDesc}/${dbOverlap.matches.length} with overlapping description text`);
  if (seedOverlap) {
    console.log(`  same measurement against the SEED itself: ${seedOverlap.matches.length} suppressed ` +
      `(this is the number the re-import uses)`);
    if (seedOverlap.matches.length !== dbOverlap.matches.length) {
      console.log('  NOTE: the two measurements differ. That means the rows in the database are not row-for-row');
      console.log('        the rows in this seed (edited, partially imported, or a different export).');
    }
    if (unmappedFeedRows) {
      console.log(`  ${unmappedFeedRows} feed row(s) sit in accounts the seed does not have — kept, and they`);
      console.log('        cannot overlap anything the import writes.');
    }
    if (duplicateAccountNames.length) {
      console.log(`  ${duplicateAccountNames.length} account name(s) appear more than once; they are paired in the`);
      console.log('        same order the importer pairs them, so the overlap is measured where it lands.');
    }
  }

  // ── 3. Relationships the delete path must handle ──────────────────────────
  const deleteIds = new Set(toDelete.map(t => t.id));
  const allSplits = await fetchAll<DbSplit>('transaction_splits', 'id,transaction_id,user_id');
  const splitsUnderDelete = allSplits.filter(s => deleteIds.has(s.transaction_id));
  const orphanedSplits = allSplits.filter(s => !deleteIds.has(s.transaction_id) && s.user_id === userId);
  const feedLinkedToDeleted = populations.feed.filter(t => t.linked_transfer_id && deleteIds.has(t.linked_transfer_id));

  console.log('\nRELATIONSHIPS');
  console.log(`  transaction_splits under deleted parents : ${splitsUnderDelete.length} (deleted with them)`);
  console.log(`  transaction_splits under KEPT parents    : ${orphanedSplits.length} (untouched)`);
  console.log(`  feed rows whose linked_transfer_id points at a deleted row: ${feedLinkedToDeleted.length}` +
    (feedLinkedToDeleted.length
      ? ' — the FK is ON DELETE SET NULL, so the survivor is unlinked, never left dangling'
      : ''));

  return {
    userId, rows, feedRows: populations.feed, toDelete, allSplits, splitsUnderDelete,
    dbOverlap, seedOverlap, unmappedFeedRows, duplicateAccountNames, hasProvenanceColumns: hasProvenance,
  };
}

/** The plan's headline numbers, printed identically in both modes. */
function printPlan(plan: LivePlan, seed: LoadedSeed | null): { importCount: number; netCount: number } {
  const deletedValue = plan.toDelete.reduce((s, t) => s.plus(money(t.amount)), new Decimal(0));
  const suppressedCount = plan.seedOverlap?.matches.length ?? plan.dbOverlap.matches.length;
  const sourceCount = seed ? seed.result.transactions.length : plan.toDelete.length;
  const importCount = sourceCount - suppressedCount;
  const netCount = plan.feedRows.length + importCount;

  console.log('\nPLAN');
  console.log(`  DELETE  ${plan.toDelete.length} file-import transactions (net ${gbp(deletedValue)}) ` +
    `+ ${plan.splitsUnderDelete.length} split lines`);
  console.log(`  KEEP    ${plan.feedRows.length} bank-feed transactions, all accounts, all categories, ` +
    'all budgets, all goals');
  console.log(`  IMPORT  ${importCount} transactions from the file ` +
    `(= ${sourceCount} source rows − ${suppressedCount} the feed already covers)`);
  console.log(`  NET     ${netCount} transactions afterwards ` +
    `(was ${plan.rows.length}; ${plan.rows.length - netCount} fewer)`);

  if (seed) {
    console.log(`  seed check: ${seed.result.transactions.length} transactions in the seed` +
      (seed.result.transactions.length === plan.toDelete.length ? ' — matches the rows to delete' :
        ` — DIFFERS from the ${plan.toDelete.length} rows to delete; investigate before applying`));
  }
  return { importCount, netCount };
}

function buildBaseline(plan: LivePlan, seed: LoadedSeed, counts: { importCount: number; netCount: number }): PlanBaseline {
  return {
    version: REIMPORT_PLAN_VERSION,
    userId: plan.userId,
    toleranceDays,
    seedSha256: seed.sha256,
    seedTransactionCount: seed.result.transactions.length,
    deleteTransactionIds: plan.toDelete.map(t => t.id),
    deleteSplitIds: plan.splitsUnderDelete.map(s => s.id),
    feedTransactionIds: plan.feedRows.map(t => t.id),
    suppressedSourceIds: [...(plan.seedOverlap?.suppressedSourceIds ?? new Set<string>())],
    expectedImportCount: counts.importCount,
    expectedNetCount: counts.netCount,
  };
}

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

// ── DRY RUN ─────────────────────────────────────────────────────────────────
async function dryRun(seed: LoadedSeed | null): Promise<void> {
  console.log('MS Money re-import PLAN — dry run, read-only, nothing is deleted.\n');
  const plan = await computeLivePlan(seed);
  if (!plan.toDelete.length) { console.log('\nNothing to re-import — no file-import rows found.'); return; }
  const counts = printPlan(plan, seed);

  mkdirSync(outResolved, { recursive: true });
  const planFile = join(outResolved, `mny-reimport-plan-${stamp()}.json`);
  writeFileSync(planFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    userId: plan.userId,
    discriminator: 'external_transaction_id IS NULL (legacy) OR import_source IS NOT NULL',
    toleranceDays,
    baseline: seed ? buildBaseline(plan, seed, counts) : null,
    wouldDeleteTransactions: plan.toDelete,
    wouldDeleteSplits: plan.splitsUnderDelete,
    feedOverlapMatches: plan.dbOverlap.matches,
    seedOverlapMatches: plan.seedOverlap?.matches ?? null,
    feedRowsKept: plan.feedRows.map(t => t.id),
  }, null, 1));
  console.log(`\nPLAN + BACKUP of every row this plan would delete: ${planFile}`);
  console.log('  (contains real financial data — keep it out of the repository)');
  if (!seed) {
    console.log('\nNo --seed given, so this file carries NO baseline and --apply will not accept it.');
    console.log('Re-run with --seed <the .mny extract> to produce an applicable plan.');
  } else {
    console.log('\nTo apply this exact plan:');
    console.log(`  npx tsx scripts/mnyReimportPlan.mts --apply --env ${envPath} --out ${outResolved} \\`);
    console.log(`    --seed ${seedPath} --plan ${planFile} \\`);
    console.log('    --i-understand-this-deletes-production-rows   # or --i-know-this-is-a-scratch-database');
  }
  console.log('\nDRY RUN complete — nothing was changed.');
}

// ── APPLY ───────────────────────────────────────────────────────────────────

/** Full rows, every column, for the backup. Paged like every other read here. */
async function fetchFullRows(table: string, userId: string): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').eq('user_id', userId)
      .order('id').range(from, from + PAGE - 1);
    if (error) fail(`reading ${table} for the backup: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Per-account ledger invariant: initial_balance + Σ transactions === balance. */
async function ledgerBreaches(userId: string): Promise<{ broken: number; accounts: number }> {
  const accounts = await fetchAll<{ id: string; balance: string | number | null; initial_balance: string | number | null }>(
    'accounts', 'id,balance,initial_balance', userId);
  const txns = await fetchAll<{ account_id: string; amount: string | number }>(
    'transactions', 'account_id,amount', userId);
  const sums = new Map<string, Decimal>();
  for (const t of txns) sums.set(t.account_id, (sums.get(t.account_id) ?? new Decimal(0)).plus(money(t.amount)));
  let broken = 0;
  for (const a of accounts) {
    const computed = money(a.initial_balance ?? 0).plus(sums.get(a.id) ?? new Decimal(0));
    if (!computed.equals(money(a.balance ?? 0))) broken++;
  }
  return { broken, accounts: accounts.length };
}

async function apply(seed: LoadedSeed): Promise<void> {
  console.log('MS Money re-import APPLY — this DELETES file-import rows and re-imports them.\n');
  console.log(`Target: ${new URL(url).host} (from ${envPath})\n`);

  if (!planPath) fail('--apply needs --plan <file written by the dry run>.');
  const baselineFile = planPath;
  if (!existsSync(baselineFile)) fail(`plan file not found: ${baselineFile}`);
  const planDoc = JSON.parse(readFileSync(baselineFile, 'utf8')) as { baseline?: PlanBaseline | null };
  const baseline = planDoc.baseline;
  if (!baseline) {
    fail(`${baselineFile} carries no baseline — it was written by a dry run without --seed. Re-run the dry run with --seed.`);
  }

  const plan = await computeLivePlan(seed);
  const counts = printPlan(plan, seed);

  // ── 0b. Is the work already done? ─────────────────────────────────────────
  const seedSourceIds = new Set(seed.result.transactions.map(t => t.id));
  const suppressed = plan.seedOverlap?.suppressedSourceIds ?? new Set<string>();
  const target = describeTargetState({
    fileRows: plan.toDelete,
    seedSourceIds,
    suppressedSourceIds: suppressed,
    importSource: MS_MONEY_IMPORT_SOURCE,
  });
  console.log('\nTARGET STATE');
  if (target.satisfied) {
    console.log('  the database ALREADY holds exactly the rows a successful apply would leave.');
    console.log('  Nothing to do: no backup, no delete, no import. Exiting without touching anything.');
    return;
  }
  for (const reason of target.reasons) console.log(`  not yet: ${reason}`);

  // Provenanced rows about to be deleted must have come from THIS seed.
  const foreignProvenance = plan.toDelete.filter(
    t => t.import_source_id != null && !seedSourceIds.has(t.import_source_id)
  );
  if (foreignProvenance.length) {
    fail(`${foreignProvenance.length} row(s) to delete carry an import_source_id that is not in this seed ` +
      `(e.g. ${foreignProvenance[0].import_source_id}) — this seed is not the export those rows came from.`);
  }

  // ── 1. Drift ──────────────────────────────────────────────────────────────
  const live: LivePlanState = {
    userId: plan.userId,
    toleranceDays,
    seedSha256: seed.sha256,
    seedTransactionCount: seed.result.transactions.length,
    deleteTransactionIds: plan.toDelete.map(t => t.id),
    deleteSplitIds: plan.splitsUnderDelete.map(s => s.id),
    feedTransactionIds: plan.feedRows.map(t => t.id),
    suppressedSourceIds: [...suppressed],
    expectedImportCount: counts.importCount,
    expectedNetCount: counts.netCount,
  };
  const drift = compareToBaseline(baseline, live);
  console.log('\nDRIFT CHECK against the reviewed plan');
  if (drift.drifted) {
    for (const line of drift.lines) console.error(`  ${line}`);
    fail('the database is not what the plan describes. Nothing has been touched. ' +
      'Re-run the DRY RUN, read the new numbers, and apply that plan instead.');
  }
  console.log('  the live database matches the plan exactly — same rows, same seed, same counts.');

  const ledgerBefore = await ledgerBreaches(plan.userId);

  // ── 2. Backup, before anything is destroyed ───────────────────────────────
  mkdirSync(outResolved, { recursive: true });
  const backupPath = join(outResolved, `mny-reimport-backup-${stamp()}.json`);
  console.log('\nBACKUP');
  const deleteIds = new Set(plan.toDelete.map(t => t.id));
  const splitIdsToDelete = plan.splitsUnderDelete.map(s => s.id);
  const splitIdSet = new Set(splitIdsToDelete);
  const fullTxns = (await fetchFullRows('transactions', plan.userId)).filter(r => deleteIds.has(String(r.id)));
  const fullSplits = (await fetchFullRows('transaction_splits', plan.userId)).filter(r => splitIdSet.has(String(r.id)));
  writeFileSync(backupPath, JSON.stringify({
    writtenAt: new Date().toISOString(),
    userId: plan.userId,
    planFile: baselineFile,
    seedSha256: seed.sha256,
    note: 'Complete rows, every column, for every row the apply pass deleted. Re-inserting ' +
      'transactions then splits restores them exactly; links that pointed at them were SET NULL by the FK.',
    transactions: fullTxns,
    splits: fullSplits,
  }));
  progress.backupPath = backupPath;
  console.log(`  written: ${backupPath}`);

  // Read it BACK off the disk — a file that cannot be re-read is not a backup.
  const { receipt, problems } = verifyBackupContents(readFileSync(backupPath, 'utf8'), {
    path: backupPath,
    transactionIds: [...deleteIds],
    splitIds: splitIdsToDelete,
  });
  if (!receipt) {
    for (const p of problems) console.error(`  ${p}`);
    progress.backupPath = null; // nothing was deleted; do not imply a usable backup
    fail('the backup does not hold every row that would be deleted. NOTHING has been deleted.');
  }
  console.log(`  verified on disk: ${receipt.transactionIds.size} transactions + ${receipt.splitIds.size} split lines, ` +
    'no bank-feed row among them.');

  // ── 3. Delete ─────────────────────────────────────────────────────────────
  console.log('\nDELETING (file-import rows only; every statement carries external_transaction_id IS NULL)');
  const outcome = await deleteFileOriginRows(
    sb,
    receipt,
    plan.toDelete.map(t => t.id),
    splitIdsToDelete,
    (stage, done, total) => {
      if (stage === 'splits') progress.splitsDeleted = done; else progress.transactionsDeleted = done;
      process.stdout.write(`\r  ${stage}: ${done}/${total}`);
    }
  );
  process.stdout.write('\n');
  progress.splitsDeleted = outcome.splitsDeleted;
  progress.transactionsDeleted = outcome.transactionsDeleted;
  if (outcome.transactionsDeleted !== plan.toDelete.length || outcome.splitsDeleted !== splitIdsToDelete.length) {
    fail(`delete pass removed ${outcome.transactionsDeleted}/${plan.toDelete.length} transactions and ` +
      `${outcome.splitsDeleted}/${splitIdsToDelete.length} split lines. Some rows refused to go ` +
      '(a bank-feed id appearing mid-run would do it). STOP and investigate before re-importing.');
  }
  progress.deleteFinished = true;
  console.log(`  deleted ${outcome.transactionsDeleted} transactions and ${outcome.splitsDeleted} split lines.`);

  // ── 4. Re-import through the real importer ────────────────────────────────
  console.log('\nRE-IMPORTING (planCloudImport + executeCloudPlan — the same path the app uses)');
  const existing = await fetchExistingImportState(sb, plan.userId);
  const importPlan = planCloudImport(seed.result, plan.userId, randomUUID, {
    ...existing,
    suppressedSourceIds: suppressed,
  });
  console.log(`  plan: ${importPlan.transactions.length} transactions, ${importPlan.splits.length} split lines, ` +
    `${importPlan.accounts.length} new accounts, ${importPlan.categories.length} new categories`);
  console.log(`  skipped: ${importPlan.skippedFeedOverlap} covered by the feed, ${importPlan.skippedExisting} already present, ` +
    `${importPlan.skippedExistingAccounts} accounts / ${importPlan.skippedExistingCategories} categories reused`);
  if (importPlan.categoriesWithUnresolvedParent > 0) {
    fail(`${importPlan.categoriesWithUnresolvedParent} categories have no resolvable parent — the seed tree is broken. ` +
      'The delete has already run; see the state report.');
  }
  if (importPlan.transactions.length !== counts.importCount) {
    fail(`the importer planned ${importPlan.transactions.length} inserts but the reviewed plan said ` +
      `${counts.importCount}. Refusing to write. The delete has already run; see the state report.`);
  }
  let lastPhase = '';
  await executeCloudPlan(importPlan, sb, {
    onProgress: p => {
      if (p.phase !== lastPhase) { if (lastPhase) process.stdout.write('\n'); lastPhase = p.phase; }
      process.stdout.write(`\r  ${p.message.padEnd(60)}`);
    },
  });
  process.stdout.write('\n');
  progress.importFinished = true;

  // ── 5. Verify ─────────────────────────────────────────────────────────────
  console.log('\nVERIFYING');
  const failures: string[] = [];
  const after = await fetchAll<DbTxn>('transactions',
    'id,user_id,account_id,description,amount,type,date,category,is_split,linked_transfer_id,' +
    'external_transaction_id,import_source,import_source_id,created_at', plan.userId);
  const afterSplits = await fetchAll<DbSplit>('transaction_splits', 'id,transaction_id,user_id', plan.userId);
  const afterCategories = await fetchAll<{ id: string; parent_id: string | null }>('categories', 'id,parent_id', plan.userId);
  const afterAccounts = await fetchAll<{ id: string }>('accounts', 'id', plan.userId);

  const afterPopulations = splitPopulations(after);
  console.log(`  counts: ${after.length} transactions, ${afterSplits.length} split lines, ` +
    `${afterAccounts.length} accounts, ${afterCategories.length} categories`);

  // (a) every bank-feed row still there, row for row.
  const feedBefore = new Set(plan.feedRows.map(t => t.id));
  const feedAfter = new Set(afterPopulations.feed.map(t => t.id));
  const lostFeed = [...feedBefore].filter(id => !feedAfter.has(id));
  const newFeed = [...feedAfter].filter(id => !feedBefore.has(id));
  console.log(`  bank-feed rows: ${feedBefore.size} before → ${feedAfter.size} after`);
  if (lostFeed.length) failures.push(`${lostFeed.length} bank-feed row(s) are GONE (e.g. ${lostFeed[0]})`);
  if (newFeed.length) failures.push(`${newFeed.length} bank-feed row(s) appeared that were not there before`);

  // (b) no row carries both markers; no file row is left without provenance.
  if (afterPopulations.conflicted.length) failures.push(`${afterPopulations.conflicted.length} row(s) now carry BOTH markers`);
  if (afterPopulations.legacy.length) failures.push(`${afterPopulations.legacy.length} file row(s) still carry no provenance`);
  const provenanced = afterPopulations.provenanced.filter(t => t.import_source === MS_MONEY_IMPORT_SOURCE);
  const distinctSourceIds = new Set(provenanced.map(t => t.import_source_id));
  console.log(`  provenance: ${provenanced.length} rows carry ms-money provenance, ` +
    `${distinctSourceIds.size} distinct source ids`);
  if (provenanced.length !== counts.importCount) {
    failures.push(`${provenanced.length} provenanced rows, expected ${counts.importCount}`);
  }
  if (distinctSourceIds.size !== provenanced.length) {
    failures.push('two imported rows share an import_source_id');
  }
  const suppressedPresent = [...suppressed].filter(id => distinctSourceIds.has(id));
  if (suppressedPresent.length) {
    failures.push(`${suppressedPresent.length} feed-covered row(s) were re-imported anyway (e.g. ${suppressedPresent[0]})`);
  }

  // (c) totals.
  if (after.length !== counts.netCount) failures.push(`${after.length} transactions, the plan said ${counts.netCount}`);

  // (d) referential integrity.
  const orphanedCategories = findOrphanedCategoryIds(afterCategories);
  if (orphanedCategories.length) failures.push(`${orphanedCategories.length} categor(ies) point at a parent that does not exist`);
  const afterTxnIds = new Set(after.map(t => t.id));
  const parentless = findParentlessSplitIds(afterSplits, afterTxnIds);
  if (parentless.length) failures.push(`${parentless.length} split line(s) have no parent transaction`);
  const danglingLinks = after.filter(t => t.linked_transfer_id != null && !afterTxnIds.has(t.linked_transfer_id));
  if (danglingLinks.length) failures.push(`${danglingLinks.length} transfer link(s) point at a row that does not exist`);
  console.log(`  integrity: ${orphanedCategories.length} orphaned categories, ${parentless.length} parentless splits, ` +
    `${danglingLinks.length} dangling transfer links`);

  // (e) did the double-counting actually go away?
  const signature = (t: DbTxn): string =>
    `${t.account_id}|${t.date}|${money(t.amount).times(100).round().toString()}|${(t.description ?? '').trim().toUpperCase()}`;
  const seen = new Map<string, number>();
  for (const t of after) seen.set(signature(t), (seen.get(signature(t)) ?? 0) + 1);
  const dupGroups = [...seen.values()].filter(n => n > 1).length;
  console.log(`  duplicate (account, date, pence, description) groups remaining: ${dupGroups}`);

  progress.verified = failures.length === 0;

  // ── 6. The ledger invariant ───────────────────────────────────────────────
  const ledgerAfter = await ledgerBreaches(plan.userId);
  console.log(`  ledger invariant (initial_balance + Σ txns = balance): ` +
    `${ledgerAfter.accounts - ledgerAfter.broken}/${ledgerAfter.accounts} accounts OK ` +
    `(was ${ledgerBefore.accounts - ledgerBefore.broken}/${ledgerBefore.accounts} before)`);

  if (failures.length) {
    console.error('\nVERIFICATION FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(`\nThe backup of every deleted row is at ${backupPath}`);
    process.exit(1);
  }

  console.log('\nDONE — file rows replaced, bank-feed rows untouched, every imported row carries provenance.');
  console.log(`Backup of every deleted row: ${backupPath}`);
  console.log('Re-running --apply now is a no-op (the target-state check short-circuits it).');

  if (ledgerAfter.broken > ledgerBefore.broken) {
    // Removing the feed-covered duplicates changes Σ transactions, so the
    // stored balance no longer matches. That is a real, expected consequence —
    // and it is repaired by the tool that owns balance repair, not by a second
    // balance-writing path invented here.
    console.error(`\nREQUIRED FOLLOW-UP: ${ledgerAfter.broken - ledgerBefore.broken} more account(s) now break the ledger`);
    console.error('invariant than before — the suppressed duplicates were part of the stored balance. Repair with:');
    console.error('  node scripts/repair-balance-drift.mjs --strategy=trust-ledger          # dry run');
    console.error('  node scripts/repair-balance-drift.mjs --strategy=trust-ledger --apply');
    process.exit(3);
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────
(async () => {
  const seed = seedPath ? loadSeed(seedPath) : null;
  if (!APPLY) { await dryRun(seed); return; }
  if (!seed) fail('--apply needs --seed.');
  await apply(seed);
})().catch((thrown: unknown) => {
  console.error(`\nFAILED: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  if (APPLY) reportInterruptedState();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.error('\nInterrupted.');
  if (APPLY) reportInterruptedState();
  process.exit(130);
});
