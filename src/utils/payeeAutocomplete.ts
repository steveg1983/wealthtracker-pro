import type { Category, Transaction } from '../types';
import { buildCategoryKindLookup, classifyFlow } from './incomeExpense';
import { FALLBACK_BANK_DESCRIPTION, normalizePayee } from './payeeAutoCategorize';
import { compareNames } from './localeFormat';

/**
 * Microsoft Money's AutoComplete, as a pair of pure functions: what the user
 * has called their payees before, and which of those names continues what they
 * have just typed.
 *
 * ── WHERE THE PAYEES COME FROM ──────────────────────────────────────────────
 * The transactions themselves. There is no separate payee store in this app and
 * this does not invent one: the Payee cleanup screen counts payees the same way
 * (summarisePayees), payee memory keys on the same text (normalizePayee), and
 * every one of them reads the register rather than a list kept alongside it. A
 * payee list that could drift from the transactions would be a second truth.
 *
 * ── WHY A LEANER PASS THAN summarisePayees ──────────────────────────────────
 * That function also Decimal-sums the money and runs the merchant-key regexes,
 * because its screen prints both. Completing a prefix needs neither, and this
 * runs over the whole register every time the transaction list changes — after
 * every add. So the pass here is counts and dates only, and the ORDER it
 * produces is the one the rest of the payee machinery already uses.
 */

/**
 * One payee name, with its lower-cased form kept beside it.
 *
 * Pre-folded because the match runs on every keystroke over every distinct
 * payee a register holds (thousands, after a decade of statements): folding
 * inside the loop would allocate a string per candidate per keystroke.
 */
export interface PayeeCompletionEntry {
  /** The payee EXACTLY as the transactions spell it — what acceptance writes. */
  text: string;
  /** `text.toLowerCase()`, precomputed. */
  lower: string;
}

/**
 * Every distinct payee in the register, best candidate first.
 *
 * ── THE RANKING, AND WHY THIS ONE ───────────────────────────────────────────
 * Most-used first, ties broken by most-recently-used, then by name. That is
 * word for word the rule buildPayeeGroups documents for payee memory ("the most
 * COMMON existing category (ties broken by the most recent)"), and the register
 * must not teach two different ideas of "the payee you mean". A pure
 * most-recent ranking would let one accident at the top of the list shadow a
 * name used two hundred times; a pure alphabetical one would ignore the user
 * entirely.
 *
 * The name is kept EXACTLY as stored, case and all — the same deliberate choice
 * PayeeSummary documents. Accepting a suggestion writes this string onto a
 * transaction, so it has to be a string the register actually contains.
 *
 * One pass and one sort: this runs against 50k+ rows and nothing here is
 * quadratic.
 */
export function buildPayeeCompletionIndex(
  transactions: readonly Pick<Transaction, 'description' | 'date'>[]
): PayeeCompletionEntry[] {
  interface Accumulator {
    text: string;
    count: number;
    latest: number;
  }

  const byText = new Map<string, Accumulator>();

  for (const transaction of transactions) {
    const description = transaction.description;
    if (typeof description !== 'string') continue;
    const text = description.trim();
    if (text === '') continue;
    // The sentinel the bank-sync handler substitutes for description-less rows.
    // It is not a payee identity — payee memory excludes it for the same reason
    // — and offering it as a completion would put a placeholder on a row the
    // user was in the middle of naming.
    if (normalizePayee(text) === FALLBACK_BANK_DESCRIPTION) continue;

    const when = new Date(transaction.date).getTime();
    const existing = byText.get(text);
    if (existing) {
      existing.count++;
      // A row with an unparseable date must not drag the recency to NaN.
      if (Number.isFinite(when) && when > existing.latest) existing.latest = when;
      continue;
    }
    byText.set(text, { text, count: 1, latest: Number.isFinite(when) ? when : 0 });
  }

  return [...byText.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.latest - a.latest ||
        compareNames(a.text, b.text)
    )
    .map(entry => ({ text: entry.text, lower: entry.text.toLowerCase() }));
}

/**
 * The payee that continues `typed`, or null when nothing does.
 *
 * Prefix, case-insensitive, ranked by the index's own order. Three cases
 * deliberately return null rather than a suggestion:
 *
 *   * nothing typed — a ghost on an empty box would be the app choosing a payee
 *     rather than completing one;
 *   * no prefix match — the keystroke that broke the match clears the ghost,
 *     which is how the user knows they are off the map;
 *   * an EXACT match with nothing left to add — there is no remainder to draw,
 *     and a ghost of zero characters that could still be "accepted" would be a
 *     gesture with no effect.
 *
 * The comparison is on the typed text as it stands, untrimmed: the ghost is
 * drawn immediately after the caret, so it can only ever continue the exact
 * characters in the box.
 */
export function findPayeeCompletion(
  typed: string,
  index: readonly PayeeCompletionEntry[]
): string | null {
  if (typed === '') return null;
  const needle = typed.toLowerCase();
  for (const entry of index) {
    if (entry.text.length > typed.length && entry.lower.startsWith(needle)) {
      return entry.text;
    }
  }
  return null;
}

/**
 * The category this payee is usually filed under, or undefined.
 *
 * ── THE SAME RULE AS THE REST OF PAYEE MEMORY ───────────────────────────────
 * Most common, ties broken by most recent — buildPayeeGroups' rule, so a payee
 * suggested here and the same payee suggested in the bulk-categorise screen can
 * never disagree. History is read through classifyFlow rather than off the
 * transaction's direction, for the reason incomeExpense sets out: a refund is
 * money IN filed under an expense category, and reading its direction instead
 * of its category would file the next one as income.
 *
 * Rows with no usable category are skipped, so an uncategorised payee simply
 * has no memory — the caller prefills nothing and the user chooses, which is
 * the honest answer rather than a guess dressed as one.
 */
export function rememberedCategoryForPayee(
  transactions: readonly Transaction[],
  categories: Category[],
  description: string,
  direction: 'income' | 'expense'
): string | undefined {
  const payee = normalizePayee(description);
  if (payee === '' || payee === FALLBACK_BANK_DESCRIPTION) return undefined;

  const kinds = buildCategoryKindLookup(categories);
  const byCategory = new Map<string, { count: number; latest: number }>();

  for (const transaction of transactions) {
    if (transaction.type === 'transfer') continue;
    if (classifyFlow(transaction, kinds) !== direction) continue;
    if (normalizePayee(transaction.description) !== payee) continue;
    const category = transaction.category;
    // classifyFlow already rejects a blank or dangling category, so anything
    // reaching here is a real id; the guard is belt and braces for a caller
    // that hands in rows the lookup has never seen.
    if (!category || !kinds.has(category)) continue;

    const when = new Date(transaction.date).getTime();
    const entry = byCategory.get(category) ?? { count: 0, latest: 0 };
    entry.count++;
    if (Number.isFinite(when) && when > entry.latest) entry.latest = when;
    byCategory.set(category, entry);
  }

  if (byCategory.size === 0) return undefined;
  return [...byCategory.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest
  )[0][0];
}
