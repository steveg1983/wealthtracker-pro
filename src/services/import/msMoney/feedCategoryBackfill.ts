/**
 * Repairing the categories the feed-overlap suppression threw away.
 *
 * ── What went wrong ────────────────────────────────────────────────────────
 * The MS Money re-import suppressed every file row a bank-feed row already
 * covered, keeping the FEED row (see feedOverlap.ts — the feed row is what the
 * bank reports, it carries the provider's id, and it cannot be recreated).
 *
 * That is right about the AMOUNT and the DATE and wrong about one thing: the
 * feed row carries no category, and the file row it replaced carried the
 * category the user had filed the payment under in Microsoft Money. Because a
 * row with no category is deliberately excluded from every report
 * (`classifyFlow` in utils/incomeExpense.ts — direction is never guessed), the
 * suppression did not lose money, it lost the CLASSIFICATION of that money, and
 * the reports fell over accordingly.
 *
 * ── The repair ─────────────────────────────────────────────────────────────
 * Every deleted file row, with its category, is in the backup the apply pass
 * wrote before deleting anything. Re-pair those rows against the live feed rows
 * with the SAME matcher that produced the suppression (`findFeedOverlap` — a
 * second, differently-worded rule could pair rows the first one did not, and
 * then we would be inventing categories rather than restoring them), and copy
 * the category across.
 *
 * ── What is deliberately NOT done ──────────────────────────────────────────
 *  - a feed row that ALREADY has a category is never touched. Between the
 *    re-import and this repair the user, or payee memory, may have filed it;
 *    that decision is newer than the Money file's and it wins.
 *  - a file category id that no longer exists is never written. The categories
 *    were reused rather than recreated by the re-import, so this should be
 *    impossible — which is exactly why it is checked and reported loudly rather
 *    than assumed.
 *  - a transfer category is never written onto a feed row. Transfer categories
 *    take a row out of income and expense entirely; restoring one onto a row
 *    the feed reported as ordinary spending would hide it more thoroughly than
 *    leaving it uncategorised does.
 *  - feed rows with no file counterpart at all are left alone. They are genuine
 *    feed-only spending that the Money file never had and never categorised;
 *    they belong to the existing uncategorised review workflow, not here.
 *
 * Everything in this file is a decision, and every decision is exercised with
 * synthetic fixtures in feedCategoryBackfill.test.ts. The script that uses it
 * (scripts/backfillFeedCategories.mts) is I/O only.
 */
import { findFeedOverlap } from './feedOverlap';
import type { ExistingFeedTransaction } from './feedOverlap';
import type { Transaction } from '../../../types';

/** Bumped when the plan file's shape changes; apply refuses an older one. */
export const BACKFILL_PLAN_VERSION = 1;

/** Ids per PostgREST request — the same size the delete pass uses. */
export const UPDATE_BATCH_SIZE = 100;

/** A row as the re-import's backup file recorded it, before it was deleted. */
export interface BackedUpFileRow {
  id: string;
  account_id: string;
  /** yyyy-mm-dd */
  date: string;
  amount: string | number;
  description: string | null;
  /** Category id as text — the thing this whole repair exists to recover. */
  category: string | null;
  type: string;
  is_split: boolean | null;
  /** Must be null on every row: the backup may never contain a feed row. */
  external_transaction_id: string | null;
}

/** A bank-feed row as it stands in the database right now. */
export interface LiveFeedRow {
  id: string;
  account_id: string;
  date: string;
  amount: string | number;
  description: string | null;
  category: string | null;
  external_transaction_id: string | null;
}

/** Enough of a category row to decide whether it may be written. */
export interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  /** 'type' (root) | 'sub' (group) | 'detail' (leaf). */
  level: string;
  is_transfer_category?: boolean | null;
}

/** One row this repair would change, and the evidence for changing it. */
export interface CategoryProposal {
  /** The feed row to update. */
  feedTransactionId: string;
  /** The deleted file row the category comes from — provenance for the change. */
  fileTransactionId: string;
  categoryId: string;
  /** Whole days between the two dates, from the matcher. */
  dayGap: number;
}

export interface BackfillSkips {
  /** The user (or payee memory) filed it after the re-import. Never overwritten. */
  feedAlreadyCategorised: number;
  /** The Money file had no category either — nothing to restore. */
  fileHadNoCategory: number;
  /** The file's category id is not in `categories` any more. LOUD. */
  fileCategoryMissing: number;
  /** The file's category is a transfer category — never written onto a feed row. */
  fileCategoryIsTransfer: number;
}

export interface BackfillPlan {
  /** Pairs the matcher re-derived from the backup and the live feed rows. */
  pairsFound: number;
  proposals: CategoryProposal[];
  skipped: BackfillSkips;
  /** Distinct category ids that have vanished — named so they can be chased. */
  missingCategoryIds: string[];
  /**
   * Anything that breaks an invariant the matcher is supposed to guarantee
   * (a feed row or a file row appearing in two pairs, a pair naming a row that
   * is not in the inputs). Non-empty ⇒ nothing should be applied.
   */
  anomalies: string[];
  /** Context for the report, none of it changed by this repair. */
  feedRowsTotal: number;
  feedRowsWithoutCategory: number;
  /** Feed rows the matcher found no file row for — genuine feed-only spending. */
  feedRowsWithoutFileCounterpart: number;
  /** …of which, still uncategorised: the residual for the review-band workflow. */
  feedOnlyWithoutCategory: number;
}

export interface BackfillPlanInput {
  fileRows: readonly BackedUpFileRow[];
  feedRows: readonly LiveFeedRow[];
  categories: readonly CategoryRow[];
  dateToleranceDays: number;
}

const hasCategory = (value: string | null): value is string => value != null && value !== '';

/**
 * Shape a backed-up file row the way `findFeedOverlap` expects its Money side.
 *
 * `Transaction.amount` is a `number`, so the conversion happens here and not in
 * the matcher — which immediately re-reads it through `toDecimal(String(...))`
 * and compares exact pence. This is the identical conversion
 * scripts/mnyReimportPlan.mts fed the matcher when it produced the suppression;
 * using a different one here is precisely how the repair could pair rows the
 * suppression did not.
 */
const asMoneySide = (row: BackedUpFileRow): Transaction => ({
  id: row.id,
  date: new Date(`${row.date}T00:00:00.000Z`),
  description: row.description ?? '',
  accountId: row.account_id,
  amount: Number(row.amount),
  type: row.type === 'income' || row.type === 'transfer' ? row.type : 'expense',
  category: row.category ?? '',
  cleared: false,
  isSplit: row.is_split === true,
});

const asFeedSide = (row: LiveFeedRow): ExistingFeedTransaction => ({
  id: row.id,
  accountId: row.account_id,
  date: row.date,
  amount: row.amount,
  description: row.description ?? '',
});

/**
 * Decide, without touching anything, which feed rows should get which category.
 *
 * The pairing is `findFeedOverlap`'s and nothing else's. Everything this
 * function adds is a REFUSAL: a pair the matcher produced is turned into a
 * proposal only when the feed row is still uncategorised, the file row had a
 * category, and that category still exists and is not a transfer category.
 */
export function planFeedCategoryBackfill(input: BackfillPlanInput): BackfillPlan {
  const anomalies: string[] = [];

  const contaminated = input.fileRows.filter(r => r.external_transaction_id != null);
  if (contaminated.length) {
    anomalies.push(
      `${contaminated.length} row(s) in the backup carry a bank-feed id (${contaminated[0].id}) — ` +
      'that backup is not a backup of file rows'
    );
  }

  const categoryById = new Map(input.categories.map(c => [c.id, c]));
  const fileById = new Map(input.fileRows.map(r => [r.id, r]));
  const feedById = new Map(input.feedRows.map(r => [r.id, r]));
  if (fileById.size !== input.fileRows.length) anomalies.push('the backup contains duplicate transaction ids');
  if (feedById.size !== input.feedRows.length) anomalies.push('the live feed rows contain duplicate transaction ids');

  const overlap = findFeedOverlap(
    input.fileRows.map(asMoneySide),
    input.feedRows.map(asFeedSide),
    { dateToleranceDays: input.dateToleranceDays }
  );

  const proposals: CategoryProposal[] = [];
  const skipped: BackfillSkips = {
    feedAlreadyCategorised: 0,
    fileHadNoCategory: 0,
    fileCategoryMissing: 0,
    fileCategoryIsTransfer: 0,
  };
  const missingCategoryIds = new Set<string>();
  const seenFeed = new Set<string>();
  const seenFile = new Set<string>();

  for (const match of overlap.matches) {
    const feed = feedById.get(match.feedTransactionId);
    const file = fileById.get(match.importSourceId);
    if (!feed || !file) {
      anomalies.push(`pair ${match.importSourceId} → ${match.feedTransactionId} names a row that is not in the inputs`);
      continue;
    }
    // The matcher is 1:1 by construction. Asserted anyway, every run: a pair
    // that is not 1:1 would let one file row's category land on two feed rows.
    if (seenFeed.has(feed.id)) { anomalies.push(`feed row ${feed.id} appears in more than one pair`); continue; }
    if (seenFile.has(file.id)) { anomalies.push(`file row ${file.id} appears in more than one pair`); continue; }
    seenFeed.add(feed.id);
    seenFile.add(file.id);

    if (hasCategory(feed.category)) { skipped.feedAlreadyCategorised++; continue; }
    if (!hasCategory(file.category)) { skipped.fileHadNoCategory++; continue; }

    const category = categoryById.get(file.category);
    if (!category) {
      skipped.fileCategoryMissing++;
      missingCategoryIds.add(file.category);
      continue;
    }
    if (category.is_transfer_category === true) { skipped.fileCategoryIsTransfer++; continue; }

    proposals.push({
      feedTransactionId: feed.id,
      fileTransactionId: file.id,
      categoryId: file.category,
      dayGap: match.dayGap,
    });
  }

  const feedOnly = overlap.unmatchedFeedIds
    .map(id => feedById.get(id))
    .filter((row): row is LiveFeedRow => row != null);

  return {
    pairsFound: overlap.matches.length,
    proposals,
    skipped,
    missingCategoryIds: [...missingCategoryIds],
    anomalies,
    feedRowsTotal: input.feedRows.length,
    feedRowsWithoutCategory: input.feedRows.filter(r => !hasCategory(r.category)).length,
    feedRowsWithoutFileCounterpart: overlap.unmatchedFeedIds.length,
    feedOnlyWithoutCategory: feedOnly.filter(r => !hasCategory(r.category)).length,
  };
}

// ── Reporting: counts only, never money and never a name a payee could be ────

export interface GroupCount {
  /** The 'sub'-level ancestor's name — "Food Related", not the leaf detail. */
  group: string;
  count: number;
}

/**
 * The nearest ancestor at 'sub' level, or the category itself when it has none.
 * Walks upward with a visited set, so a parent cycle terminates instead of
 * hanging the report.
 */
function groupNameOf(categoryId: string, byId: ReadonlyMap<string, CategoryRow>): string {
  const seen = new Set<string>();
  let current = byId.get(categoryId);
  let fallback = current?.name ?? '(unknown category)';
  while (current && !seen.has(current.id)) {
    if (current.level === 'sub') return current.name;
    seen.add(current.id);
    fallback = current.name;
    const parentId = current.parent_id;
    if (parentId == null) break;
    const parent = byId.get(parentId);
    // A 'type' root ("Expense") is too coarse to be a group — keep the child.
    if (!parent || parent.level === 'type') break;
    current = parent;
  }
  return fallback;
}

/**
 * Counts per category group, biggest first, ties broken by name so two runs of
 * the same plan print the same thing. Counts only — this output is read in a
 * chat transcript, so no amount, payee or account ever appears in it.
 */
export function summariseByCategoryGroup(
  proposals: readonly CategoryProposal[],
  categories: readonly CategoryRow[]
): GroupCount[] {
  const byId = new Map(categories.map(c => [c.id, c]));
  const counts = new Map<string, number>();
  for (const proposal of proposals) {
    const group = groupNameOf(proposal.categoryId, byId);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

// ── Drift: is the database still the one the dry run described? ──────────────

/** What the dry run saw, written beside its plan. Apply recomputes and compares. */
export interface BackfillBaseline {
  version: number;
  userId: string;
  dateToleranceDays: number;
  /** sha256 of the backup file, so apply cannot be handed a DIFFERENT backup. */
  backupSha256: string;
  /** `feedTransactionId:categoryId`, sorted — the plan as a set of decisions. */
  proposalKeys: string[];
  feedRowsTotal: number;
  feedRowsWithoutCategory: number;
}

export interface BackfillDriftReport {
  /** True ⇒ refuse. */
  drifted: boolean;
  /** True ⇒ proceed, but say what shrank. */
  benign: boolean;
  lines: string[];
}

export const proposalKey = (proposal: CategoryProposal): string =>
  `${proposal.feedTransactionId}:${proposal.categoryId}`;

/**
 * Compare a live plan against the reviewed one.
 *
 * Proposals that have DISAPPEARED are benign: the only way a pair stops being a
 * proposal is that the feed row acquired a category, and this repair would have
 * skipped it anyway. Anything else — a new proposal, a changed category, a
 * different user, a different backup, a different tolerance — means the numbers
 * that were approved are not the numbers about to be written, and it refuses.
 */
export function compareBackfillBaseline(
  baseline: BackfillBaseline,
  live: Omit<BackfillBaseline, 'version'>
): BackfillDriftReport {
  const lines: string[] = [];
  let drifted = false;

  const refuse = (line: string): void => { lines.push(line); drifted = true; };

  if (baseline.version !== BACKFILL_PLAN_VERSION) {
    refuse(`plan file is version ${baseline.version}, this script reads version ${BACKFILL_PLAN_VERSION}`);
  }
  if (baseline.userId !== live.userId) refuse(`target user changed: plan ${baseline.userId} → live ${live.userId}`);
  if (baseline.backupSha256 !== live.backupSha256) refuse('the backup file is not the one the plan was built from (sha256 differs)');
  if (baseline.dateToleranceDays !== live.dateToleranceDays) {
    refuse(`match tolerance changed: ${baseline.dateToleranceDays} → ${live.dateToleranceDays} days`);
  }

  const approved = new Set(baseline.proposalKeys);
  const now = new Set(live.proposalKeys);
  const added = live.proposalKeys.filter(k => !approved.has(k));
  const gone = baseline.proposalKeys.filter(k => !now.has(k));
  if (added.length) {
    refuse(`${added.length} proposal(s) are NEW since the dry run — the plan reviewed is not the plan pending`);
  }
  const benign = gone.length > 0 && !drifted;
  if (gone.length) {
    lines.push(`${gone.length} proposal(s) no longer apply — those feed rows have since been categorised, and ` +
      'this repair would have skipped them. Proceeding with the rest.');
  }
  if (baseline.feedRowsTotal !== live.feedRowsTotal) {
    lines.push(`bank-feed row count moved: ${baseline.feedRowsTotal} → ${live.feedRowsTotal} (not changed by this repair)`);
  }
  if (baseline.feedRowsWithoutCategory !== live.feedRowsWithoutCategory) {
    lines.push(`uncategorised feed rows moved: ${baseline.feedRowsWithoutCategory} → ${live.feedRowsWithoutCategory}`);
  }
  return { drifted, benign, lines };
}

// ── The write pass ───────────────────────────────────────────────────────────

/**
 * The part of a PostgREST response this pass reads. `count` is what the
 * DATABASE says it changed — asked for with `{ count: 'exact' }`, because "no
 * error" is not the same as "the rows were updated".
 */
export interface MutationOutcome {
  error: { message: string } | null;
  count?: number | null;
}

export interface UpdateQuery extends PromiseLike<MutationOutcome> {
  eq(column: string, value: string): UpdateQuery;
  is(column: string, value: null): UpdateQuery;
  not(column: string, operator: 'is', value: null): UpdateQuery;
  in(column: string, values: readonly string[]): UpdateQuery;
}

/**
 * The slice of the Supabase client this pass uses — narrow enough that a test
 * can hand it an implementation and watch exactly which statements are issued
 * with which filters, and narrow enough that the real client satisfies it
 * directly, with no cast anywhere in the chain.
 */
export interface UpdateClient {
  from(table: string): { update(values: { category: string }, options: { count: 'exact' }): UpdateQuery };
}

export interface BackfillOutcome {
  /** Rows the database reported as changed. */
  rowsUpdated: number;
  /** Requests issued — one per (category, batch), never one per row. */
  requests: number;
  /**
   * Proposals the database declined to change, because the row stopped
   * qualifying between the plan and the write. Expected to be 0; not an error.
   */
  rowsDeclined: number;
}

export interface BackfillProgress {
  (done: number, total: number): void;
}

/** Split a list into request-sized batches. */
export function batchedIds<T>(items: readonly T[], size: number = UPDATE_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error('batch size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Write the proposed categories — batched by category, and scoped so the
 * DATABASE, not this process, enforces what may be touched.
 *
 * Every statement carries all four of:
 *   `user_id = <the target user>`     — no other user's rows are reachable;
 *   `external_transaction_id IS NOT NULL` — a file row cannot be written to;
 *   `category IS NULL`                — an existing category cannot be overwritten;
 *   `id IN (…)`                       — only rows this plan proposed.
 * The first three hold even if the id list were wrong, which is the point: the
 * two mistakes that would matter are refused by Postgres on the row.
 *
 * One request per (category, batch of 100), never one per row.
 */
export async function applyCategoryBackfill(
  client: UpdateClient,
  userId: string,
  proposals: readonly CategoryProposal[],
  onProgress?: BackfillProgress
): Promise<BackfillOutcome> {
  const byCategory = new Map<string, string[]>();
  for (const proposal of proposals) {
    const ids = byCategory.get(proposal.categoryId);
    if (ids) ids.push(proposal.feedTransactionId);
    else byCategory.set(proposal.categoryId, [proposal.feedTransactionId]);
  }

  let rowsUpdated = 0;
  let requests = 0;
  let attempted = 0;
  for (const [categoryId, ids] of byCategory) {
    for (const batch of batchedIds(ids)) {
      const outcome = await client
        .from('transactions')
        .update({ category: categoryId }, { count: 'exact' })
        .eq('user_id', userId)
        .not('external_transaction_id', 'is', null)
        .is('category', null)
        .in('id', batch);
      requests++;
      if (outcome.error) throw new Error(`updating ${batch.length} row(s): ${outcome.error.message}`);
      if (typeof outcome.count !== 'number') {
        throw new Error('the database did not report how many rows it updated — refusing to assume.');
      }
      rowsUpdated += outcome.count;
      attempted += batch.length;
      onProgress?.(attempted, proposals.length);
    }
  }

  return { rowsUpdated, requests, rowsDeclined: proposals.length - rowsUpdated };
}
