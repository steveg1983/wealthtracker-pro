/**
 * Pure account-matching logic for reconnect-safe re-adoption.
 *
 * Extracted from the sync-accounts handler so the decision can be unit-tested
 * (api/ handlers are excluded from the vitest run). The handler does the IO
 * (queries the user's accounts and their links) and delegates the decision
 * here.
 *
 * Background: when a bank connection is disconnected and re-created, the
 * linked_accounts mapping is cascade-deleted and TrueLayer reissues the
 * account_id, so neither the per-connection link nor the external id can locate
 * the user's existing account — the sync would then auto-create a DUPLICATE.
 * The provider-STABLE identifier (sort code + account number) survives a
 * reconnect, so it is the key used to re-adopt the existing account.
 */

/** Digits-only, so "40-18-41" and "401841" compare equal. */
export const digitsOnly = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '');

export interface AdoptionCandidate {
  id: string;
  accountNumber: string | null;
  sortCode: string | null;
}

/**
 * Choose the existing account to re-adopt for an incoming bank account, or null.
 *
 * Adopts ONLY a single, unambiguous, currently-UNLINKED candidate, so it never:
 *  - adopts when the bank gave no stable identifier (returns null),
 *  - merges two real accounts that share an identifier (ambiguous → null),
 *  - hijacks an account already linked to a live connection (linked → null).
 *
 * @param candidates       the user's own active accounts that have an account_number
 * @param linkedAccountIds account ids currently linked to ANY connection
 */
export const selectAdoptableAccountId = (
  candidates: readonly AdoptionCandidate[],
  linkedAccountIds: ReadonlySet<string>,
  wantAccountNumber: string | null | undefined,
  wantSortCode: string | null | undefined
): string | null => {
  const wantNumber = digitsOnly(wantAccountNumber);
  const wantSort = digitsOnly(wantSortCode);
  if (!wantNumber || !wantSort) {
    return null; // bank gave no stable identifier — cannot safely re-adopt
  }

  const matches = candidates.filter(
    (c) => digitsOnly(c.accountNumber) === wantNumber && digitsOnly(c.sortCode) === wantSort
  );
  if (matches.length !== 1) {
    return null; // zero (genuinely new account) or ambiguous (>1) → do not adopt
  }
  return linkedAccountIds.has(matches[0].id) ? null : matches[0].id;
};
