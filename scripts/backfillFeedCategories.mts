/**
 * Restore the categories the MS Money re-import's feed-overlap suppression lost.
 *
 * ── The regression this repairs ────────────────────────────────────────────
 * The re-import (scripts/mnyReimportPlan.mts) deleted the file rows the bank
 * feed already covered and kept the FEED row for each overlapping pair. The
 * feed row is the better record of the amount and the date — and it carries no
 * category, whereas the file row carried the category the user had assigned in
 * Microsoft Money. Since a row with no category is deliberately excluded from
 * every report (utils/incomeExpense.ts — direction is never guessed), the money
 * survived and its classification did not.
 *
 * Everything needed to undo that is still on disk and in the database:
 *   - the apply pass wrote a COMPLETE backup of every deleted row, categories
 *     included, before it deleted anything;
 *   - the re-import REUSED the user's categories rather than recreating them,
 *     so those category ids are still valid. This script does not assume that:
 *     it checks every id against the live `categories` table and reports any
 *     that have vanished, loudly, rather than writing a dangling reference.
 *
 * ── How the pairs are re-derived ───────────────────────────────────────────
 * With `findFeedOverlap` — the same matcher, at the same tolerance, that
 * produced the suppression in the first place. A second rule worded differently
 * could pair rows the first one did not, and this repair would then be
 * inventing categories instead of restoring them. All the decisions live in
 * src/services/import/msMoney/feedCategoryBackfill.ts and are tested with
 * synthetic fixtures; this file is I/O.
 *
 * ── The two modes ──────────────────────────────────────────────────────────
 * DRY RUN (default) is READ-ONLY. It prints what it would change — counts and
 * category groups only, never an amount, a payee or an account name — and, with
 * --out, writes the plan and its baseline to a file OUTSIDE the repository.
 *
 * APPLY refuses unless: the target database is the one the confirmation flag
 * claims it is; a plan file from a dry run is supplied and the live database
 * still matches it; and the plan has no anomalies. It then writes in batches —
 * one request per (category, 100 ids), never one per row — with every statement
 * scoped by `user_id`, `external_transaction_id IS NOT NULL` and
 * `category IS NULL`, so Postgres itself refuses to touch a file row or to
 * overwrite a category somebody has since set. Afterwards it re-reads the feed
 * rows and reports the before/after.
 *
 * Nothing here deletes anything, and nothing here can widen its own scope: the
 * only rows it can reach are bank-feed rows that currently have no category.
 *
 * Usage:
 *   # preview (read-only)
 *   npx tsx scripts/backfillFeedCategories.mts \
 *     --backup /path/outside/repo/mny-reimport-backup-<stamp>.json \
 *     --out /path/outside/repo
 *
 *   # apply, against the database the plan was taken from
 *   npx tsx scripts/backfillFeedCategories.mts --apply \
 *     --backup /path/outside/repo/mny-reimport-backup-<stamp>.json \
 *     --plan /path/outside/repo/feed-category-backfill-plan-<stamp>.json \
 *     --i-understand-this-writes-to-production
 *
 *   # the same against the scratch project
 *   npx tsx scripts/backfillFeedCategories.mts --apply --env .env.scratch … \
 *     --i-know-this-is-a-scratch-database
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  planFeedCategoryBackfill, summariseByCategoryGroup, compareBackfillBaseline, applyCategoryBackfill,
  proposalKey, BACKFILL_PLAN_VERSION,
  type BackedUpFileRow, type LiveFeedRow, type CategoryRow, type BackfillPlan, type BackfillBaseline,
} from '../src/services/import/msMoney/feedCategoryBackfill.ts';

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const CONFIRM_PRODUCTION = args.includes('--i-understand-this-writes-to-production');
const CONFIRM_SCRATCH = args.includes('--i-know-this-is-a-scratch-database');
const backupPath = flag('backup');
const outDir = flag('out');
const planPath = flag('plan');
const envPath = flag('env') ?? '.env.local';
const toleranceDays = Number(flag('tolerance') ?? 3);
const userOverride = flag('user');

const USAGE = 'usage: tsx scripts/backfillFeedCategories.mts --backup <re-import backup json> ' +
  '[--out <dir outside the repo>] [--env .env.local] [--tolerance 3] [--user <uuid>]\n' +
  '       …--apply --plan <plan from the dry run> ' +
  '(--i-understand-this-writes-to-production | --i-know-this-is-a-scratch-database)';

function fail(msg: string): never {
  console.error(`\nABORT: ${msg}`);
  process.exit(1);
}

if (!backupPath) {
  console.error(USAGE);
  process.exit(1);
}
if (!existsSync(backupPath)) fail(`backup not found: ${backupPath}`);
if (!Number.isFinite(toleranceDays) || toleranceDays < 0) {
  fail(`--tolerance must be a non-negative number, got ${flag('tolerance')}`);
}

const repoRoot = resolve('.');
const outsideRepo = (path: string): string => {
  const resolved = resolve(path);
  if (resolved === repoRoot || resolved.startsWith(repoRoot + sep)) {
    fail(`${resolved} is INSIDE the repository, which is public. Real rows never go there.`);
  }
  return resolved;
};
const backupResolved = outsideRepo(backupPath);
const outResolved = outDir ? outsideRepo(outDir) : null;

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
 * Which database is this, really? The confirmation flag is an ASSERTION about
 * the target and it is checked against the file that defines that target —
 * exactly as scripts/mnyReimportPlan.mts checks it. Claiming production while
 * pointed at scratch means the numbers just reviewed belong elsewhere; claiming
 * scratch while pointed at production is the accident worth preventing.
 */
if (APPLY) {
  const prodUrl = urlOf('.env.local');
  const scratchUrl = urlOf('.env.scratch');
  if (CONFIRM_PRODUCTION === CONFIRM_SCRATCH) {
    fail('--apply needs exactly ONE of --i-understand-this-writes-to-production / ' +
      '--i-know-this-is-a-scratch-database — the flag states which database this is, and it is verified.');
  }
  if (CONFIRM_PRODUCTION) {
    if (scratchUrl && url === scratchUrl) {
      fail('--i-understand-this-writes-to-production was given, but the target is the SAME project as ' +
        '.env.scratch. Use --i-know-this-is-a-scratch-database for scratch runs.');
    }
    if (!prodUrl) fail('.env.local is missing, so "this is production" cannot be verified. Refusing.');
    if (url !== prodUrl) {
      fail(`--i-understand-this-writes-to-production was given, but ${envPath} does not name the same project ` +
        'as .env.local. Refusing to write to a database nobody has identified.');
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
  if (!planPath) {
    fail('--apply needs --plan <file written by the dry run>: it is the baseline the live database is checked against.');
  }
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// ── Reads ────────────────────────────────────────────────────────────────────
async function fetchAll<T>(table: string, cols: string, userId: string): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).eq('user_id', userId)
      .order('id').range(from, from + PAGE - 1).returns<T[]>();
    if (error) fail(`reading ${table}: ${error.message}`);
    const page: T[] = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

// ── The backup ───────────────────────────────────────────────────────────────
interface BackupShape {
  userId?: unknown;
  transactions?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const num = (value: unknown): string | number => (typeof value === 'number' ? value : String(value ?? 0));

interface LoadedBackup { userId: string; rows: BackedUpFileRow[]; sha256: string }

/**
 * Read the re-import's backup and take only what a pairing needs. Every field is
 * narrowed from `unknown`: the file is 45 MB of JSON written by another run, and
 * a field that is not the shape this expects must be visible, not coerced.
 */
function loadBackup(path: string): LoadedBackup {
  const raw = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) fail(`${path} is not a JSON object`);
  const doc: BackupShape = parsed;
  if (!Array.isArray(doc.transactions)) fail(`${path} has no \`transactions\` array — that is not a re-import backup`);
  const userId = str(doc.userId);
  if (!userId) fail(`${path} names no userId`);

  const rows: BackedUpFileRow[] = [];
  for (const entry of doc.transactions) {
    if (!isRecord(entry)) fail(`${path} contains a transaction entry that is not an object`);
    const id = str(entry.id);
    const accountId = str(entry.account_id);
    const date = str(entry.date);
    const type = str(entry.type);
    if (!id || !accountId || !date || !type) fail(`${path} contains a transaction with no id/account/date/type`);
    rows.push({
      id,
      account_id: accountId,
      date: date.slice(0, 10),
      amount: num(entry.amount),
      description: str(entry.description),
      category: str(entry.category),
      type,
      is_split: bool(entry.is_split),
      external_transaction_id: str(entry.external_transaction_id),
    });
  }
  return { userId, rows, sha256: createHash('sha256').update(raw).digest('hex') };
}

// ── Plan ─────────────────────────────────────────────────────────────────────
interface LiveState {
  userId: string;
  feedRows: LiveFeedRow[];
  categories: CategoryRow[];
  plan: BackfillPlan;
}

async function computeLive(backup: LoadedBackup): Promise<LiveState> {
  const userId = userOverride ?? backup.userId;
  if (userOverride && userOverride !== backup.userId) {
    console.log(`NOTE: --user overrides the backup's own user (${backup.userId} → ${userOverride}).\n`);
  }

  const feedRows = (await fetchAll<LiveFeedRow>(
    'transactions', 'id,account_id,date,amount,description,category,external_transaction_id', userId
  )).filter(r => r.external_transaction_id != null);
  const categories = await fetchAll<CategoryRow>('categories', 'id,name,parent_id,level,is_transfer_category', userId);

  const plan = planFeedCategoryBackfill({
    fileRows: backup.rows,
    feedRows,
    categories,
    dateToleranceDays: toleranceDays,
  });
  return { userId, feedRows, categories, plan };
}

function printPlan(state: LiveState, backup: LoadedBackup): void {
  const { plan } = state;
  console.log(`Target user: ${state.userId}`);
  console.log(`Backup     : ${backup.rows.length} deleted file rows (sha256 ${backup.sha256.slice(0, 12)}…)`);
  console.log(`Matcher    : findFeedOverlap, ±${toleranceDays} days, exact pence, same account, strictly 1:1\n`);

  console.log('BANK-FEED ROWS AS THEY STAND');
  console.log(`  total                              : ${plan.feedRowsTotal}`);
  console.log(`  with a category                    : ${plan.feedRowsTotal - plan.feedRowsWithoutCategory}`);
  console.log(`  with NO category                   : ${plan.feedRowsWithoutCategory}`);

  console.log('\nRE-DERIVED PAIRS (file row the re-import dropped → feed row it kept)');
  console.log(`  pairs found                        : ${plan.pairsFound}`);
  console.log(`  feed rows with no file counterpart : ${plan.feedRowsWithoutFileCounterpart}` +
    ` — never touched by this repair`);
  console.log(`    …of those, still uncategorised   : ${plan.feedOnlyWithoutCategory}` +
    ' — genuine feed-only spending; belongs to the uncategorised review workflow');

  console.log('\nWOULD CHANGE');
  console.log(`  feed rows given back their category: ${plan.proposals.length}`);

  console.log('\nSKIPPED');
  console.log(`  feed row already has a category    : ${plan.skipped.feedAlreadyCategorised}` +
    ' — never overwritten (the user or payee memory filed it since)');
  console.log(`  the file row had no category either: ${plan.skipped.fileHadNoCategory}`);
  console.log(`  file category is a transfer category: ${plan.skipped.fileCategoryIsTransfer}` +
    ' — never written onto a feed row');
  console.log(`  file category no longer exists     : ${plan.skipped.fileCategoryMissing}`);
  if (plan.skipped.fileCategoryMissing > 0) {
    console.log('');
    console.log('  ############################################################');
    console.log(`  ## ${plan.skipped.fileCategoryMissing} pair(s) name a category that is NOT in the database.`);
    console.log('  ## The re-import was supposed to have REUSED every category,');
    console.log('  ## so this should be zero. It is not. Investigate before applying:');
    for (const id of plan.missingCategoryIds.slice(0, 20)) console.log(`  ##   ${id}`);
    if (plan.missingCategoryIds.length > 20) {
      console.log(`  ##   …and ${plan.missingCategoryIds.length - 20} more distinct id(s)`);
    }
    console.log('  ############################################################');
  }

  if (plan.proposals.length) {
    console.log('\nBY CATEGORY GROUP (counts only — no amounts, no payees, no accounts)');
    for (const { group, count } of summariseByCategoryGroup(plan.proposals, state.categories)) {
      console.log(`  ${String(count).padStart(5)}  ${group}`);
    }
    const sameDay = plan.proposals.filter(p => p.dayGap === 0).length;
    console.log(`\n  match quality: ${sameDay}/${plan.proposals.length} same-day pairs`);
  }

  console.log('\nAFTERWARDS (projected)');
  const remaining = plan.feedRowsWithoutCategory - plan.proposals.length;
  console.log(`  feed rows still without a category : ${remaining}` +
    ` (was ${plan.feedRowsWithoutCategory}; ${plan.proposals.length} fewer)`);

  if (plan.anomalies.length) {
    console.log('\nANOMALIES — nothing may be applied while any of these stand:');
    for (const line of plan.anomalies.slice(0, 20)) console.log(`  - ${line}`);
    if (plan.anomalies.length > 20) console.log(`  …and ${plan.anomalies.length - 20} more`);
  }
}

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

/** The picture the drift check compares — recomputed live at apply time. */
function liveBaselineState(state: LiveState, backup: LoadedBackup): Omit<BackfillBaseline, 'version'> {
  return {
    userId: state.userId,
    dateToleranceDays: toleranceDays,
    backupSha256: backup.sha256,
    proposalKeys: state.plan.proposals.map(proposalKey).sort(),
    feedRowsTotal: state.plan.feedRowsTotal,
    feedRowsWithoutCategory: state.plan.feedRowsWithoutCategory,
  };
}

function buildBaseline(state: LiveState, backup: LoadedBackup): BackfillBaseline {
  return { version: BACKFILL_PLAN_VERSION, ...liveBaselineState(state, backup) };
}

// ── DRY RUN ─────────────────────────────────────────────────────────────────
async function dryRun(backup: LoadedBackup): Promise<void> {
  console.log('Feed-category backfill — DRY RUN, read-only, nothing is written.\n');
  const state = await computeLive(backup);
  printPlan(state, backup);

  if (!outResolved) {
    console.log('\nNo --out given, so no plan file was written and --apply has no baseline to check against.');
    console.log('Re-run with --out <dir outside the repo> to produce an applicable plan.');
    console.log('\nDRY RUN complete — nothing was changed.');
    return;
  }

  mkdirSync(outResolved, { recursive: true });
  const planFile = join(outResolved, `feed-category-backfill-plan-${stamp()}.json`);
  writeFileSync(planFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    backupFile: backupResolved,
    toleranceDays,
    baseline: buildBaseline(state, backup),
    proposals: state.plan.proposals,
    skipped: state.plan.skipped,
    missingCategoryIds: state.plan.missingCategoryIds,
    anomalies: state.plan.anomalies,
  }, null, 1));
  console.log(`\nPLAN + BASELINE: ${planFile}`);
  console.log('  (names real row ids — keep it out of the repository)');
  console.log('\nTo apply this exact plan:');
  console.log(`  npx tsx scripts/backfillFeedCategories.mts --apply --env ${envPath} \\`);
  console.log(`    --backup ${backupResolved} --plan ${planFile} \\`);
  console.log('    --i-understand-this-writes-to-production   # or --i-know-this-is-a-scratch-database');
  console.log('\nDRY RUN complete — nothing was changed.');
}

// ── APPLY ───────────────────────────────────────────────────────────────────
async function apply(backup: LoadedBackup): Promise<void> {
  console.log('Feed-category backfill — APPLY. This SETS a category on bank-feed rows that have none.\n');
  console.log(`Target: ${new URL(url).host} (from ${envPath})\n`);

  if (!planPath) fail('--apply needs --plan <file written by the dry run>.');
  if (!existsSync(planPath)) fail(`plan file not found: ${planPath}`);
  const parsedPlan: unknown = JSON.parse(readFileSync(planPath, 'utf8'));
  if (!isRecord(parsedPlan) || !isRecord(parsedPlan.baseline)) {
    fail(`${planPath} carries no baseline — it was not written by a dry run with --out.`);
  }
  const baselineDoc = parsedPlan.baseline;
  const baseline: BackfillBaseline = {
    version: typeof baselineDoc.version === 'number' ? baselineDoc.version : -1,
    userId: str(baselineDoc.userId) ?? '',
    dateToleranceDays: typeof baselineDoc.dateToleranceDays === 'number' ? baselineDoc.dateToleranceDays : -1,
    backupSha256: str(baselineDoc.backupSha256) ?? '',
    proposalKeys: Array.isArray(baselineDoc.proposalKeys)
      ? baselineDoc.proposalKeys.filter((k): k is string => typeof k === 'string')
      : [],
    feedRowsTotal: typeof baselineDoc.feedRowsTotal === 'number' ? baselineDoc.feedRowsTotal : -1,
    feedRowsWithoutCategory: typeof baselineDoc.feedRowsWithoutCategory === 'number' ? baselineDoc.feedRowsWithoutCategory : -1,
  };

  const state = await computeLive(backup);
  printPlan(state, backup);

  if (state.plan.anomalies.length) {
    fail(`${state.plan.anomalies.length} anomal(ies) above. Nothing has been written.`);
  }

  const drift = compareBackfillBaseline(baseline, liveBaselineState(state, backup));
  console.log('\nDRIFT CHECK against the reviewed plan');
  if (drift.drifted) {
    for (const line of drift.lines) console.error(`  ${line}`);
    fail('the database is not what the plan describes. Nothing has been written. ' +
      'Re-run the DRY RUN, read the new numbers, and apply that plan instead.');
  }
  if (drift.lines.length) for (const line of drift.lines) console.log(`  ${line}`);
  else console.log('  the live database matches the plan exactly — same rows, same categories, same backup.');

  if (!state.plan.proposals.length) {
    console.log('\nNothing to write — every paired feed row already has a category. Exiting without touching anything.');
    return;
  }

  // ── The write ─────────────────────────────────────────────────────────────
  console.log('\nWRITING (batched by category; every statement carries user_id, ' +
    'external_transaction_id IS NOT NULL and category IS NULL)');
  const outcome = await applyCategoryBackfill(sb, state.userId, state.plan.proposals, (done, total) => {
    process.stdout.write(`\r  ${done}/${total}`);
  });
  process.stdout.write('\n');
  console.log(`  ${outcome.rowsUpdated} row(s) updated in ${outcome.requests} request(s).`);
  if (outcome.rowsDeclined > 0) {
    console.log(`  ${outcome.rowsDeclined} row(s) were declined by the database — they stopped qualifying ` +
      '(a category arrived between the plan and the write). Nothing was overwritten.');
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  console.log('\nVERIFYING (re-reading every bank-feed row)');
  const after = await computeLive(backup);
  console.log(`  bank-feed rows                     : ${state.plan.feedRowsTotal} → ${after.plan.feedRowsTotal}`);
  console.log(`  feed rows WITHOUT a category       : ${state.plan.feedRowsWithoutCategory} → ` +
    `${after.plan.feedRowsWithoutCategory}  (${state.plan.feedRowsWithoutCategory - after.plan.feedRowsWithoutCategory} repaired)`);
  console.log(`  of those, feed-only (no file row)  : ${after.plan.feedOnlyWithoutCategory}` +
    ' — the residual for the uncategorised review workflow');
  console.log(`  proposals left outstanding         : ${after.plan.proposals.length}`);

  const failures: string[] = [];
  if (after.plan.feedRowsTotal !== state.plan.feedRowsTotal) {
    failures.push(`the bank-feed population changed size (${state.plan.feedRowsTotal} → ${after.plan.feedRowsTotal}) — ` +
      'this repair never inserts or deletes a row');
  }
  const categoryIds = new Set(after.categories.map(c => c.id));
  const dangling = after.feedRows.filter(r => r.category != null && r.category !== '' && !categoryIds.has(r.category));
  if (dangling.length) failures.push(`${dangling.length} feed row(s) now point at a category that does not exist`);
  if (after.plan.proposals.length > 0) {
    failures.push(`${after.plan.proposals.length} proposal(s) did not take effect`);
  }

  if (failures.length) {
    console.error('\nVERIFICATION FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nDONE — categories restored on feed rows that had none. No row was inserted, deleted, ' +
    'or had an existing category changed.');
  console.log('Re-running --apply now is a no-op (every paired row already has its category).');
}

// ── Entry point ─────────────────────────────────────────────────────────────
(async () => {
  const backup = loadBackup(backupResolved);
  if (APPLY) await apply(backup);
  else await dryRun(backup);
})().catch((thrown: unknown) => {
  console.error(`\nFAILED: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  process.exit(1);
});
