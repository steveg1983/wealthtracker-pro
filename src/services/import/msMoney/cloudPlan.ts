/**
 * How a .mny file becomes ROWS — the planner, and nothing that writes.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN ─────────────────────────────────────────
 *
 * `planCloudImport` is PURE: collections in, rows out, ids from an injected
 * generator. It is where Microsoft Money's model is reconciled with this app's
 * — which account a cash sleeve belongs under, which two rows are the two halves
 * of one transfer, which split line carries a leg, what a Money C or R means
 * about the committed flag — and there must be exactly ONE of it, because a
 * second copy would be a second opinion about what a .mny file means.
 *
 * It lived in `msMoneyImport.ts`, whose module scope reaches `storageAdapter`
 * (the browser's IndexedDB writer) and `createScopedLogger` (which reaches the
 * app's cloud-bound logging service). Everything else in that file WRITES:
 * batched PostgREST upserts, a wipe, a retry ladder. The planner writes nothing
 * and needs neither.
 *
 * ── THE OBLIGATION THIS DISCHARGES ──────────────────────────────────────────
 *
 * `localDataPort.ts`'s `MsMoneyMigration` records it: the local port may not
 * import the importer, so the planner arrives injected, and the supplier — the
 * desktop shell, from slice 27 — must be able to reach it without dragging a
 * browser store and a cloud logger into a desktop bundle. That is this file.
 *
 * The name still says "cloud" because the cloud is what first needed it. The
 * work it does is an engine-independent translation, and the local port is the
 * proof: it plans a migration with this function and then writes the rows into a
 * file through a wipe and a restore.
 *
 * ── IT IS A MOVE, NOT A FORK ────────────────────────────────────────────────
 *
 * Every line below is the one the cloud migration has always run, moved
 * verbatim, and `msMoneyImport.ts` re-exports all of it — including the two
 * rules the write path shares with the planner (`reconciledFromMoney` and the
 * column name its fallback strips), which came across because the planner uses
 * them and a planner that imported the writer would put back the import this
 * move exists to break.
 */

import type { Account, Category, Transaction } from '../../../types';
import { toDecimal } from '../../../utils/decimal';
import type { TransferHandover } from './feedOverlap';
import type { MsMoneyImportResult } from './transform';

/**
 * `transactions.is_reconciled` — the committed flag (migration 20260810200000).
 *
 * Named as a constant because the write path may have to GIVE IT UP: see
 * `executeCloudPlan`'s fallback, which strips exactly this column when the
 * database refuses it.
 */
export const RECONCILED_COLUMN = 'is_reconciled';

/**
 * What the committed flag says about a row that came out of a .mny file.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Money keeps three states against a transaction: unreconciled, C (a working
 * mark) and R (settled against a statement). The transform hands over BOTH of
 * the app's flags rather than flattening them — `cleared` is C or R (marked at
 * all), `reconciled` is R alone, see transform.ts's cs mapping. The committed
 * flag is that `reconciled` and nothing else.
 *
 * ── WHY THIS MAY NOT READ `cleared` ─────────────────────────────────────────
 * It used to, and that was right only while `cleared` meant R and nothing
 * weaker. Now that a C row arrives MARKED, reading `cleared` here would commit
 * every one of them: rows Money was holding for its owner's next balance
 * session would land as finished reconciliations against statements nobody
 * confirmed — the exact failure reconciliation exists to catch, arriving tens
 * of thousands of rows at a time, with nothing on screen to say it happened.
 *
 * ── WHY IT IS NOT LEFT TO THE DEFAULT ───────────────────────────────────────
 * `is_reconciled` is `DEFAULT false` on insert, and
 * src/utils/transactionReconciliation.ts reads an explicit `false` as "marked,
 * but not committed". Left unnamed, a full Money migration would therefore
 * land its entire settled history as outstanding reconciliation work, spread
 * across every account in the file. NULL — the value that means "predates the
 * split, ask `cleared`" — is not available to a fresh insert, so the flag must
 * be stated.
 *
 * ── A SEED WRITTEN BEFORE THE SPLIT ─────────────────────────────────────────
 * A `mny-local-seed.json` from an older `scripts/mnyLocalImport.mts` run states
 * no `reconciled` at all, and its `cleared` means R. Such a seed is wrong on
 * BOTH flags — its C rows are missing their marks too — so the answer is to
 * regenerate it from the export directory, not to guess here from a `cleared`
 * whose meaning has moved.
 *
 * One rule, read by both write paths (`transactionRow` for the cloud,
 * `importToLocalStorage` for the device), so the two cannot drift.
 */
export const reconciledFromMoney = (t: Pick<Transaction, 'reconciled'>): boolean => t.reconciled === true;

/**
 * Import provenance (migration 20260722170000).
 *
 * Every transaction this importer writes carries `import_source` +
 * `import_source_id` (the transform's stable `mny-txn-<htrn>`, taken straight
 * from Money's own TRN primary key). A unique index on
 * (user_id, import_source, import_source_id) means the DATABASE refuses a
 * second copy, so re-running the import can never duplicate a row — the
 * inserts below ask Postgres to skip conflicts rather than fail.
 *
 * This is deliberately NOT `external_transaction_id`: that column belongs to
 * the bank feed, and `import_bank_transactions_atomic` keys both its dedupe
 * and its backfill-rebase decision off it.
 */
export const MS_MONEY_IMPORT_SOURCE = 'ms-money';

const DB_ACCOUNT_TYPE = (t: Account['type']): string => (t === 'current' ? 'checking' : t);
const dateOnly = (d: Date | string): string =>
  (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

export interface CloudPlan {
  accounts: Record<string, unknown>[];       // inserted WITHOUT parent_account_id
  accountParents: { id: string; parent_account_id: string }[];
  categories: Record<string, unknown>[];     // ordered parents-first
  transactions: Record<string, unknown>[];   // inserted WITHOUT linked_transfer_id
  transferLinks: { id: string; linked_transfer_id: string }[];
  splits: Record<string, unknown>[];
  splitLegPins: { id: string; linked_transfer_split_id: string }[];
  /**
   * The second pass, as rows the database can take in BATCHES.
   *
   * `transferLinks` / `splitLegPins` above say what the links ARE; these say
   * how they are written. Each entry is a COMPLETE account/transaction row —
   * every column the insert would have carried — plus the link columns, offered
   * as an upsert that merges onto the row already there. Complete because it
   * has to be: Postgres builds the candidate tuple, and therefore evaluates
   * every NOT NULL column, BEFORE it resolves ON CONFLICT, so an
   * id-plus-one-column payload is rejected outright.
   *
   * A row whose link is already exactly right in the database is left out
   * entirely (see `existingAccounts` / `existingTransactionLinks`), so a second
   * import writes nothing here rather than rewriting rows the user may since
   * have edited.
   */
  accountParentRows: Record<string, unknown>[];
  linkRows: Record<string, unknown>[];
  /**
   * Bank-feed rows taking over a suppressed Money transfer leg — what the
   * promotion IS, in database ids, for reporting and for tests.
   */
  feedPromotions: FeedTransferPromotion[];
  /**
   * The same promotions as COMPLETE rows for the batched merge — the feed row
   * exactly as it is in the database, with only the transfer columns changed.
   * A row whose transfer columns are already right is left out, so a second run
   * writes nothing.
   */
  feedPromotionRows: Record<string, unknown>[];
  /**
   * Handovers that could NOT be executed — no complete feed row was supplied
   * for them. Their Money leg is imported as normal rather than dropped (a
   * suppressed leg with nothing taking its place would delete a real transfer),
   * so the plan stays safe; the caller is expected to treat any entry here as a
   * failure, because the count it reviewed will no longer match.
   */
  unpromotableHandovers: TransferHandover[];
  /**
   * Reused accounts whose stored `initial_balance` disagrees with the file's.
   * ALWAYS reported, never silently corrected: a reused account may have been
   * hand-edited, and the file is only authoritative if the operator says so
   * (`rebaseOpeningBalances`).
   */
  openingBalanceMismatches: OpeningBalanceMismatch[];
  /** Complete rows for the mismatches above, when a rebase was asked for. */
  accountOpeningBalanceRows: Record<string, unknown>[];
  /** Source rows already present under this user's provenance — not re-inserted. */
  skippedExisting: number;
  /** Source rows a bank-feed transaction already covers — not imported. */
  skippedFeedOverlap: number;
  /** Seed accounts matched onto an account the user already has — not re-inserted. */
  skippedExistingAccounts: number;
  /** Seed categories matched onto a category the user already has — not re-inserted. */
  skippedExistingCategories: number;
  /**
   * Seed categories whose parent could not be resolved to a row that will
   * exist after the import. They are written with `parent_id` NULL — never a
   * dangling id — and counted here so the caller can report it.
   */
  categoriesWithUnresolvedParent: number;
}

/** A bank-feed row inheriting a suppressed Money transfer leg, in database ids. */
export interface FeedTransferPromotion {
  /** The feed row being promoted. */
  id: string;
  /** The Money leg it replaces (`mny-txn-…`) — reporting only. */
  importSourceId: string;
  /** The account on the other side of the transfer. */
  transfer_account_id: string | null;
  /** The other leg. Null when the Money leg had no linked counterpart. */
  linked_transfer_id: string | null;
  /** The split LINE the other side is, when the counterpart is a split leg. */
  linked_transfer_split_id: string | null;
}

/** A reused account whose stored opening balance is not the file's. */
export interface OpeningBalanceMismatch {
  /** Database id of the account (the reused row). */
  accountId: string;
  accountName: string;
  /** Both as fixed-2 strings, formatted through Decimal — never a float. */
  fileValue: string;
  storedValue: string;
  /** True when this plan will correct it (see `rebaseOpeningBalances`). */
  rebased: boolean;
}

/** The subset of an existing `categories` row the planner needs to match on. */
export interface ExistingCategoryRow {
  id: string;
  name: string;
  type: string;
  level: string;
  parent_id: string | null;
  is_system: boolean | null;
}

/** The subset of an existing `accounts` row the planner needs to match on. */
export interface ExistingAccountRow {
  id: string;
  name: string;
  /** Current investment↔cash pairing, so an already-paired account is left alone. */
  parent_account_id?: string | null;
  /**
   * Current opening balance. Supplied ⇒ the plan reports every reused account
   * whose opening balance disagrees with the file's (and, on request, corrects
   * it). Omitted ⇒ no opinion is formed, which is what every caller that has
   * wiped the database first wants.
   */
  initial_balance?: string | number | null;
}

/** The link columns an already-imported transaction currently carries. */
export interface ExistingTransactionLinks {
  linkedTransferId: string | null;
  linkedTransferSplitId: string | null;
}

export interface CloudPlanOptions {
  /**
   * Already-imported `import_source_id` → the id that row already has in the
   * database. Anything named here keeps that id (so every cross-reference
   * still resolves) and is left OUT of the insert batches — which is what
   * makes a second run a no-op instead of a duplicate.
   */
  existingBySourceId?: ReadonlyMap<string, string>;
  /**
   * `import_source_id`s the bank feed already covers (see feedOverlap.ts).
   * These are dropped entirely: the feed row is the surviving record.
   */
  suppressedSourceIds?: ReadonlySet<string>;
  /**
   * The user's current `categories` rows (see `fetchExistingCategories`).
   * Seed categories are matched onto these instead of being duplicated —
   * critically the type-level system roots, which the seed carries as the
   * literal ids `type-income` / `type-expense` / `type-transfer` and the user
   * holds as UUIDs. Omit (or pass empty) for a virgin database: every root is
   * then CREATED rather than assumed.
   */
  existingCategories?: readonly ExistingCategoryRow[];
  /**
   * The user's current `accounts` rows (see `fetchExistingAccounts`). Seed
   * accounts matching one by name reuse its id rather than inserting a second
   * copy — accounts carry no provenance columns, so the name is the only
   * stable identity available.
   */
  existingAccounts?: readonly ExistingAccountRow[];
  /**
   * `import_source_id` → the link columns that row already holds. Purely an
   * optimisation of the second pass: a transfer already linked exactly as the
   * plan would link it is not rewritten. Omit it and every link is written,
   * which is correct but does needless work — and, on a row the user has since
   * edited, needless work that would overwrite the edit.
   *
   * It is also what makes a resumed import self-healing: a run that died after
   * inserting transactions but before linking them leaves rows whose links do
   * NOT match, so the next run picks up exactly those.
   */
  existingTransactionLinks?: ReadonlyMap<string, ExistingTransactionLinks>;
  /**
   * Suppressed TRANSFER legs and the feed rows that inherit their place
   * (see feedOverlap.ts). Every entry must also appear in
   * `suppressedSourceIds` — a handover is a suppression with a successor.
   *
   * Supplying these is what stops a suppressed leg from silently unlinking its
   * counterpart: the feed row is promoted into the transfer and every reference
   * to the leg is re-pointed at it.
   */
  transferHandovers?: readonly TransferHandover[];
  /**
   * COMPLETE database rows for the bank-feed transactions named by
   * `transferHandovers`, keyed by id (`select *`).
   *
   * Complete because the promotion goes out through the same batched merge as
   * the link pass, and that merge sends whole rows: Postgres builds the
   * candidate tuple — evaluating every NOT NULL column — before it resolves ON
   * CONFLICT. Rows the plan does not need are ignored; a handover with no row
   * here is refused rather than guessed at (see `unpromotableHandovers`).
   */
  feedTransactionRowsById?: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  /**
   * COMPLETE database rows for the user's accounts, keyed by id — required only
   * to REBASE an opening balance, and for the same reason as above.
   */
  existingAccountRowsById?: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  /**
   * Correct a reused account's `initial_balance` to the file's value.
   *
   * OPT-IN, always. A reused account is one the importer did not create, so its
   * opening balance may be the user's own considered figure; overwriting that
   * silently on every re-import would be indefensible. Off, the disagreement is
   * still REPORTED (`openingBalanceMismatches`) — which is what stops a
   * re-import claiming success while a fabricated opening balance survives it.
   */
  rebaseOpeningBalances?: boolean;
}

/** Case/whitespace-insensitive key for name matching. */
const normName = (name: string): string => name.trim().toLowerCase();

/**
 * Depth of a seed category within the seed's own tree, so the plan can emit
 * parents before children (a batched insert cannot satisfy a forward FK across
 * batch boundaries). Broken/cyclic parent chains stop the walk; the child then
 * simply resolves later and is caught by the unresolved-parent path.
 */
function seedDepth(c: Category, bySeedId: ReadonlyMap<string, Category>): number {
  const seen = new Set<string>([c.id]);
  let depth = 0;
  let cursor = c;
  while (cursor.parentId) {
    const parent = bySeedId.get(cursor.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    cursor = parent;
    depth++;
  }
  return depth;
}

/**
 * Pure: turn the app-shaped collections into DB rows with fresh UUIDs and every
 * cross-reference remapped. Separated from the I/O so it can be unit-tested.
 */
export function planCloudImport(
  result: MsMoneyImportResult,
  userId: string,
  newId: () => string,
  options: CloudPlanOptions = {}
): CloudPlan {
  const existingBySourceId = options.existingBySourceId ?? new Map<string, string>();
  const requestedSuppression = options.suppressedSourceIds ?? new Set<string>();

  // ── Transfer handovers: a suppression only counts if a successor exists ────
  // A handover names the feed row that inherits the leg. Without the complete
  // feed row the promotion cannot be written, and dropping the leg anyway would
  // delete a real transfer and quietly unlink its counterpart — so that leg is
  // NOT suppressed at all. It comes back as an ordinary import, and the caller
  // learns about it through `unpromotableHandovers`.
  const feedRowsById = options.feedTransactionRowsById ?? new Map<string, Readonly<Record<string, unknown>>>();
  const handovers = options.transferHandovers ?? [];
  const unpromotableHandovers: TransferHandover[] = [];
  const handoverBySourceId = new Map<string, TransferHandover>();
  for (const h of handovers) {
    if (!requestedSuppression.has(h.importSourceId)) continue; // not a suppression: nothing to hand over
    if (!feedRowsById.has(h.feedTransactionId)) { unpromotableHandovers.push(h); continue; }
    handoverBySourceId.set(h.importSourceId, h);
  }
  const refused = new Set(unpromotableHandovers.map(h => h.importSourceId));
  const suppressed: ReadonlySet<string> = refused.size === 0
    ? requestedSuppression
    : new Set([...requestedSuppression].filter(id => !refused.has(id)));

  // ── Accounts: reuse a row the user already has, else mint one ─────────────
  // Accounts carry no provenance columns and the table has no natural unique
  // key, so the name — claimed at most once — is the identity. On the total
  // migration the wipe leaves nothing to claim and every account is inserted.
  const unclaimedAccountsByName = new Map<string, string[]>();
  for (const row of options.existingAccounts ?? []) {
    const key = normName(row.name);
    const bucket = unclaimedAccountsByName.get(key);
    if (bucket) bucket.push(row.id); else unclaimedAccountsByName.set(key, [row.id]);
  }
  const acctId = new Map<string, string>();
  const reusedAccountIds = new Set<string>();
  for (const a of result.accounts) {
    const claimed = unclaimedAccountsByName.get(normName(a.name))?.shift();
    if (claimed) {
      acctId.set(a.id, claimed);
      reusedAccountIds.add(a.id);
    } else {
      acctId.set(a.id, newId());
    }
  }

  const catId = new Map<string, string>();
  const insertedCategories: Record<string, unknown>[] = [];
  let categoriesWithUnresolvedParent = 0;
  let reusedCategories = 0;
  {
    // ── Categories: resolve onto the user's own tree ────────────────────────
    // The seed's type-level roots are placeholders (`type-income`, …) that the
    // user holds as UUIDs, so they MUST be matched, not minted: a minted root
    // is never inserted (system rows are the app's, not the importer's) and
    // every child pointed at it would carry a dangling `parent_id`.
    //
    // Root signature: `is_system = true AND level = 'type'` — the two columns
    // that make a row a root at all — plus the name and `type` (income /
    // expense / both), which together identify WHICH root. Both are matched:
    // name and type agreeing is the strongest signature, then the name alone
    // (a legacy tree can mistype a root), then the type alone (a renamed root
    // is still structurally itself — the same fallback the database uses in
    // `create_transfer_category_for_account`, migration 20260708140000).
    // There is exactly one root per type in both the app's default set and the
    // Money seed. A user with NO matching root gets one CREATED — the roots
    // are never assumed to exist.
    //
    // Everything below the roots is keyed on (parent_id, name) — the table's
    // own `categories_user_id_name_parent_id_key`. Matching on the constraint
    // the database enforces means a row that WOULD collide is reused instead,
    // so a second import inserts nothing rather than failing.
    const existingRowIds = new Set((options.existingCategories ?? []).map(r => r.id));
    const byParentAndName = new Map<string, string>();
    const childKey = (parentId: string | null, name: string): string =>
      `${parentId ?? ''}\u0000${normName(name)}`;
    for (const row of options.existingCategories ?? []) {
      const key = childKey(row.parent_id, row.name);
      if (!byParentAndName.has(key)) byParentAndName.set(key, row.id);
    }

    // Roots are assigned up front, strongest signature first, each existing
    // root claimed by at most ONE seed root — so a degenerate tree (say, every
    // root typed 'both') cannot collapse two seed roots onto the same row and
    // re-file half the categories under the wrong parent.
    const existingRoots = (options.existingCategories ?? [])
      .filter(r => r.level === 'type' && r.is_system === true);
    const claimedRoots = new Set<string>();
    const rootMatch = new Map<string, string>();
    const ROOT_SIGNATURES: ((seed: Category, row: ExistingCategoryRow) => boolean)[] = [
      (s, r) => r.type === s.type && normName(r.name) === normName(s.name),
      (s, r) => normName(r.name) === normName(s.name),
      (s, r) => r.type === s.type,
    ];
    for (const matches of ROOT_SIGNATURES) {
      for (const seedRoot of result.categories) {
        if (seedRoot.level !== 'type' || rootMatch.has(seedRoot.id)) continue;
        const row = existingRoots.find(r => !claimedRoots.has(r.id) && matches(seedRoot, r));
        if (row) {
          rootMatch.set(seedRoot.id, row.id);
          claimedRoots.add(row.id);
        }
      }
    }

    const bySeedId = new Map(result.categories.map(c => [c.id, c]));
    const ordered = result.categories
      .map((c, index) => ({ c, index, depth: seedDepth(c, bySeedId) }))
      .sort((a, b) => a.depth - b.depth || a.index - b.index);

    for (const { c } of ordered) {
      // Parent first: only an id that will genuinely exist after the import is
      // allowed through. Anything else becomes NULL and is counted.
      let parentId: string | null = null;
      if (c.parentId) {
        const resolved = catId.get(c.parentId);
        if (resolved) parentId = resolved;
        else categoriesWithUnresolvedParent++;
      }

      const isRoot = c.level === 'type';
      const existingId = isRoot
        ? rootMatch.get(c.id)
        : byParentAndName.get(childKey(parentId, c.name));
      if (existingId) {
        catId.set(c.id, existingId);
        if (existingRowIds.has(existingId)) reusedCategories++;
        continue;
      }

      const id = newId();
      catId.set(c.id, id);
      insertedCategories.push({
        id,
        user_id: userId,
        name: c.name,
        type: c.type,
        level: c.level,
        parent_id: parentId,
        is_system: c.isSystem === true,
        is_transfer_category: c.isTransferCategory === true,
        // Carried through like every other category flag. Without this column the
        // adjustment marking the transform puts on Money's "Xfer to/from Deleted
        // Account" categories survived a local import but was silently dropped on
        // the way to the cloud, so the same file reported differently in each.
        is_revaluation_category: c.isRevaluationCategory === true,
        is_unassigned_bucket: c.isUnassignedBucket === true,
        account_id: c.accountId ? acctId.get(c.accountId) ?? null : null,
        is_active: c.isActive !== false,
      });
      // Register it so a later seed row with the same natural key resolves onto
      // it instead of offering the database a duplicate it would reject.
      const key = childKey(parentId, c.name);
      if (!byParentAndName.has(key)) byParentAndName.set(key, id);
    }
  }

  const txnId = new Map(
    result.transactions
      .filter(t => !suppressed.has(t.id))
      .map(t => [t.id, existingBySourceId.get(t.id) ?? newId()])
  );
  const splitId = new Map(result.transactionSplits.map(s => [s.id, newId()]));
  const cat = (id?: string): string | null => (id && catId.get(id)) || null;
  /**
   * The database id a seed transaction id refers to AFTER the import.
   *
   * Normally the row's own id. For a handed-over transfer leg the row is never
   * written, and the answer is the FEED row that took its place — which is what
   * keeps the counterpart linked to something real instead of being unlinked.
   */
  const linkTarget = (sourceId: string): string | null =>
    txnId.get(sourceId) ?? handoverBySourceId.get(sourceId)?.feedTransactionId ?? null;
  // A transaction already in the database brings its split lines with it.
  const alreadyImported = (sourceId: string): boolean => existingBySourceId.has(sourceId);
  // Suppressed rows are never written, so nothing may reference them either.
  const importable = (sourceId: string): boolean => !suppressed.has(sourceId);

  // The full DB row for an account / a transaction, in ONE place: the insert
  // and the linking pass must send byte-identical column sets, because the
  // linking pass is an upsert of the whole row (see CloudPlan.linkRows).
  const accountRow = (a: Account): Record<string, unknown> => ({
    id: acctId.get(a.id),
    user_id: userId,
    name: a.name,
    type: DB_ACCOUNT_TYPE(a.type),
    balance: a.balance,
    initial_balance: a.openingBalance ?? 0,
    opening_balance_date: a.openingBalanceDate ? dateOnly(a.openingBalanceDate) : null,
    currency: a.currency || 'GBP',
    is_active: a.isActive !== false,
    notes: a.notes ?? null,
  });

  const transactionRow = (t: MsMoneyImportResult['transactions'][number]): Record<string, unknown> => ({
    id: txnId.get(t.id),
    user_id: userId,
    account_id: acctId.get(t.accountId),
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: dateOnly(t.date),
    category: t.isSplit ? '' : (cat(t.category) ?? ''),
    notes: t.notes ?? null,
    // Marked at all — Money's C as well as its R (transform.ts's cs mapping).
    is_cleared: t.cleared === true,
    // …and only R is a finished reconciliation, so the committed flag says so
    // (see `reconciledFromMoney`). A database without migration 20260810200000
    // refuses this column; `executeCloudPlan` gives it up rather than failing.
    [RECONCILED_COLUMN]: reconciledFromMoney(t),
    is_split: t.isSplit === true,
    transfer_account_id: t.transferAccountId ? acctId.get(t.transferAccountId) ?? null : null,
    is_recurring: false,
    // Provenance: stable per-source id, so a re-import skips instead of
    // duplicating (see MS_MONEY_IMPORT_SOURCE).
    import_source: MS_MONEY_IMPORT_SOURCE,
    import_source_id: t.id,
  });

  const accounts = result.accounts
    .filter(a => !reusedAccountIds.has(a.id))
    .map(accountRow);

  // ── Opening balances on REUSED accounts ───────────────────────────────────
  // A reused account is filtered out of the insert above, so `initial_balance`
  // is never rewritten — which is exactly how a fabricated opening balance
  // survives every re-import, silently absorbing whatever discrepancy the
  // ledger had at the moment somebody "repaired" it.
  //
  // The disagreement is always REPORTED. It is only CORRECTED when the caller
  // asks (`rebaseOpeningBalances`), because the stored figure may be the user's
  // own and the importer is not entitled to assume otherwise.
  const existingAccountById = new Map((options.existingAccounts ?? []).map(r => [r.id, r]));
  const existingAccountRowsById =
    options.existingAccountRowsById ?? new Map<string, Readonly<Record<string, unknown>>>();
  const openingBalanceMismatches: OpeningBalanceMismatch[] = [];
  const accountOpeningBalanceRows: Record<string, unknown>[] = [];
  for (const a of result.accounts) {
    if (!reusedAccountIds.has(a.id)) continue;
    const id = acctId.get(a.id)!;
    const existing = existingAccountById.get(id);
    if (!existing || existing.initial_balance === undefined) continue; // no opinion offered
    const fileValue = toDecimal(String(a.openingBalance ?? 0));
    const storedValue = toDecimal(String(existing.initial_balance ?? 0));
    if (fileValue.equals(storedValue)) continue;
    const base = existingAccountRowsById.get(id);
    const rebased = options.rebaseOpeningBalances === true && base != null;
    openingBalanceMismatches.push({
      accountId: id,
      accountName: a.name,
      fileValue: fileValue.toFixed(2),
      storedValue: storedValue.toFixed(2),
      rebased,
    });
    // Complete row, only `initial_balance` moved: the stored balance, the name
    // and every other column the user may have edited are written back as they
    // are. The ledger invariant is a separate repair and stays separate.
    if (rebased && base) accountOpeningBalanceRows.push({ ...base, initial_balance: fileValue.toNumber() });
  }

  // Investment↔cash pairings reference other account rows, so they go in as a
  // second pass once every account exists (insert batching makes same-batch
  // FK ordering unreliable).
  const existingParentById = new Map(
    (options.existingAccounts ?? []).map(r => [r.id, r.parent_account_id ?? null])
  );
  const accountParents: { id: string; parent_account_id: string }[] = [];
  const accountParentRows: Record<string, unknown>[] = [];
  for (const a of result.accounts) {
    if (!a.parentAccountId || !acctId.has(a.parentAccountId)) continue;
    const id = acctId.get(a.id)!;
    const parentAccountId = acctId.get(a.parentAccountId)!;
    accountParents.push({ id, parent_account_id: parentAccountId });
    // Already paired exactly this way — leave the row alone.
    if (existingParentById.get(id) === parentAccountId) continue;
    accountParentRows.push({ ...accountRow(a), parent_account_id: parentAccountId });
  }

  const transactions = result.transactions
    .filter(t => importable(t.id) && !alreadyImported(t.id))
    .map(transactionRow);

  const writtenSplits = result.transactionSplits
    .filter(s => importable(s.transactionId) && !alreadyImported(s.transactionId));
  const writtenSplitIds = new Set(writtenSplits.map(s => s.id));

  const splits = writtenSplits
    .map((s): Record<string, unknown> => ({
      id: splitId.get(s.id),
      transaction_id: txnId.get(s.transactionId),
      user_id: userId,
      category: cat(s.category) ?? '',
      amount: s.amount,
      memo: s.memo ?? null,
      sort_order: s.sortOrder,
      transfer_account_id: s.transferAccountId ? acctId.get(s.transferAccountId) ?? null : null,
      linked_transfer_id: s.linkedTransferId ? linkTarget(s.linkedTransferId) : null,
    }));

  // ── The second pass: transfer links and split-leg pins ────────────────────
  // Transfer pairs reference each other, so neither side can carry its link at
  // insert time. Split legs pin to a split LINE, which is written later still.
  //
  // A pin only ever points at a split line THIS plan writes. Split rows carry
  // no provenance, so an already-imported parent's lines keep database ids the
  // plan cannot know — minting a fresh one and pinning to it would write a
  // reference to a row that does not exist (transactions.linked_transfer_split_id
  // is a real foreign key). Those legs were pinned by the run that created them.
  const currentLinks = options.existingTransactionLinks;
  const transferLinks: { id: string; linked_transfer_id: string }[] = [];
  const splitLegPins: { id: string; linked_transfer_split_id: string }[] = [];
  const linkRows: Record<string, unknown>[] = [];
  for (const t of result.transactions) {
    const id = txnId.get(t.id);
    if (!id) continue;
    const linkedTransferId = t.linkedTransferId ? linkTarget(t.linkedTransferId) : null;
    const linkedTransferSplitId = t.linkedTransferSplitId && writtenSplitIds.has(t.linkedTransferSplitId)
      ? splitId.get(t.linkedTransferSplitId)! : null;
    if (!linkedTransferId && !linkedTransferSplitId) continue;

    if (linkedTransferId) transferLinks.push({ id, linked_transfer_id: linkedTransferId });
    if (linkedTransferSplitId) splitLegPins.push({ id, linked_transfer_split_id: linkedTransferSplitId });

    const current = currentLinks?.get(t.id);
    if (current
      && current.linkedTransferId === linkedTransferId
      && current.linkedTransferSplitId === linkedTransferSplitId) continue;
    linkRows.push({ ...transactionRow(t), linked_transfer_id: linkedTransferId, linked_transfer_split_id: linkedTransferSplitId });
  }

  // ── Promoting the feed rows that took over a transfer leg ─────────────────
  // The leg is gone; the feed row becomes the transfer in its place. It is
  // re-typed (a transfer counted as spending is the double-count in another
  // costume), files under the leg's To/From category, faces the same account,
  // and points at the same counterpart — which itself now points back here.
  //
  // The row goes out COMPLETE, exactly as the database holds it, with only
  // those columns changed: `is_split`, `amount`, `external_transaction_id` and
  // everything else are written back unchanged, so nothing about the feed row's
  // own identity moves. A row whose columns are already right is left out, so a
  // second run of the same plan writes nothing at all.
  const legBySourceId = new Map(result.transactions.map(t => [t.id, t]));
  const feedPromotions: FeedTransferPromotion[] = [];
  const feedPromotionRows: Record<string, unknown>[] = [];
  for (const [sourceId, handover] of handoverBySourceId) {
    const base = feedRowsById.get(handover.feedTransactionId);
    if (!base) continue; // impossible: handoverBySourceId only holds rows we have
    const leg = legBySourceId.get(sourceId);
    const promotion: FeedTransferPromotion = {
      id: handover.feedTransactionId,
      importSourceId: sourceId,
      transfer_account_id: handover.transferAccountId
        ? acctId.get(handover.transferAccountId) ?? null : null,
      linked_transfer_id: handover.counterpartSourceId
        ? linkTarget(handover.counterpartSourceId) : null,
      linked_transfer_split_id: handover.counterpartSplitSourceId
        && writtenSplitIds.has(handover.counterpartSplitSourceId)
        ? splitId.get(handover.counterpartSplitSourceId)! : null,
    };
    feedPromotions.push(promotion);

    // The leg's To/From category, if it resolves; otherwise leave the feed
    // row's own category alone rather than blanking a real one.
    const currentCategory = typeof base.category === 'string' ? base.category : '';
    const changed: Record<string, string | null> = {
      type: 'transfer',
      category: (leg ? cat(leg.category) : null) ?? currentCategory,
      transfer_account_id: promotion.transfer_account_id,
      linked_transfer_id: promotion.linked_transfer_id,
      linked_transfer_split_id: promotion.linked_transfer_split_id,
    };
    const comparable = (value: unknown): string | null => (value == null ? null : String(value));
    const alreadyRight = Object.keys(changed)
      .every(key => comparable(base[key]) === changed[key]);
    if (alreadyRight) continue;
    feedPromotionRows.push({ ...base, ...changed });
  }

  const skippedFeedOverlap = result.transactions.filter(t => suppressed.has(t.id)).length;
  const skippedExisting = result.transactions.length - transactions.length - skippedFeedOverlap;

  return {
    accounts, accountParents, accountParentRows,
    categories: insertedCategories, transactions, transferLinks,
    splits, splitLegPins, linkRows,
    feedPromotions, feedPromotionRows, unpromotableHandovers,
    openingBalanceMismatches, accountOpeningBalanceRows,
    skippedExisting, skippedFeedOverlap,
    skippedExistingAccounts: reusedAccountIds.size,
    skippedExistingCategories: reusedCategories,
    categoriesWithUnresolvedParent,
  };
}
