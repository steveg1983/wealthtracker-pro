import type { Transaction } from '../types';
import { toDecimal } from './decimal';
import {
  payeeHiddenDismissalKey,
  payeeLineDismissalKey,
  payeeMerchantDismissalKey,
} from './suggestionDismissals';
import { compareNames, compareText } from './localeFormat';

/**
 * The pure half of the Payee cleanup screen: count the distinct payees a
 * register actually contains, and hint at which of them are the same merchant
 * wearing different transaction references.
 *
 * The problem this exists for: banks bake a per-transaction reference into the
 * description, so one merchant arrives as thousands of unique payees —
 * `AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK`, `AMZNMKTPLACE*3W9NN1HR5
 * AMAZON.CO.UK`, `AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK` — and the same for
 * dated bank lines (`DEBIT INTEREST TO 28FEB2026 INT`). None of them ever
 * repeat, so nothing in the app can learn them and every report treats them as
 * separate shops.
 *
 * Everything here SUGGESTS. Nothing here decides: the caller renames only what
 * the user ticked.
 */

export interface PayeeSummary {
  /**
   * The payee text EXACTLY as stored on the transactions.
   *
   * Deliberately not trimmed, case-folded or otherwise normalised into a
   * looser key. A rename rewrites this string on every row behind it, so the
   * row the user ticks has to be the set of rows they can see the text of —
   * grouping `Tesco` in with `TESCO` here would rewrite rows whose text never
   * appeared on screen.
   */
  description: string;
  /** How many transactions carry this exact text. */
  count: number;
  /** Sum of the absolute amounts, Decimal-summed. */
  total: number;
  earliest: Date;
  latest: Date;
  /**
   * The merchant this payee LOOKS like it belongs to, upper-cased — or null
   * when nothing recognisable could be pulled out of the text. Purely a hint
   * for finding a cluster fast; see suggestMerchantKey.
   */
  merchantKey: string | null;
}

export interface PayeeCluster {
  /** The shared merchant key, e.g. `AMAZON.CO.UK` or `DEBIT INTEREST TO`. */
  key: string;
  /** The distinct payee texts that share it, most common first. */
  members: PayeeSummary[];
  /** Transactions across every member. */
  transactionCount: number;
}

/**
 * A token that is a domain: `AMAZON.CO.UK`, `PAYPAL.COM`, `WWW.TESCO.COM`.
 *
 * Anchored to the whole token and requiring a 2+ letter final label, so
 * `AMZNMKTPLACE*1X6DN8XF5` (no dot) and `28FEB2026` (no dot) never qualify
 * while the trailing `AMAZON.CO.UK` on the same line does.
 */
const DOMAIN_TOKEN = /^[A-Z0-9][A-Z0-9-]*(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}$/;

/** A token made only of letters and the punctuation that lives inside names. */
const WORD_TOKEN = /^[A-Z][A-Z&'-]*$/;

/**
 * How many leading words a prefix key may use.
 *
 * Three is the smallest number that separates the bank lines that matter:
 * `DEBIT INTEREST TO 28FEB2026 INT` and `CREDIT INTEREST TO 30APR2026 INT`
 * differ in word one and agree for three, so they land in different clusters
 * from each other and each gathers its own dated variants. Going wider makes
 * the key so specific that nothing clusters; going narrower fuses `DEBIT
 * INTEREST` with every other `DEBIT …` line.
 */
const MAX_PREFIX_WORDS = 3;

/**
 * The merchant a payee text looks like it belongs to, or null.
 *
 * Two rules, tried in order:
 *
 *  1. A trailing domain wins. Card-network descriptions put the reference
 *     first and the merchant's domain last, so the domain is the only stable
 *     part of `AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK`.
 *  2. Otherwise the leading words, up to the first token carrying a digit or
 *     symbol. That is what makes the dated bank lines collapse: everything
 *     before `28FEB2026` is the part that repeats.
 *
 * A payee whose text yields neither (a bare reference like `TFR 4471982`)
 * returns null and simply never appears in a cluster — better than inventing
 * a grouping for it.
 */
export function suggestMerchantKey(description: string): string | null {
  const text = description.trim().toUpperCase();
  if (text === '') return null;

  // Rule 1 — a domain anywhere in the line, preferring the LAST one, because
  // `AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK` carries the clean copy at the end.
  // `*` splits as well as whitespace: card networks glue the reference
  // straight onto the merchant (`AMAZON.CO.UK*EI8DN58J5`), and the domain is
  // only visible once that join is broken.
  const candidates = text.split(/[\s*]+/);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const token = candidates[i]
      .replace(/[^A-Z0-9.-]/g, '')
      .replace(/^[.-]+|[.-]+$/g, '');
    if (DOMAIN_TOKEN.test(token)) {
      return token.startsWith('WWW.') ? token.slice(4) : token;
    }
  }

  const tokens = text.split(/\s+/);

  // Rule 2 — the leading words.
  const words: string[] = [];
  for (const token of tokens) {
    if (words.length === MAX_PREFIX_WORDS || !WORD_TOKEN.test(token)) break;
    words.push(token);
  }
  // One two-letter word ("TO", "AT") is not a merchant; it would sweep
  // unrelated payees into one heap. Require either two words or one real one.
  if (words.length === 0) return null;
  if (words.length === 1 && words[0].length < 3) return null;
  return words.join(' ');
}

/**
 * Every distinct payee in the register, most common first.
 *
 * One pass over the transactions and one sort — this runs against 50k+ rows,
 * so nothing here is quadratic and nothing re-scans the array per payee.
 *
 * Money is Decimal-summed. The total is a magnitude (absolute amounts), which
 * is what "how much has gone through this payee" means when a merchant has
 * both charges and refunds under the same name.
 */
export function summarisePayees(transactions: Transaction[]): PayeeSummary[] {
  interface Accumulator {
    description: string;
    count: number;
    total: ReturnType<typeof toDecimal>;
    earliest: number;
    latest: number;
  }

  const byDescription = new Map<string, Accumulator>();

  for (const transaction of transactions) {
    const description = transaction.description;
    if (typeof description !== 'string' || description.trim() === '') continue;

    const when = new Date(transaction.date).getTime();
    const amount = Math.abs(transaction.amount);
    const existing = byDescription.get(description);

    if (existing) {
      existing.count++;
      existing.total = existing.total.plus(toDecimal(amount));
      // A row with an unparseable date must not drag the range to 1970.
      if (Number.isFinite(when)) {
        if (when < existing.earliest) existing.earliest = when;
        if (when > existing.latest) existing.latest = when;
      }
      continue;
    }

    byDescription.set(description, {
      description,
      count: 1,
      total: toDecimal(amount),
      earliest: Number.isFinite(when) ? when : Date.now(),
      latest: Number.isFinite(when) ? when : Date.now(),
    });
  }

  const summaries: PayeeSummary[] = [];
  for (const entry of byDescription.values()) {
    summaries.push({
      description: entry.description,
      count: entry.count,
      total: entry.total.toNumber(),
      earliest: new Date(entry.earliest),
      latest: new Date(entry.latest),
      merchantKey: suggestMerchantKey(entry.description),
    });
  }

  // Most common first, biggest money as the tie-break, then alphabetical so
  // the order is stable between renders rather than sort-implementation luck.
  summaries.sort(
    (a, b) =>
      b.count - a.count ||
      b.total - a.total ||
      compareNames(a.description, b.description)
  );
  return summaries;
}

/**
 * The columns of the payee list that can order it, named as the Column keys the
 * table is built from — so a header click arrives here without translation.
 */
const PAYEE_SORT_FIELDS = ['payee', 'merchant', 'count', 'total'] as const;

export type PayeeSortField = (typeof PAYEE_SORT_FIELDS)[number];

/**
 * The table hands sorts back as a plain string (its Column keys are strings),
 * and two of this screen's columns — the checkbox and Leave out — are not
 * orders at all. A guard rather than a cast: an unknown key must be ignored,
 * not believed.
 */
export function isPayeeSortField(value: string): value is PayeeSortField {
  return (PAYEE_SORT_FIELDS as readonly string[]).includes(value);
}

/**
 * The payee name, case-blind, then case-aware — so `Tesco` and `TESCO` sit
 * together and still come out in a fixed order rather than whichever the sort
 * happened to meet first.
 *
 * Every column's tie-break, and never inverted with the direction: a tie-break
 * that flipped would be a second sort, and the rows under a run of equal counts
 * would shuffle every time the arrow was clicked.
 */
const BY_NAME_THEN_EXACTLY = (a: PayeeSummary, b: PayeeSummary): number =>
  compareNames(a.description, b.description) ||
  compareText(a.description, b.description);

interface PayeeColumnOrder {
  /** True when this payee has no value in this column at all. */
  missing?: (payee: PayeeSummary) => boolean;
  /** Ascending. The direction is applied by sortPayees. */
  compare: (a: PayeeSummary, b: PayeeSummary) => number;
}

const PAYEE_COLUMN_ORDERS: Record<PayeeSortField, PayeeColumnOrder> = {
  payee: { compare: BY_NAME_THEN_EXACTLY },
  merchant: {
    // A payee nothing could be read out of has no merchant — an absence, not
    // the smallest name. It sinks to the bottom in BOTH directions, so
    // reversing the column never fills the top of the screen with dashes.
    missing: (payee) => payee.merchantKey === null,
    compare: (a, b) =>
      compareNames((a.merchantKey ?? ''), b.merchantKey ?? ''),
  },
  count: { compare: (a, b) => a.count - b.count },
  // Numeric on a figure that is ALREADY a magnitude — summarisePayees sums
  // absolute amounts — so a £900 run of refunds ranks with a £900 run of
  // spending rather than at the far end of the list. That is the right answer
  // for a screen about how much traffic a payee has seen.
  total: { compare: (a, b) => a.total - b.total },
};

/**
 * The payee list in the order a column header asked for, as a NEW array.
 *
 * Copied rather than sorted in place, for the same reason orderClusters is:
 * the caller's array is what "Showing X of Y" and "select all shown" are
 * counted from, and a display choice must not reorder it underneath them.
 */
export function sortPayees(
  summaries: PayeeSummary[],
  field: PayeeSortField,
  direction: 'asc' | 'desc'
): PayeeSummary[] {
  const { missing, compare } = PAYEE_COLUMN_ORDERS[field];
  const sign = direction === 'asc' ? 1 : -1;
  return [...summaries].sort((a, b) => {
    if (missing) {
      const aMissing = missing(a);
      const bMissing = missing(b);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
    }
    return sign * compare(a, b) || BY_NAME_THEN_EXACTLY(a, b);
  });
}

/**
 * Case- and whitespace-insensitive substring match, so typing "amazon" finds
 * `AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK`. A payee also matches on its merchant
 * key, so searching "interest" still surfaces the dated lines.
 */
export function filterPayees(summaries: PayeeSummary[], query: string): PayeeSummary[] {
  const needle = query.trim().toUpperCase();
  if (needle === '') return summaries;
  return summaries.filter(
    (summary) =>
      summary.description.toUpperCase().includes(needle) ||
      (summary.merchantKey !== null && summary.merchantKey.includes(needle))
  );
}

/**
 * The suggestions the user has already refused, as the subject keys the
 * dismissal table stores (see utils/suggestionDismissals). Keys rather than
 * decoded text, so this filter compares exactly what was persisted.
 */
export interface RefusedSuggestions {
  /** Whole suggested merchants — kind 'payee-merchant'. */
  merchants: ReadonlySet<string>;
  /** Single payees kept out of a merchant — kind 'payee-line'. */
  lines: ReadonlySet<string>;
}

/**
 * The payees the user has struck off the screen entirely — kind 'payee-hidden'.
 *
 * Applied by REMOVING them from the summaries before anything else runs, rather
 * than by teaching each consumer to skip them. That is what makes the promise
 * cheap to keep: the list, the suggestions built from it, the transaction
 * counts inside those suggestions and the "Showing X of Y" above them are all
 * computed from this one array, so there is no path by which a hidden payee can
 * come back in a count while staying out of the list. A suggestion left with
 * fewer than two payees stops being offered on its own (buildPayeeClusters),
 * which is exactly right: there is nothing left to merge.
 *
 * Nothing is deleted and no transaction changes — hiding is a fact about this
 * screen only, undone from "Dismissed suggestions" at the foot of it.
 */
export function withoutHiddenPayees(
  summaries: PayeeSummary[],
  hidden: ReadonlySet<string>
): PayeeSummary[] {
  // Building a key per payee costs an allocation each over a register that can
  // hold tens of thousands, so it is only done when there is something to
  // compare against — the same rule buildPayeeClusters follows below.
  if (hidden.size === 0) return summaries;
  return summaries.filter(
    (summary) => !hidden.has(payeeHiddenDismissalKey(summary.description))
  );
}

const NOTHING_REFUSED: RefusedSuggestions = {
  merchants: new Set<string>(),
  lines: new Set<string>(),
};

/**
 * The two orders the suggestions can be read in.
 *
 * Two, because they answer two different questions and neither answers the
 * other: `transactions` is "which one is worth doing first", `alphabetical` is
 * "where is the one I came here for". With every suggestion on screen rather
 * than a top handful, the second question starts being asked.
 */
export type ClusterOrder = 'transactions' | 'alphabetical' | 'most-payees' | 'fewest-payees';

/**
 * Biggest win first: the transactions a merge would tidy, then the payees it
 * would fold away, then the name — so the order is decided rather than left to
 * sort-implementation luck.
 */
const BY_TRANSACTIONS = (a: PayeeCluster, b: PayeeCluster): number =>
  b.transactionCount - a.transactionCount ||
  b.members.length - a.members.length ||
  compareText(a.key, b.key);

/**
 * A–Z on the merchant name, with the size order as the tie-break so that two
 * keys a collation happens to call equal still come out in a fixed order.
 */
const BY_NAME = (a: PayeeCluster, b: PayeeCluster): number =>
  compareNames(a.key, b.key) || BY_TRANSACTIONS(a, b);

/**
 * Widest spread first: the group that fragmented into the most payees, however
 * few transactions each carries. Transaction count then name break ties, so
 * equal-width groups keep the "worth doing first" order between them.
 */
const BY_MOST_PAYEES = (a: PayeeCluster, b: PayeeCluster): number =>
  b.members.length - a.members.length || BY_TRANSACTIONS(a, b);

/** The same question from the other end: the near-singletons first. */
const BY_FEWEST_PAYEES = (a: PayeeCluster, b: PayeeCluster): number =>
  a.members.length - b.members.length || BY_TRANSACTIONS(a, b);

const COMPARATORS: Record<ClusterOrder, (a: PayeeCluster, b: PayeeCluster) => number> = {
  transactions: BY_TRANSACTIONS,
  alphabetical: BY_NAME,
  'most-payees': BY_MOST_PAYEES,
  'fewest-payees': BY_FEWEST_PAYEES,
};

/**
 * The suggestions in the order the user asked for, as a NEW array.
 *
 * Copied rather than sorted in place because the caller's array is what every
 * count on the screen is derived from, and a display choice must not reorder it
 * underneath them. Memoised on (clusters, order) at the caller, so the copy
 * happens when one of those changes rather than on every render — measured at
 * ~10ms for a pathological 4,500 suggestions and under 0.1ms for the tens or
 * hundreds a real register produces.
 */
export function orderClusters(clusters: PayeeCluster[], order: ClusterOrder): PayeeCluster[] {
  return [...clusters].sort(COMPARATORS[order]);
}

/**
 * The payees that look like one merchant split across many references.
 *
 * Only clusters with at least two distinct payee texts are returned — a
 * merchant that already has one consistent name has nothing to clean up, and
 * listing it as a "suggestion" would be noise. Ordered by how many
 * transactions the cluster would tidy, because that is the size of the win.
 *
 * `refused` is applied HERE rather than at the caller so that everything the
 * screen shows about a cluster is already true: a refused line is out of the
 * members and out of the transaction count, and a cluster left with fewer than
 * two payees stops being offered at all, because there is nothing left to merge.
 */
export function buildPayeeClusters(
  summaries: PayeeSummary[],
  refused: RefusedSuggestions = NOTHING_REFUSED
): PayeeCluster[] {
  const byKey = new Map<string, PayeeSummary[]>();
  for (const summary of summaries) {
    if (summary.merchantKey === null) continue;
    // Building a key per payee costs an allocation each, over a register that
    // can hold tens of thousands of them — so it is only done when there is
    // something to compare against.
    if (
      refused.lines.size > 0 &&
      refused.lines.has(payeeLineDismissalKey(summary.merchantKey, summary.description))
    ) {
      continue;
    }
    const members = byKey.get(summary.merchantKey);
    if (members) {
      members.push(summary);
    } else {
      byKey.set(summary.merchantKey, [summary]);
    }
  }

  const clusters: PayeeCluster[] = [];
  for (const [key, members] of byKey) {
    if (members.length < 2) continue;
    if (refused.merchants.has(payeeMerchantDismissalKey(key))) continue;
    clusters.push({
      key,
      members,
      transactionCount: members.reduce((sum, member) => sum + member.count, 0),
    });
  }

  clusters.sort(BY_TRANSACTIONS);
  return clusters;
}

/**
 * What a rename would actually do: the transaction ids to rewrite, and the
 * payees that are already called the new name and so would not change.
 *
 * The ids come from one pass over the transactions rather than a lookup per
 * payee, because "select all shown" can easily mean thousands of payees.
 */
export interface RenamePlan {
  /** Transactions whose description would be rewritten. */
  transactionIds: string[];
  /** Distinct payee texts that would actually change. */
  payeesChanging: number;
  /** Selected payees already spelled exactly like the new name. */
  payeesUnchanged: number;
}

export function planRename(
  transactions: Transaction[],
  selectedDescriptions: ReadonlySet<string>,
  newDescription: string
): RenamePlan {
  const target = newDescription.trim();
  const changing = new Set<string>();
  let payeesUnchanged = 0;
  for (const description of selectedDescriptions) {
    if (description === target) {
      payeesUnchanged++;
    } else {
      changing.add(description);
    }
  }

  const transactionIds: string[] = [];
  if (target !== '' && changing.size > 0) {
    for (const transaction of transactions) {
      if (changing.has(transaction.description)) {
        transactionIds.push(transaction.id);
      }
    }
  }

  return { transactionIds, payeesChanging: changing.size, payeesUnchanged };
}
