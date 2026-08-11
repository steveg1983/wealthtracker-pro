/**
 * A crate answer's rows as the app's own objects.
 *
 * Seven translations, one per entity the seam reads, and each one is the ONLY
 * place that entity crosses from the file into the application. They are here
 * rather than beside the port for the reason `accountMapping.ts` gives at
 * length about the two account mappers that once existed: *"an account has ONE
 * shape however it was loaded"*, and two mappers each complete in the fields the
 * other forgot made three bugs no amount of reading either file would explain.
 *
 * ── WHAT IS REUSED, AND WHAT COULD NOT BE ───────────────────────────────────
 *
 * ACCOUNTS reuse the cloud's mapper outright. `services/api/accountMapping.ts`
 * is "the ONE translation" and it imports nothing but types, so the local
 * edition can call it without dragging a Supabase client into a desktop bundle.
 * One rename happens first (see {@link toAccount}) and then the same function
 * the cloud boot uses reads the row. Anything it learns, this learns.
 *
 * The other six have a cloud twin that CANNOT be imported: `budgetFromDb` /
 * `goalFromDb` live inside `planningService.ts`, the split mapper inside
 * `transactionService.ts`, and both modules carry a Supabase client at module
 * scope. Importing either would put the cloud in the desktop bundle — the exact
 * thing PHASE3-PLAN §5's two bundle greps exist to refuse. So the mappings
 * below are written out, each naming the twin it must agree with and copying
 * its decisions explicitly rather than by accident:
 *
 *   budgets      planningService.ts `budgetFromDb`  — categoryId travels in the
 *                TEXT `category` column, never in the uuid `category_id`
 *   goals        planningService.ts `goalFromDb`    — `type` lives in metadata,
 *                `isActive` is "not paused", `progress` IS `current_amount`
 *   splits       transactionService.ts `mapSplitRow`
 *   transactions transactionService.ts `mapFromDbFields` + `DB_TO_CAMEL`
 *   categories   planningService.ts's category select
 *   dismissals   suggestionDismissalService.ts
 *
 * Making those six shareable means lifting them out of two Supabase-carrying
 * modules, which is a refactor of the cloud path and belongs to a commit that
 * says so. Until then the guard against drift is not this comment: it is the
 * contract suite, which asks both engines the same questions and compares
 * app-shaped answers.
 *
 * ── THREE THINGS THE FILE CANNOT ANSWER, STATED RATHER THAN GUESSED ─────────
 *
 * `Transaction.reconciled`, `Account.lastReconciledBalance` and
 * `Transaction.metadata`-derived fields have no column in
 * `scripts/local-sqlite/schema.sql`: the mirror predates
 * `20260810200000_marking_is_not_reconciling.sql`. They therefore read as
 * `undefined`, which `utils/transactionReconciliation.ts` defines as "ask
 * `cleared`" — the one-flag behaviour, which is exactly what such a file is
 * still describing. Inventing `false` would report a whole reconciled history
 * as unreconciled work.
 */

import { mapAccountFromDb } from '../../api/accountMapping';
import type {
  Account,
  Budget,
  Category,
  Goal,
  SuggestionDismissal,
  Transaction,
  TransactionSplit
} from '../../../types';
import type { AccountBalanceSnapshot } from '../../port/dataPort';
import {
  day,
  field,
  flag,
  instant,
  money,
  moneyOr,
  oneOf,
  strings,
  text,
  textOr,
  whole
} from './values';

/** The crate names a column `kind` wherever `type` is a Rust keyword clash. */
const KIND = 'kind';

/**
 * A listed account.
 *
 * The crate's row IS the `accounts` row, column for column, with one exception:
 * `type` is serialised as `kind`. So the rename happens here and the row then
 * goes through `mapAccountFromDb` — the same function the signed-in boot uses —
 * which is what keeps `lowBalanceAlertEnabled`, `sortCode`/`accountNumber` and
 * the opening balance from being forgotten by a second mapper, as they were
 * once before.
 */
export const toAccount = (row: Record<string, unknown>): Account =>
  mapAccountFromDb({ ...row, type: row[KIND] });

/** Every category value the app knows, as a runtime lookup (see `oneOf`). */
const CATEGORY_TYPES: Record<Category['type'], true> = {
  income: true,
  expense: true,
  both: true
};

const CATEGORY_LEVELS: Record<Category['level'], true> = {
  type: true,
  sub: true,
  detail: true
};

export const toCategory = (row: Record<string, unknown>): Category => ({
  id: textOr(row.id, ''),
  name: textOr(row.name, ''),
  type: oneOf<Category['type']>(row[KIND], CATEGORY_TYPES, 'expense'),
  level: oneOf<Category['level']>(row.level, CATEGORY_LEVELS, 'detail'),
  parentId: text(row.parent_id) ?? null,
  color: text(row.color),
  icon: text(row.icon),
  isSystem: flag(row.is_system),
  isTransferCategory: flag(row.is_transfer_category),
  isRevaluationCategory: flag(row.is_revaluation_category),
  isUnassignedBucket: flag(row.is_unassigned_bucket),
  accountId: text(row.account_id),
  isActive: flag(row.is_active)
});

const TRANSACTION_TYPES: Record<Transaction['type'], true> = {
  income: true,
  expense: true,
  transfer: true
};

/**
 * A listed transaction.
 *
 * `category` is `''` rather than absent when the column is NULL, because the
 * app's type says `string` and a split parent legitimately holds no category of
 * its own (`transactions_split_parent_has_blank_category` in the schema makes
 * that a constraint rather than a habit).
 *
 * `category_id` is deliberately NOT mapped: `Transaction` has no such field.
 * The cloud's mapper produces the key anyway because it renames every column it
 * meets and then casts the result, so nothing there notices; writing it here
 * would be inventing a property the app has no reader for.
 */
export const toTransaction = (row: Record<string, unknown>): Transaction => ({
  id: textOr(row.id, ''),
  accountId: textOr(row.account_id, ''),
  amount: moneyOr(row.amount, 0),
  date: day(row.date) ?? new Date(0),
  description: textOr(row.description, ''),
  category: textOr(row.category, ''),
  categoryConfirmed: flag(row.category_confirmed),
  needsReview: flag(row.needs_review),
  type: oneOf<Transaction['type']>(row[KIND], TRANSACTION_TYPES, 'expense'),
  tags: strings(row.tags),
  notes: text(row.notes),
  cleared: flag(row.is_cleared),
  isRecurring: flag(row.is_recurring),
  isSplit: flag(row.is_split),
  archived: flag(row.archived),
  statementSequence: whole(row.statement_sequence) ?? null,
  createdAt: instant(row.created_at),
  updatedAt: instant(row.updated_at),
  linkedTransferId: text(row.linked_transfer_id),
  transferAccountId: text(row.transfer_account_id),
  linkedTransferSplitId: text(row.linked_transfer_split_id)
});

/**
 * A split line.
 *
 * The two transfer-leg fields are omitted rather than set to `undefined` when
 * they are null, matching `transactionService.mapSplitRow`: the register asks
 * `'transferAccountId' in line` in places, and a present-but-undefined key
 * answers that question the wrong way.
 */
export const toSplit = (row: Record<string, unknown>): TransactionSplit => ({
  id: textOr(row.id, ''),
  transactionId: textOr(row.transaction_id, ''),
  category: textOr(row.category, ''),
  amount: moneyOr(row.amount, 0),
  memo: text(row.memo) === '' ? undefined : text(row.memo),
  sortOrder: whole(row.sort_order) ?? 0,
  ...(text(row.transfer_account_id) ? { transferAccountId: text(row.transfer_account_id) } : {}),
  ...(text(row.linked_transfer_id) ? { linkedTransferId: text(row.linked_transfer_id) } : {})
});

const BUDGET_PERIODS: Record<Budget['period'], true> = {
  monthly: true,
  weekly: true,
  yearly: true,
  custom: true,
  quarterly: true
};

/**
 * A budget.
 *
 * `categoryId` comes out of the TEXT `category` column and never out of
 * `category_id`, which is `budgetFromDb`'s decision and its reason verbatim:
 * *"frontend category ids are not UUIDs, so the uuid `category_id` column
 * cannot hold them"*.
 *
 * `alert_threshold` arrives as the crate's already-rendered percentage string
 * ('80.00' for the stored 8000 basis-points-of-a-percent). It is read with the
 * money reader because the shape is the same — a fixed two-place decimal — and
 * NOT because it is money: `schema.sql` says in capitals that it is not, and
 * dividing 8000 by 100 on this side of the boundary is precisely the arithmetic
 * this directory forbids.
 *
 * A stored period the app has no member for — the schema allows 'biweekly',
 * the app's union does not — reads as 'custom', which is the app's own name for
 * a cadence none of the standard ones describe. A cast would put a string the
 * budgets page has no branch for into a period selector.
 */
export const toBudget = (row: Record<string, unknown>): Budget => ({
  id: textOr(row.id, ''),
  categoryId: textOr(row.category, ''),
  amount: moneyOr(row.amount, 0),
  period: oneOf<Budget['period']>(row.period, BUDGET_PERIODS, 'custom'),
  isActive: flag(row.is_active),
  createdAt: instant(row.created_at) ?? new Date(0),
  updatedAt: instant(row.updated_at) ?? new Date(0),
  name: text(row.name),
  spent: moneyOr(row.spent, 0),
  startDate: text(row.start_date),
  endDate: text(row.end_date),
  rollover: flag(row.rollover),
  rolloverAmount: moneyOr(row.rollover_amount, 0),
  alertThreshold: money(row.alert_threshold),
  notes: text(row.notes)
});

const GOAL_TYPES: Record<Goal['type'], true> = {
  savings: true,
  'debt-payoff': true,
  investment: true,
  custom: true
};

const GOAL_PRIORITIES: Record<NonNullable<Goal['priority']>, true> = {
  low: true,
  medium: true,
  high: true
};

const GOAL_STATUSES: Record<NonNullable<Goal['status']>, true> = {
  active: true,
  completed: true,
  paused: true
};

/**
 * A goal, mapped exactly as `goalFromDb` maps the cloud's row.
 *
 * Three of its decisions are not obvious and all three are copied deliberately:
 *
 *  - `type` is not a column in either engine. It lives in `metadata.type`, and
 *    'savings' is the default a goal with no stated kind reads as.
 *  - `isActive` is "the status is not paused" and `achieved` is "the status is
 *    completed". One column answers both, because a goal has one state.
 *  - `progress` IS `current_amount`. It is not derived from the target and it is
 *    never zero for a goal created with money already put by — the rule the
 *    contract suite asks for by name, and the one that used to be lost
 *    differently by each engine.
 *
 * `status` is read against the app's three values, so the schema's fourth
 * ('canceled', which no screen offers and nothing writes) reads as 'active'
 * rather than as a value the goals page cannot draw.
 */
export const toGoal = (row: Record<string, unknown>): Goal => {
  const currentAmount = moneyOr(row.current_amount, 0);
  // Annotated rather than inferred: without it TypeScript narrows the result to
  // the literal type of the fallback, and the two comparisons below — which are
  // the whole of "one column answers both questions" — become comparisons
  // between types with no overlap.
  const status: NonNullable<Goal['status']> = oneOf<NonNullable<Goal['status']>>(row.status, GOAL_STATUSES, 'active');
  const completedAt = instant(row.completed_at);
  return {
    id: textOr(row.id, ''),
    name: textOr(row.name, ''),
    type: oneOf<Goal['type']>(field(row.metadata, 'type'), GOAL_TYPES, 'savings'),
    targetAmount: moneyOr(row.target_amount, 0),
    currentAmount,
    progress: currentAmount,
    // A goal with no target date is a goal with no deadline; the app's type
    // says Date, so "no deadline" is the epoch rather than an Invalid Date that
    // renders as "NaN/NaN/NaN" in the one place the page prints it.
    targetDate: day(row.target_date) ?? new Date(0),
    description: text(row.description),
    isActive: status !== 'paused',
    achieved: status === 'completed',
    status,
    completedAt: completedAt === undefined ? undefined : completedAt.toISOString(),
    createdAt: instant(row.created_at) ?? new Date(0),
    updatedAt: instant(row.updated_at) ?? new Date(0),
    category: text(row.category),
    priority: typeof row.priority === 'string'
      ? oneOf<NonNullable<Goal['priority']>>(row.priority, GOAL_PRIORITIES, 'medium')
      : undefined,
    accountId: text(row.account_id),
    autoContribute: flag(row.auto_contribute),
    contributionFrequency: text(row.contribution_frequency),
    icon: text(row.icon),
    color: text(row.color)
  };
};

/**
 * Every kind the APP knows — which is three more than the file can currently
 * store.
 *
 * `scripts/local-sqlite/schema.sql` spells its CHECK
 * `kind IN ('transfer-pair','transfer-leg','stranded','duplicate')`, so the
 * three payee kinds added later have no home in a local ledger yet: a backup
 * carrying one would be refused by that constraint on the way in. The gap is
 * the schema's and it is fixed there (the dismissal writes are slice 23), not
 * papered over here — this list stays the APP's, so the day the CHECK is
 * widened the reader already understands the answer, and until then a value it
 * cannot hold cannot arrive.
 */
const DISMISSAL_KINDS: Record<SuggestionDismissal['kind'], true> = {
  'transfer-pair': true,
  'transfer-leg': true,
  stranded: true,
  duplicate: true,
  'payee-merchant': true,
  'payee-line': true,
  'payee-hidden': true
};

/**
 * A dismissal, with the child table already folded back into an array.
 *
 * `subject_ids` is a `text[]` column in the cloud and a joined child table
 * locally (`suggestion_dismissal_subjects`, ordered by `role_order`) — the verb
 * does the join, so what arrives here is the array either engine's caller
 * expects, in role order.
 */
export const toDismissal = (row: Record<string, unknown>): SuggestionDismissal => ({
  id: textOr(row.id, ''),
  kind: oneOf<SuggestionDismissal['kind']>(row.kind, DISMISSAL_KINDS, 'duplicate'),
  subjectKey: textOr(row.subject_key, ''),
  subjectIds: strings(row.subject_ids),
  dismissedAt: instant(row.dismissed_at) ?? new Date(0)
});

/**
 * One account's DERIVED balance — `initial_balance + Σ amounts`, computed where
 * the rows are and never read off `accounts.balance`.
 *
 * `txnCount` is `COUNT(t.id)` under a LEFT JOIN, so an account with no
 * transactions answers 0 rather than 1. The crate holds that property (and the
 * three beside it) in `row/balance.rs`; this side only reads the answer.
 */
export const toBalance = (
  row: Record<string, unknown>
): { accountId: string; snapshot: AccountBalanceSnapshot } => ({
  accountId: textOr(row.account_id, ''),
  snapshot: {
    balance: moneyOr(row.balance, 0),
    txnCount: whole(row.txn_count) ?? 0
  }
});
