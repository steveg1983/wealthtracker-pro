/**
 * Guards for the scoped MS Money re-import (`scripts/mnyReimportPlan.mts --apply`).
 *
 * The script itself is I/O: read the database, write a backup, delete, re-import,
 * verify. Everything in this file is the part that DECIDES — which rows may be
 * touched, whether the world still looks like the plan the operator approved,
 * whether the backup on disk is really usable, whether the work is already done.
 * It lives here, beside the importer it protects, because it is testable: every
 * guard below is exercised with synthetic fixtures in reimportGuards.test.ts,
 * and none of them needs a database to be wrong out loud.
 *
 * The one rule the whole file exists to enforce:
 *
 *   A row carrying `external_transaction_id` came from the bank feed. It cannot
 *   be recreated from the Money file, and it is NEVER deleted.
 */
import type { ExistingFeedTransaction } from './feedOverlap';

/** Bumped whenever the plan file's shape changes; apply refuses an older one. */
export const REIMPORT_PLAN_VERSION = 1;

/** Ids per PostgREST request on the delete pass — small enough to keep the URL well under any proxy's header limit. */
export const DELETE_BATCH_SIZE = 100;

/** The provenance markers every population decision is made from. */
export interface ProvenanceMarkers {
  id: string;
  /** Set by the bank feed. Non-null ⇒ untouchable. */
  external_transaction_id: string | null;
  /** Set by a file importer ('ms-money'). */
  import_source: string | null;
  import_source_id: string | null;
}

export interface PopulationSplit<T> {
  /** Bank-fed rows: kept, always. */
  feed: T[];
  /** File rows written by an importer that recorded provenance. */
  provenanced: T[];
  /** File rows written before provenance existed — no marker of any kind. */
  legacy: T[];
  /**
   * Rows carrying BOTH markers. The two populations are supposed to be
   * disjoint; a row here means they are not, and nothing may be deleted until a
   * human has resolved it.
   */
  conflicted: T[];
}

/**
 * Separate the bank feed from the file import.
 *
 * `conflicted` is deliberately its own bucket rather than being counted twice:
 * a row with both markers must not silently fall into whichever population is
 * checked first.
 */
export function splitPopulations<T extends ProvenanceMarkers>(rows: readonly T[]): PopulationSplit<T> {
  const out: PopulationSplit<T> = { feed: [], provenanced: [], legacy: [], conflicted: [] };
  for (const row of rows) {
    const fed = row.external_transaction_id != null;
    const imported = row.import_source != null;
    if (fed && imported) out.conflicted.push(row);
    else if (fed) out.feed.push(row);
    else if (imported) out.provenanced.push(row);
    else out.legacy.push(row);
  }
  return out;
}

/**
 * The last line of defence before a delete: any row here carries a bank-feed id
 * and must not be in the delete set at all. Returns the offenders, so the caller
 * can name them rather than just refusing.
 */
export function findFeedRowsInDeleteSet<T extends ProvenanceMarkers>(rows: readonly T[]): T[] {
  return rows.filter(row => row.external_transaction_id != null);
}

/** Split a list into request-sized batches. */
export function batched<T>(items: readonly T[], size: number = DELETE_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error('batch size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── Drift: is the database still the one the operator reviewed? ──────────────

/**
 * What the dry run saw, written beside the backup it produced. Apply recomputes
 * every field from the live database and refuses if anything moved: the numbers
 * a human approved have to be the numbers being executed.
 */
export interface PlanBaseline {
  version: number;
  userId: string;
  toleranceDays: number;
  /** sha256 of the seed file, so apply cannot be handed a DIFFERENT export. */
  seedSha256: string;
  seedTransactionCount: number;
  deleteTransactionIds: string[];
  deleteSplitIds: string[];
  feedTransactionIds: string[];
  /** `mny-txn-…` ids the feed already covers — not re-imported. */
  suppressedSourceIds: string[];
  expectedImportCount: number;
  expectedNetCount: number;
}

/** The same picture, recomputed live at apply time. */
export type LivePlanState = Omit<PlanBaseline, 'version'>;

export interface DriftReport {
  drifted: boolean;
  lines: string[];
}

const sample = (ids: readonly string[], take = 5): string =>
  ids.slice(0, take).join(', ') + (ids.length > take ? `, …(${ids.length - take} more)` : '');

/** Set difference in both directions, described in words. Empty ⇒ identical. */
function diffSets(label: string, expected: readonly string[], actual: readonly string[]): string[] {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const added = actual.filter(id => !expectedSet.has(id));
  const removed = expected.filter(id => !actualSet.has(id));
  const lines: string[] = [];
  if (removed.length) lines.push(`${label}: ${removed.length} gone since the dry run (${sample(removed)})`);
  if (added.length) lines.push(`${label}: ${added.length} new since the dry run (${sample(added)})`);
  return lines;
}

/**
 * Compare the live database against the approved plan. Every population is
 * compared as a SET of ids, not as a count: two rows deleted and two rows added
 * leaves the count identical and the plan wrong.
 */
export function compareToBaseline(baseline: PlanBaseline, live: LivePlanState): DriftReport {
  const lines: string[] = [];
  if (baseline.version !== REIMPORT_PLAN_VERSION) {
    lines.push(`plan file is version ${baseline.version}, this script writes and reads version ${REIMPORT_PLAN_VERSION}`);
  }
  if (baseline.userId !== live.userId) {
    lines.push(`target user changed: plan ${baseline.userId} → live ${live.userId}`);
  }
  if (baseline.seedSha256 !== live.seedSha256) {
    lines.push('the seed file is not the one the plan was built from (sha256 differs)');
  }
  if (baseline.seedTransactionCount !== live.seedTransactionCount) {
    lines.push(`seed transaction count changed: ${baseline.seedTransactionCount} → ${live.seedTransactionCount}`);
  }
  if (baseline.toleranceDays !== live.toleranceDays) {
    lines.push(`feed-overlap tolerance changed: ${baseline.toleranceDays} → ${live.toleranceDays} days`);
  }
  lines.push(...diffSets('transactions to delete', baseline.deleteTransactionIds, live.deleteTransactionIds));
  lines.push(...diffSets('split lines to delete', baseline.deleteSplitIds, live.deleteSplitIds));
  lines.push(...diffSets('bank-feed rows to keep', baseline.feedTransactionIds, live.feedTransactionIds));
  lines.push(...diffSets('feed-covered source ids', baseline.suppressedSourceIds, live.suppressedSourceIds));
  if (baseline.expectedImportCount !== live.expectedImportCount) {
    lines.push(`rows to import changed: ${baseline.expectedImportCount} → ${live.expectedImportCount}`);
  }
  if (baseline.expectedNetCount !== live.expectedNetCount) {
    lines.push(`final row count changed: ${baseline.expectedNetCount} → ${live.expectedNetCount}`);
  }
  return { drifted: lines.length > 0, lines };
}

// ── Backup: proof on disk before anything is destroyed ───────────────────────

/**
 * Issued ONLY by {@link verifyBackupContents}, and required by
 * {@link deleteFileOriginRows}. The delete pass therefore cannot be called
 * without a backup that has been written, re-read and checked row for row —
 * the ordering is enforced by the type system, not by remembering to do it.
 */
export interface BackupReceipt {
  readonly path: string;
  readonly transactionIds: ReadonlySet<string>;
  readonly splitIds: ReadonlySet<string>;
  readonly verifiedAt: string;
}

export interface BackupExpectation {
  path: string;
  transactionIds: readonly string[];
  splitIds: readonly string[];
}

interface BackupShape {
  transactions?: unknown;
  splits?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Read a written backup back and prove it holds every row about to be deleted.
 *
 * Checked, in this order: it parses; it carries both collections; the
 * transaction ids are EXACTLY the ids about to be deleted (no more, no fewer);
 * no backed-up transaction carries a bank-feed id; the split ids match and every
 * one names a parent that is in the backup too. Any failure returns no receipt,
 * and without a receipt nothing can be deleted.
 */
export function verifyBackupContents(
  raw: string,
  expected: BackupExpectation,
  now: () => string = () => new Date().toISOString()
): { receipt: BackupReceipt | null; problems: string[] } {
  const problems: string[] = [];
  let parsed: BackupShape;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) {
      return { receipt: null, problems: ['backup file is not a JSON object'] };
    }
    parsed = value;
  } catch (thrown) {
    return { receipt: null, problems: [`backup file does not parse: ${thrown instanceof Error ? thrown.message : String(thrown)}`] };
  }

  if (!Array.isArray(parsed.transactions)) problems.push('backup has no `transactions` array');
  if (!Array.isArray(parsed.splits)) problems.push('backup has no `splits` array');
  if (problems.length) return { receipt: null, problems };

  const txnRows = (parsed.transactions as unknown[]).filter(isRecord);
  const splitRows = (parsed.splits as unknown[]).filter(isRecord);
  if (txnRows.length !== (parsed.transactions as unknown[]).length) {
    problems.push('backup contains transaction entries that are not objects');
  }
  if (splitRows.length !== (parsed.splits as unknown[]).length) {
    problems.push('backup contains split entries that are not objects');
  }

  const txnIds = new Set<string>();
  for (const row of txnRows) {
    if (typeof row.id !== 'string' || row.id === '') { problems.push('a backed-up transaction has no id'); continue; }
    txnIds.add(row.id);
    if (row.external_transaction_id != null) {
      problems.push(`backed-up transaction ${row.id} carries a bank-feed id — it must never have been in the delete set`);
    }
  }
  const splitIds = new Set<string>();
  for (const row of splitRows) {
    if (typeof row.id !== 'string' || row.id === '') { problems.push('a backed-up split line has no id'); continue; }
    splitIds.add(row.id);
    if (typeof row.transaction_id !== 'string' || !txnIds.has(row.transaction_id)) {
      problems.push(`backed-up split ${row.id} names a parent that is not in the backup`);
    }
  }

  problems.push(...diffSets('backup transactions vs rows to delete', expected.transactionIds, [...txnIds]));
  problems.push(...diffSets('backup splits vs split lines to delete', expected.splitIds, [...splitIds]));

  if (problems.length) return { receipt: null, problems };
  return {
    receipt: { path: expected.path, transactionIds: txnIds, splitIds, verifiedAt: now() },
    problems: [],
  };
}

// ── Already applied? ─────────────────────────────────────────────────────────

export interface TargetStateInput {
  /** Every file-origin row currently in the database (provenanced + legacy). */
  fileRows: readonly ProvenanceMarkers[];
  /** Every `mny-txn-…` id in the seed. */
  seedSourceIds: ReadonlySet<string>;
  /** Seed ids the bank feed already covers — deliberately absent. */
  suppressedSourceIds: ReadonlySet<string>;
  importSource: string;
}

/**
 * Is the database ALREADY in the state a successful apply would leave it in?
 *
 * If it is, the honest thing is to do nothing at all: no backup, no delete, no
 * re-import. This is what makes a second apply run a no-op rather than a
 * needless second demolition of rows that are already correct.
 */
export function describeTargetState(input: TargetStateInput): { satisfied: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const wanted = new Set([...input.seedSourceIds].filter(id => !input.suppressedSourceIds.has(id)));

  const legacy = input.fileRows.filter(r => r.import_source == null).length;
  if (legacy) reasons.push(`${legacy} file row(s) still carry no import provenance`);

  const foreign = input.fileRows.filter(r => r.import_source != null && r.import_source !== input.importSource).length;
  if (foreign) reasons.push(`${foreign} file row(s) come from a different importer`);

  const present = new Set<string>();
  for (const row of input.fileRows) {
    if (row.import_source === input.importSource && row.import_source_id != null) present.add(row.import_source_id);
  }
  const missing = [...wanted].filter(id => !present.has(id));
  const unexpected = [...present].filter(id => !wanted.has(id));
  if (missing.length) reasons.push(`${missing.length} seed row(s) are not in the database (${sample(missing)})`);
  if (unexpected.length) reasons.push(`${unexpected.length} imported row(s) are not in the seed, or are feed-covered (${sample(unexpected)})`);

  return { satisfied: reasons.length === 0, reasons };
}

// ── Account namespace: the feed lives in DB ids, the seed in `mny-acct-…` ─────

export interface NamedAccount { id: string; name: string }

export interface FeedRowInDb {
  id: string;
  account_id: string;
  date: string;
  amount: string | number;
  description: string | null;
}

/** Case/whitespace-insensitive, exactly as planCloudImport matches accounts. */
const normName = (name: string): string => name.trim().toLowerCase();

/**
 * Translate the user's bank-feed rows into the seed's account namespace, so the
 * overlap between them and the file can be measured.
 *
 * The pairing deliberately mirrors `planCloudImport`'s account reuse — buckets
 * by normalised name, each seed account claiming one existing row in order —
 * because the account a suppressed row would have landed in IS the account the
 * re-import will reuse. Any other rule could measure the overlap in one account
 * and write the rows into another.
 *
 * A feed row in an account the seed does not have cannot overlap anything; it is
 * returned in `unmapped` and simply kept.
 */
export function mapFeedRowsToSeedNamespace(
  seedAccounts: readonly NamedAccount[],
  dbAccounts: readonly NamedAccount[],
  feedRows: readonly FeedRowInDb[]
): { rows: ExistingFeedTransaction[]; unmapped: FeedRowInDb[]; duplicateNames: string[] } {
  const buckets = new Map<string, string[]>();
  for (const row of dbAccounts) {
    const key = normName(row.name);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row.id); else buckets.set(key, [row.id]);
  }
  const duplicateNames = [...buckets.entries()].filter(([, ids]) => ids.length > 1).map(([name]) => name);

  const dbToSeed = new Map<string, string>();
  for (const seedAccount of seedAccounts) {
    const claimed = buckets.get(normName(seedAccount.name))?.shift();
    if (claimed) dbToSeed.set(claimed, seedAccount.id);
  }

  const rows: ExistingFeedTransaction[] = [];
  const unmapped: FeedRowInDb[] = [];
  for (const feed of feedRows) {
    const seedAccountId = dbToSeed.get(feed.account_id);
    if (!seedAccountId) { unmapped.push(feed); continue; }
    rows.push({
      id: feed.id,
      accountId: seedAccountId,
      date: feed.date,
      amount: feed.amount,
      description: feed.description ?? '',
    });
  }
  return { rows, unmapped, duplicateNames };
}

// ── Post-apply integrity ─────────────────────────────────────────────────────

/** Categories pointing at a parent row that does not exist. Must be empty. */
export function findOrphanedCategoryIds(rows: readonly { id: string; parent_id: string | null }[]): string[] {
  const ids = new Set(rows.map(r => r.id));
  return rows.filter(r => r.parent_id != null && !ids.has(r.parent_id)).map(r => r.id);
}

/** Split lines whose parent transaction is gone. Must be empty. */
export function findParentlessSplitIds(
  splits: readonly { id: string; transaction_id: string }[],
  transactionIds: ReadonlySet<string>
): string[] {
  return splits.filter(s => !transactionIds.has(s.transaction_id)).map(s => s.id);
}

// ── The delete pass ──────────────────────────────────────────────────────────

/**
 * The part of a PostgREST response the delete pass reads. `count` is the number
 * of rows the DATABASE says it removed — asked for with `{ count: 'exact' }` and
 * compared against what was expected, because "no error" is not the same as
 * "the rows are gone".
 */
export interface MutationOutcome {
  error: { message: string } | null;
  status?: number;
  count?: number | null;
}

export interface DeleteQuery extends PromiseLike<MutationOutcome> {
  in(column: string, values: readonly string[]): DeleteQuery;
  is(column: string, value: null): DeleteQuery;
}

/**
 * The slice of the Supabase client the delete pass uses — narrow enough that a
 * test can hand it a real implementation and watch exactly which statements are
 * issued, in which order, with which filters, and narrow enough that the real
 * client satisfies it directly (no cast anywhere in the chain).
 */
export interface DeleteClient {
  from(table: string): { delete(options: { count: 'exact' }): DeleteQuery };
}

export interface DeleteOutcome {
  splitsDeleted: number;
  transactionsDeleted: number;
}

export interface DeleteProgress {
  (stage: 'splits' | 'transactions', done: number, total: number): void;
}

/**
 * Delete the file-import rows named by a VERIFIED backup — and nothing else.
 *
 * Three things make this safe, and all three are required:
 *   1. it takes a {@link BackupReceipt}, which only exists once the backup has
 *      been written and read back, so there is no ordering to get wrong;
 *   2. every id it deletes must be in that receipt (a caller passing a wider
 *      list is refused, not trusted);
 *   3. the DELETE statement itself carries `external_transaction_id IS NULL`,
 *      so even a receipt built from a wrong query cannot take a bank-feed row —
 *      the database enforces the rule, not just this process.
 *
 * Split lines go first. Their FK to `transactions` is ON DELETE CASCADE, so the
 * database would remove them anyway; doing it explicitly means the count is
 * observed rather than assumed.
 *
 * NO RETRY, deliberately — unlike the import's write path. A DELETE whose
 * response is lost may or may not have been applied, and a second attempt on
 * the same ids reports 0 rows either way, so a retry would have to choose
 * between claiming success it cannot see and failing a batch that worked.
 * Instead a dropped connection stops the pass with an accurate count of what
 * the database confirmed, and the caller resumes by taking a FRESH plan: the
 * rows that survived are simply the new delete set, and the importer's
 * provenance makes the re-import idempotent. Recovery through the front door
 * beats a retry that lies.
 */
export async function deleteFileOriginRows(
  client: DeleteClient,
  receipt: BackupReceipt,
  transactionIds: readonly string[],
  splitIds: readonly string[],
  onProgress?: DeleteProgress
): Promise<DeleteOutcome> {
  const strayTxn = transactionIds.filter(id => !receipt.transactionIds.has(id));
  if (strayTxn.length) {
    throw new Error(`refusing to delete ${strayTxn.length} transaction(s) that are not in the verified backup (${sample(strayTxn)})`);
  }
  const straySplit = splitIds.filter(id => !receipt.splitIds.has(id));
  if (straySplit.length) {
    throw new Error(`refusing to delete ${straySplit.length} split line(s) that are not in the verified backup (${sample(straySplit)})`);
  }

  const removed = (stage: string, outcome: MutationOutcome): number => {
    if (outcome.error) throw new Error(`${stage}: ${outcome.error.message}`);
    if (typeof outcome.count !== 'number') {
      throw new Error(`${stage}: the database did not report how many rows it deleted — refusing to assume.`);
    }
    return outcome.count;
  };

  let splitsDeleted = 0;
  for (const batch of batched(splitIds)) {
    const outcome = await client.from('transaction_splits').delete({ count: 'exact' }).in('id', batch);
    splitsDeleted += removed('deleting split lines', outcome);
    onProgress?.('splits', splitsDeleted, splitIds.length);
  }

  let transactionsDeleted = 0;
  for (const batch of batched(transactionIds)) {
    // `.is('external_transaction_id', null)` is the guard that matters: it is
    // evaluated by Postgres, on the row, at the moment of deletion.
    const outcome = await client.from('transactions').delete({ count: 'exact' })
      .in('id', batch).is('external_transaction_id', null);
    transactionsDeleted += removed('deleting transactions', outcome);
    onProgress?.('transactions', transactionsDeleted, transactionIds.length);
  }

  return { splitsDeleted, transactionsDeleted };
}
