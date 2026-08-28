/**
 * IMPORT RULES, APPLIED TO A BANK FEED — with two of the five actions taken
 * away, on purpose.
 *
 * The owner asked on 28 Aug whether rules apply to automatic bank imports.
 * They did not: the engine lived inside a service that read rules out of a
 * browser, so the server could never run one. Rules now live in the account
 * and the engine is a shared file, which leaves only the question of WHICH
 * rules a feed should be allowed to obey.
 *
 * ── WHY `skip` DOES NOT APPLY HERE (the owner's ruling) ─────────────────────
 *
 * Skipping a row from a file is recoverable: the file is still on disk and can
 * be imported again. Skipping a transaction a bank reported is not. The row
 * never enters the ledger, nothing says so, and the account quietly stops
 * agreeing with the statement — which is the one failure this application
 * exists to prevent. A rule with a skip action is not an error and does not
 * fail; it simply has nothing to do here.
 *
 * ── AND WHY `setAccount` GOES WITH IT ───────────────────────────────────────
 *
 * Same argument, one step further. A fed row belongs to the account the bank
 * sent it for; moving it elsewhere would leave that account short by exactly
 * the amount moved, against a statement that still contains it. Reconciliation
 * is the point of a feed.
 *
 * What remains is what the owner named: categorise, tag, rename. All three
 * change how a transaction READS, never which money moved or where.
 *
 * ── HOW THE STRIPPING WORKS, AND WHY IT IS NOT A SECOND ENGINE ──────────────
 *
 * The unsafe ACTIONS are removed and the shared engine runs unchanged on what
 * is left. A rule that matches still applies its categorise/tag/rename half;
 * a rule left with nothing to do is dropped. Nothing here re-implements
 * matching — a second matcher would be a second set of bugs, and the guarantee
 * worth having is that a rule matches the same transactions whichever door it
 * came in through.
 */
import { applyRules } from '../importRules/engine.js';
import type { ImportRule, ImportRuleAction } from '../../types/importRules.js';

/** The actions a bank feed may not carry out. See the header for each. */
const UNSAFE_ON_A_FEED: ReadonlySet<ImportRuleAction['type']> = new Set(['skip', 'setAccount']);

export function isFeedSafeAction(action: ImportRuleAction): boolean {
  return !UNSAFE_ON_A_FEED.has(action.type);
}

/** True when a rule has at least one action a feed refuses to perform. */
export function hasActionAFeedIgnores(rule: ImportRule): boolean {
  return rule.actions.some(action => !isFeedSafeAction(action));
}

/**
 * The rules a feed may run: enabled, in priority order, with unsafe actions
 * removed and rules left empty by that removal dropped.
 */
export function feedSafeRules(rules: readonly ImportRule[]): ImportRule[] {
  return rules
    .filter(rule => rule.enabled)
    .map(rule => ({ ...rule, actions: rule.actions.filter(isFeedSafeAction) }))
    .filter(rule => rule.actions.length > 0)
    .sort((a, b) => a.priority - b.priority);
}

/** What a feed row looks like on its way into the atomic import. */
export interface FeedRow {
  account_id: string;
  description: string;
  amount: number;
  date: string;
  category?: string | null;
  tags?: string[];
}

/**
 * Run the owner's rules over one row the bank sent.
 *
 * Returns the row unchanged and `changed: false` when no rule matched, so the
 * caller can count what actually happened rather than what was attempted —
 * the sync reports that number, because a transformation nobody is told about
 * is one nobody can check.
 */
export function applyFeedRules<T extends FeedRow>(
  row: T,
  rules: readonly ImportRule[]
): { row: T; changed: boolean } {
  const safe = feedSafeRules(rules);
  if (safe.length === 0) return { row, changed: false };

  // The engine speaks the app's Transaction shape; a feed row is database
  // columns. This is the whole translation, and it is one way only — nothing
  // the engine can set is a column the feed does not already own.
  const applied = applyRules(
    {
      description: row.description,
      amount: row.amount,
      accountId: row.account_id,
      date: new Date(row.date),
      ...(row.category ? { category: row.category } : {}),
      ...(row.tags ? { tags: [...row.tags] } : {})
    },
    safe
  );

  // `applyRules` returns null only for a skip, and skips cannot reach here.
  if (!applied) return { row, changed: false };

  const description = applied.description ?? row.description;
  const category = applied.category ?? row.category ?? null;
  const tags = applied.tags ?? row.tags ?? [];

  const changed =
    description !== row.description ||
    category !== (row.category ?? null) ||
    tags.length !== (row.tags?.length ?? 0);

  if (!changed) return { row, changed: false };

  return { row: { ...row, description, category, tags }, changed: true };
}
