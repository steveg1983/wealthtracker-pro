/**
 * Feed adoption of rows the owner IMPORTED before connecting the feed: the
 * statement row a CSV brought in and the same payment arriving by feed are
 * one transaction.
 *
 * Observed live (owner, 30 Aug 2026, his partner's current account): twelve
 * months imported by CSV, then the bank feed connected over the same window
 * — "plenty of instances where it now looks like I have 2 entries". Feed
 * deduplication keys on external ids; a CSV row has none; so every
 * overlapping payment landed twice. resolveTransferAdoption closed exactly
 * this hole for hand-made TRANSFER legs; this module is the same shape for
 * everything else the owner had already recorded.
 *
 * THE ADOPTION, not a skip: the imported row is stamped with the feed's
 * external id (and connection), so every future sync recognises it in the
 * exact-id pass. The owner's categorisation, description and reconciliation
 * survive — the feed contributes only its identity.
 *
 * MATCHING differs from the transfer rule in two deliberate ways:
 *
 *  - The window is ±1 day, not ±3. A CSV bank export carries the bank's own
 *    dates, so the two records usually agree to the day; the transfer rule's
 *    wider window exists because a person dates a payment by hand.
 *
 *  - SAME-DAY IDENTICALS PAIR BY COUNT. The transfer resolver refuses any
 *    ambiguity, which is right when rows can differ in ways that matter —
 *    but three £0.99 App Store bills on one day (the owner's own register)
 *    are INDISTINGUISHABLE: no observable fact separates candidate from
 *    row, so refusing to pair them just doubles all three. k candidates in
 *    a same-day, same-account, same-pence group adopt k rows; any excess
 *    candidates insert, visible and deletable. Across DIFFERENT days the
 *    old caution returns: a ±1-day match adopts only when it is one-to-one,
 *    because there a wrong pairing would move a real payment's identity to
 *    the wrong day.
 */

export interface ImportedRowCandidate {
  external_transaction_id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  /** App-signed, 2dp */
  amount: number;
}

export interface ImportedRow {
  id: string;
  account_id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
}

export interface ImportedRowAdoption<C extends ImportedRowCandidate> {
  existingRowId: string;
  candidate: C;
}

export interface ImportedRowAdoptionResolution<C extends ImportedRowCandidate> {
  inserts: C[];
  adoptions: Array<ImportedRowAdoption<C>>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const pence = (amount: number): number => Math.round(amount * 100);

const sameDayKey = (accountId: string, date: string, amount: number): string =>
  `${accountId}|${date}|${pence(amount)}`;

export function resolveImportedRowAdoption<C extends ImportedRowCandidate>(
  candidates: readonly C[],
  importedRows: readonly ImportedRow[]
): ImportedRowAdoptionResolution<C> {
  const inserts: C[] = [];
  const adoptions: Array<ImportedRowAdoption<C>> = [];
  const takenRowIds = new Set<string>();

  // ── Phase 1: same-day groups pair by count ─────────────────────────────
  const rowsByKey = new Map<string, ImportedRow[]>();
  for (const row of importedRows) {
    const key = sameDayKey(row.account_id, row.date, row.amount);
    (rowsByKey.get(key) ?? rowsByKey.set(key, []).get(key)!).push(row);
  }

  const undecided: C[] = [];
  for (const candidate of candidates) {
    const key = sameDayKey(candidate.account_id, candidate.date, candidate.amount);
    const pool = rowsByKey.get(key) ?? [];
    const available = pool.find((row) => !takenRowIds.has(row.id));
    if (available !== undefined) {
      takenRowIds.add(available.id);
      adoptions.push({ existingRowId: available.id, candidate });
    } else {
      undecided.push(candidate);
    }
  }

  // ── Phase 2: ±1 day, mutually unique — a cross-day pairing must be the
  //    only reading THERE IS, from both ends. One candidate with one near
  //    row is not enough if that row has a second suitor a day the other
  //    side: first-come would hand the identity to whichever candidate the
  //    feed happened to list first. Both refuse instead, and both insert —
  //    visible, deletable, the smaller wrong. ─────────────────────────────
  const nearRowsOf = (candidate: C): ImportedRow[] =>
    importedRows.filter((candidateRow) => {
      if (takenRowIds.has(candidateRow.id)) return false;
      if (candidateRow.account_id !== candidate.account_id) return false;
      if (pence(candidateRow.amount) !== pence(candidate.amount)) return false;
      const diff = Math.abs(new Date(candidate.date).getTime() - new Date(candidateRow.date).getTime());
      return diff > 0 && diff <= DAY_MS;
    });
  const nearMap = new Map(undecided.map((candidate) => [candidate, nearRowsOf(candidate)]));
  for (const candidate of undecided) {
    const near = nearMap.get(candidate) ?? [];
    const rivals = near.length === 1
      ? undecided.filter((other) => other !== candidate && (nearMap.get(other) ?? []).some((r) => r.id === near[0].id))
      : [];
    if (near.length !== 1 || rivals.length > 0) {
      inserts.push(candidate);
      continue;
    }
    takenRowIds.add(near[0].id);
    adoptions.push({ existingRowId: near[0].id, candidate });
  }

  return { inserts, adoptions };
}
