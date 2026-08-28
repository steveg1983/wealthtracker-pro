/**
 * Feed adoption of HAND-MADE transfer legs: the statement's payment row and
 * the transfer the owner already recorded are one payment.
 *
 * Observed live on all three of the owner's cards (28 Aug 2026): he pays a
 * card from his current account, records the transfer, and the counterpart
 * lands on the card as (say) "VIRGIN MONEY". The card's FEED then delivers
 * the same payment as "PAYMENT DD - THANK YOU" under a bank id. Feed
 * deduplication keys on external ids, a manual leg has none, so the payment
 * arrived twice — and would again on every card, forever.
 *
 * THE ADOPTION, not a skip: the matching manual leg is stamped with the
 * candidate's external id (and the connection), so every FUTURE sync
 * recognises it in the exact-id pass and never asks again. Nothing about
 * the money changes — categorisation, reconciliation and the transfer link
 * all survive — which is what makes this the same safe shape as
 * resolveIdChurn's repair.
 *
 * MATCHING is same account + amount within a penny + date within three
 * days, the same figures the CSV wizard's transfer rule uses, and
 * deliberately WITHOUT the description: the whole problem is that the two
 * sides name one payment differently. The DATE WINDOW is wider than
 * idChurn's same-day rule because a manual leg is dated by a person (the
 * day they made the payment) and the feed row by the card's posting date.
 *
 * AMBIGUITY INSERTS. A candidate matching two legs, or two candidates
 * matching one leg, is never guessed at — the extra row imports as it
 * always did, visible and deletable, which is a smaller wrong than silently
 * fusing two different payments.
 */

export interface TransferAdoptionCandidate {
  external_transaction_id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  /** App-signed, 2dp */
  amount: number;
}

export interface ManualTransferLeg {
  id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
}

export interface TransferAdoption<C extends TransferAdoptionCandidate> {
  /** The hand-made leg that becomes the feed's row. */
  existingRowId: string;
  candidate: C;
}

export interface TransferAdoptionResolution<C extends TransferAdoptionCandidate> {
  /** Candidates that remain genuinely new rows. */
  inserts: C[];
  adoptions: Array<TransferAdoption<C>>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 3 * DAY_MS;

const matches = (candidate: TransferAdoptionCandidate, leg: ManualTransferLeg): boolean => {
  if (candidate.account_id !== leg.account_id) return false;
  if (Math.abs(candidate.amount - leg.amount) >= 0.01) return false;
  const dateDiff = Math.abs(new Date(candidate.date).getTime() - new Date(leg.date).getTime());
  return dateDiff <= WINDOW_MS;
};

export function resolveTransferAdoption<C extends TransferAdoptionCandidate>(
  candidates: readonly C[],
  manualTransferLegs: readonly ManualTransferLeg[]
): TransferAdoptionResolution<C> {
  const inserts: C[] = [];
  const adoptions: Array<TransferAdoption<C>> = [];
  const takenLegIds = new Set<string>();

  for (const candidate of candidates) {
    const matching = manualTransferLegs.filter(
      (leg) => !takenLegIds.has(leg.id) && matches(candidate, leg)
    );
    if (matching.length !== 1) {
      // Zero: genuinely new. Two or more: ambiguous — never guess.
      inserts.push(candidate);
      continue;
    }
    // One-to-one, first-come: a leg adopts at most one candidate. A second
    // candidate matching the SAME leg (two identical payments in the window,
    // one recorded by hand) inserts — the smaller wrong, and visible.
    takenLegIds.add(matching[0].id);
    adoptions.push({ existingRowId: matching[0].id, candidate });
  }

  return { inserts, adoptions };
}
