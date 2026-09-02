import type { Transaction } from '../types';
import { calculateSimilarity, findDuplicateGroups, type DuplicateThresholds } from './duplicateScan';
import { descriptionSimilarity, exactPence } from './statementDuplicates';
import { toDecimal } from './decimal';
import { compareText } from './localeFormat';

/**
 * The duplicate sweep: which rows look like the same payment recorded twice,
 * and which of them it is SAFE to delete.
 *
 * ── DETECTING AND DELETING ARE TWO DIFFERENT DECISIONS ──────────────────────
 *
 * They used to be one number. A pair surfaced only if date, amount AND
 * description together scored 80; same day plus the exact amount contributes
 * 70, so the description had to supply 33 of the remaining 30 — the two rows
 * had to read alike. Against real data that finds the pairs whose wording was
 * merely truncated by whatever wrote them, and misses every pair whose payee
 * was renamed by hand. Renaming a payee to something you will recognise a year
 * later is the commonest edit a person makes to their own register, so those
 * misses are systematic, not unlucky.
 *
 * The score could not simply be lowered. This tool DELETES, and the incident
 * the amount gate below exists for — £24.99 offered as a duplicate of £36.95 —
 * is exactly what a loosened threshold costs. So the two decisions are split:
 *
 *   DETECTION uses the signal that survives an edited description: same
 *   account, the same money to the exact penny, inside the date window. That
 *   is the rule utils/statementDuplicates settled on for the OFX importer, and
 *   this module borrows it rather than inventing a third variant — its exact
 *   pence arithmetic (`exactPence`), its ranking signal
 *   (`descriptionSimilarity`) and its strictly 1:1 greedy matching, which is
 *   the property that stops two genuine same-day payments of equal size both
 *   being flagged against one row.
 *
 *   DELETION keeps the old bar. A pair found only by the wider rule carries
 *   basis 'amount-and-date' and is EVIDENCE, not proof: `deleteRefusalFor`
 *   refuses it outright until a human has said, for that one pair, that these
 *   two really are one payment. That refusal lives here, not in the screen —
 *   the screen asks this module, and so would anything else that ever wanted
 *   to delete on the sweep's say-so.
 *
 * Description similarity survives as ranking and confidence. It is never a
 * gate again.
 *
 * ── WHAT THE SCAN STILL KNOWS THAT THE SCORER DOES NOT ──────────────────────
 *
 *  1. ONE ACCOUNT AT A TIME. Two equal, same-day, same-payee rows in DIFFERENT
 *     accounts are not a duplicate, they are a transfer — somebody else's job
 *     (utils/transferSweep), and offering to delete one would destroy half of a
 *     movement of money. Scanning per account is also strictly cheaper: the
 *     index is rebuilt over a fraction of the history each time. Every account
 *     is swept in one run; per account is how it works inside, not how the
 *     user has to drive it.
 *
 *  2. WHETHER THE ROW CAN BE DELETED AT ALL. delete_transaction_atomic removes
 *     the row and reverses its balance, and stops there — it does not chase the
 *     other side of a transfer, and a split parent's lines vanish with it by
 *     foreign key. So three shapes of row must never be offered for deletion;
 *     see DeleteBlock below. The offer is refused in the UI with the reason
 *     said out loud, rather than being quietly hidden: the user still needs to
 *     know these two rows look identical.
 *
 * Thresholds are fixed at "to the penny" on amount and 80% on total similarity.
 * The amount is deliberately NOT adjustable: a knob that lets £100.00 match
 * £99.00 turns a delete tool into a way to lose a real payment. Only the date
 * window moves, because import overlaps genuinely land days apart.
 */

/**
 * Money must match to the penny; anything looser is not a duplicate.
 *
 * This is a GATE, not a score. Passing it to the shared similarity scorer is not
 * enough: there the amount is only 40% of a weighted total, so an identical
 * description (30%) one day apart (30%) carries a pair over the line on its own.
 * £24.99 against £36.95 — 48% apart — scored 82 against a threshold of 80 and was
 * offered as a duplicate. A delete tool must never do that, so amounts are
 * compared first and a mismatch is rejected outright, before scoring runs.
 */
const AMOUNT_THRESHOLD = 0.01;

/** True when two rows are the same money to the penny, sign included. */
function amountsMatch(a: Transaction, b: Transaction): boolean {
  return toDecimal(a.amount).minus(toDecimal(b.amount)).abs().toNumber() <= AMOUNT_THRESHOLD;
}
/**
 * Above 70 the scan can prune by date window (see duplicateScan) — the reason
 * this stays high, besides being the point at which descriptions genuinely
 * read as the same payee.
 */
const SIMILARITY_THRESHOLD = 80;

/**
 * How the pair was found, and therefore how far it may be trusted.
 *
 * 'description-agrees' — date, amount and wording all line up. What an import
 *   landing on top of a bank feed looks like; near-certain, and deletable on
 *   the same terms as before this tier existed.
 * 'amount-and-date' — same account, same money to the exact penny, inside the
 *   window, and the wording does NOT agree. Also what two genuine payments of
 *   the same size look like, so it is evidence for a person to weigh, never
 *   something a button may act on unseen.
 */
export type DuplicateBasis = 'description-agrees' | 'amount-and-date';

/** Two rows in one account that look like the same movement recorded twice. */
export interface DuplicateCandidate {
  /** The row the scan seeded the group with. */
  a: Transaction;
  /** The row it matched. Interchangeable with `a` — see suggestionDismissals. */
  b: Transaction;
  /** 0–100: how alike the two are on date, amount and description together. */
  score: number;
  /** Whole/fractional days between the two dates. */
  daysApart: number;
  /** Which rule found it — and so what has to happen before a delete. */
  basis: DuplicateBasis;
  /** 0–1 word overlap of the two descriptions. Ranking and display only. */
  descriptionOverlap: number;
}

/**
 * Why a row must not be deleted. Every one of these is a case where deleting
 * this row would leave something else in the ledger pointing at nothing.
 */
export type DeleteBlock =
  /** Half of a linked transfer: the row on the other side would be stranded. */
  | 'linked-transfer'
  /** The opposite side of one LINE of a split: that line would be stranded. */
  | 'split-line-counterpart'
  /** A split parent: its lines go with it, and any leg among them is a transfer. */
  | 'split-parent';

/**
 * Why a delete cannot go ahead. The three DeleteBlocks are properties of the
 * ROW; the other two are properties of the request.
 */
export type DeleteRefusal =
  | DeleteBlock
  /** Found by the wider rule, and nobody has yet said the two are one payment. */
  | 'not-confirmed'
  /** The row asked for is not one of this pair's two copies. */
  | 'not-one-of-the-pair';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Why this row cannot be deleted, or null when it can.
 *
 * Order matters: a row whose opposite is a split LINE carries BOTH
 * linkedTransferSplitId and linkedTransferId (the latter pointing at the split
 * parent), and the split-line case is the more precise thing to say.
 */
export function deleteBlockOf(transaction: Transaction): DeleteBlock | null {
  if (transaction.linkedTransferSplitId) return 'split-line-counterpart';
  if (transaction.linkedTransferId) return 'linked-transfer';
  if (transaction.isSplit) return 'split-parent';
  return null;
}

/**
 * True when the pair is evidence rather than proof, and a person has to say so
 * before either copy can go.
 */
export function needsConfirmation(candidate: DuplicateCandidate): boolean {
  return candidate.basis === 'amount-and-date';
}

/**
 * THE DELETE GATE. Why deleting `chosen` out of this pair cannot go ahead, or
 * null when it can.
 *
 * Everything that decides whether a row may be destroyed is in this one
 * function, so a screen cannot widen it by forgetting a check and no future
 * bulk action can route around it: `confirmed` has to be a deliberate answer
 * about THIS pair, which is precisely what a bulk action cannot supply.
 */
export function deleteRefusalFor(
  candidate: DuplicateCandidate,
  chosen: Transaction,
  confirmed: boolean
): DeleteRefusal | null {
  if (chosen.id !== candidate.a.id && chosen.id !== candidate.b.id) return 'not-one-of-the-pair';
  const block = deleteBlockOf(chosen);
  if (block !== null) return block;
  if (needsConfirmation(candidate) && !confirmed) return 'not-confirmed';
  return null;
}

/** One row of the wider pass, with its date and its delete block read once. */
interface DatedRow {
  txn: Transaction;
  time: number;
  deletable: boolean;
}

function candidateOf(
  a: Transaction,
  b: Transaction,
  basis: DuplicateBasis,
  thresholds: DuplicateThresholds
): DuplicateCandidate {
  return {
    a,
    b,
    score: calculateSimilarity(a, b, thresholds).totalScore,
    daysApart: Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / DAY_MS,
    basis,
    descriptionOverlap: descriptionSimilarity(a.description, b.description),
  };
}

/**
 * The wider rule, over one account: same money to the exact penny, dates
 * within the window, whatever the two rows say.
 *
 * Strictly 1:1 and greedy, exactly as findStatementDuplicates is and for the
 * same reason: two £20 cash withdrawals on one day are a real thing, and
 * pairing every equal row with every other would flag both of them. Each row
 * is claimed at most once, so n equal rows in a window yield at most n/2 pairs.
 *
 * A pair in which NEITHER row may be deleted is never formed. In the tier
 * above, a refusal is still worth showing — the wording agreeing is itself
 * evidence the user should see. Here there is no such evidence and no action
 * to offer, so two regular equal transfers a few days apart would be pure
 * noise burying the pairs that can actually be settled. A blocked row is still
 * a perfectly good OTHER side, so it keeps looking for a deletable partner
 * instead of being consumed by one it could never be judged against.
 *
 * Rows are bucketed by exact pence and each bucket sorted oldest-first, then
 * scanned FORWARDS only. That is sound, not a shortcut: a row is reached
 * unclaimed only if every earlier row in its bucket either paired off or had
 * no eligible partner in its (symmetric) window, so the only partner that can
 * lie behind it is one that was ineligible then and is ineligible now — a
 * second blocked row, whose pair is exactly the one dropped above. The scan
 * therefore costs what the window holds, not what the bucket holds: the same
 * discipline that keeps duplicateScan off the main thread on a 16,000-row
 * history.
 */
function pairOnAmountAndDate(
  rows: Transaction[],
  thresholds: DuplicateThresholds
): DuplicateCandidate[] {
  const dated: DatedRow[] = [];
  for (const txn of rows) {
    const time = new Date(txn.date).getTime();
    // A row whose date cannot be read is a duplicate of nothing: it has no
    // position on the calendar to compare, and guessing one would pair it with
    // whatever happened to share its amount.
    if (Number.isFinite(time)) dated.push({ txn, time, deletable: deleteBlockOf(txn) === null });
  }
  dated.sort((a, b) => a.time - b.time || compareText(a.txn.id, b.txn.id));

  const byPence = new Map<number, DatedRow[]>();
  for (const row of dated) {
    const key = exactPence(row.txn.amount);
    const bucket = byPence.get(key);
    if (bucket) bucket.push(row);
    else byPence.set(key, [row]);
  }

  const windowMs = thresholds.dateThreshold * DAY_MS;
  const claimed = new Set<string>();
  const pairs: DuplicateCandidate[] = [];

  for (const bucket of byPence.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const row = bucket[i];
      if (claimed.has(row.txn.id)) continue;

      let best: DatedRow | null = null;
      let bestGap = Number.POSITIVE_INFINITY;
      let bestOverlap = -1;
      for (let j = i + 1; j < bucket.length && bucket[j].time - row.time <= windowMs; j++) {
        const other = bucket[j];
        if (claimed.has(other.txn.id)) continue;
        if (!row.deletable && !other.deletable) continue;
        const gap = other.time - row.time;
        const overlap = descriptionSimilarity(row.txn.description, other.txn.description);
        // Nearest date wins; wording breaks ties, so when several rows are
        // eligible the most plausible pairing is the one offered.
        if (gap < bestGap || (gap === bestGap && overlap > bestOverlap)) {
          best = other;
          bestGap = gap;
          bestOverlap = overlap;
        }
      }
      if (!best) continue;

      claimed.add(row.txn.id);
      claimed.add(best.txn.id);
      pairs.push(candidateOf(row.txn, best.txn, 'amount-and-date', thresholds));
    }
  }

  return pairs;
}

/**
 * Candidate duplicates across the whole history, account by account, in both
 * tiers: the pairs whose wording agrees first, then the pairs the wider rule
 * found among the rows those left behind.
 *
 * Archived rows are excluded: they are out of the live register by the user's
 * own choice, still counted in every balance, and offering to delete one would
 * be acting on something they cannot see.
 *
 * A three-way duplicate (A, B, C) comes back as the two pairs the scan found —
 * A/B and A/C — not as three. Deleting A leaves B and C, and the next scan
 * offers B/C: one decision at a time, each with both of its rows in front of
 * the user.
 *
 * The wider pass runs only over rows the first tier did not pair off, the same
 * way transferSweep's split-line pass runs over what its pair pass left. So
 * every pair the sweep offered before this tier existed is exactly the pair it
 * offers now, and no row is argued about twice in one run.
 */
export function findDuplicateCandidates(
  transactions: Transaction[],
  options: { windowDays: number }
): DuplicateCandidate[] {
  const thresholds: DuplicateThresholds = {
    dateThreshold: options.windowDays,
    amountThreshold: AMOUNT_THRESHOLD,
    similarityThreshold: SIMILARITY_THRESHOLD,
  };

  const byAccount = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.archived === true) continue;
    const rows = byAccount.get(transaction.accountId);
    if (rows) rows.push(transaction);
    else byAccount.set(transaction.accountId, [transaction]);
  }

  const candidates: DuplicateCandidate[] = [];
  for (const rows of byAccount.values()) {
    if (rows.length < 2) continue;

    const paired = new Set<string>();
    for (const group of findDuplicateGroups(rows, thresholds)) {
      for (const other of group.potential) {
        // The amount gate comes FIRST — before date, description or score. Two
        // rows that are not the same money are not the same payment, however
        // alike they read.
        if (!amountsMatch(group.original, other)) continue;
        paired.add(group.original.id);
        paired.add(other.id);
        candidates.push(candidateOf(group.original, other, 'description-agrees', thresholds));
      }
    }

    const leftOver = paired.size > 0 ? rows.filter(row => !paired.has(row.id)) : rows;
    if (leftOver.length > 1) {
      candidates.push(...pairOnAmountAndDate(leftOver, thresholds));
    }
  }
  return candidates;
}

/**
 * Every candidate that is part of the SAME repeated payment as `pair` — the
 * transitive closure over shared rows among the candidates given (pass the
 * LIVE list, after dismissal filtering, so refusals already honoured are not
 * dragged back in).
 *
 * Why this exists (owner, 29 Aug): four identical rows — four real coffee
 * taps on holiday — produce several overlapping pairs, and each pair is its
 * own line in the sweep. Refusing one pair as "not a duplicate — leave both"
 * and being offered the next pair OF THE SAME ROWS is the system re-litigating
 * a judgment it was just given. The unit of that judgment is the cluster:
 * pairs chained together by the rows they share. Pairs that share no row with
 * the refused one — a different repeated payment, even at the same amount —
 * are a genuinely separate question and are NOT in the closure.
 *
 * The given pair is always in its own cluster, listed first.
 */
export function candidatesSharingRows(
  candidates: readonly DuplicateCandidate[],
  pair: DuplicateCandidate
): DuplicateCandidate[] {
  const inCluster = new Set<string>([pair.a.id, pair.b.id]);
  const cluster: DuplicateCandidate[] = [pair];
  const remaining = candidates.filter(c => c !== pair);

  // Fixed point: each pass adopts candidates touching the cluster, whose rows
  // then extend it. Terminates because `remaining` only ever shrinks.
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const candidate = remaining[i];
      if (inCluster.has(candidate.a.id) || inCluster.has(candidate.b.id)) {
        inCluster.add(candidate.a.id);
        inCluster.add(candidate.b.id);
        cluster.push(candidate);
        remaining.splice(i, 1);
        grew = true;
      }
    }
  }
  return cluster;
}
