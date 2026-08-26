/**
 * Provider transaction-id churn: the same real-world transaction re-issued
 * under a NEW external id between two syncs.
 *
 * Observed live in Aug 2026: a cheque deposited via a UK bank's mobile app
 * arrived in the morning sync under one TrueLayer id and in the evening sync
 * under a different one — same account, same date, same amount, same
 * description. Deduplication keys on the external id, so the second sync
 * inserted a duplicate. TrueLayer's `normalised_provider_transaction_id`
 * exists precisely to be stable across this transition, but not every bank
 * reliably honours it for cheque deposits.
 *
 * The repair: a candidate whose id is unknown is only a NEW transaction if
 * the ledger has no matching row whose own id has VANISHED from the feed.
 * The vanished id is the load-bearing condition — two genuinely identical
 * transactions (two £50 cheques the same day) both keep their ids in the
 * feed, so neither existing row is adoptable and the second one inserts as
 * it should. Only when the provider stopped sending an id AND sent a
 * look-alike under a new one do we treat it as the same transaction and
 * repoint the existing row rather than insert.
 *
 * Matching is same account + same date + same amount, deliberately WITHOUT
 * the description: banks routinely rewrite descriptions on settlement, and
 * the vanished-id condition already carries the disambiguation weight. The
 * date is NOT widened (settlement can shift a timestamp a day) — that class
 * is left un-repaired rather than risk adopting a neighbour's transaction.
 */

export interface ChurnCandidate {
  external_transaction_id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  /** App-signed, 2dp */
  amount: number;
}

export interface ExistingBankRow {
  id: string;
  external_transaction_id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
}

export interface ChurnAdoption<C extends ChurnCandidate> {
  /** The ledger row that keeps living under the new id. */
  existingRowId: string;
  /** The id the provider stopped sending. */
  previousExternalId: string;
  /** The feed row whose id the existing row adopts; it is NOT inserted. */
  candidate: C;
}

export interface ChurnResolution<C extends ChurnCandidate> {
  adoptions: ChurnAdoption<C>[];
  /** Candidates that are genuinely new and should insert. */
  inserts: C[];
}

const matchKey = (row: { account_id: string; date: string; amount: number }): string =>
  // toFixed(2) so 88.1 and 88.10 key identically — amounts are already 2dp
  // by the pipeline contract, this only guards representation.
  `${row.account_id}|${row.date}|${row.amount.toFixed(2)}`;

/**
 * Decide, for each unknown-id candidate, whether it is a re-issued id for an
 * existing row (adopt) or a genuinely new transaction (insert).
 *
 * @param candidates rows the feed carries whose external ids the ledger does
 *   not know (the exact-id dedup has already run).
 * @param existingRows bank-imported ledger rows inside the sync's date window
 *   for the same connection.
 * @param fetchedExternalIds every external id the provider sent THIS sync —
 *   the full feed, not just the unknown ones.
 */
export function resolveIdChurn<C extends ChurnCandidate>(
  candidates: readonly C[],
  existingRows: readonly ExistingBankRow[],
  fetchedExternalIds: ReadonlySet<string>
): ChurnResolution<C> {
  // Only rows whose id the provider no longer sends are adoptable, and each
  // at most once — a second look-alike candidate is a genuinely new
  // transaction (one old row cannot be two cheques).
  const adoptable = new Map<string, ExistingBankRow[]>();
  for (const row of existingRows) {
    if (fetchedExternalIds.has(row.external_transaction_id)) {
      continue;
    }
    const key = matchKey(row);
    const bucket = adoptable.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      adoptable.set(key, [row]);
    }
  }

  const adoptions: ChurnAdoption<C>[] = [];
  const inserts: C[] = [];
  for (const candidate of candidates) {
    const bucket = adoptable.get(matchKey(candidate));
    const row = bucket?.shift();
    if (row) {
      adoptions.push({
        existingRowId: row.id,
        previousExternalId: row.external_transaction_id,
        candidate
      });
    } else {
      inserts.push(candidate);
    }
  }

  return { adoptions, inserts };
}
