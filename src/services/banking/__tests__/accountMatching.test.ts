import { describe, it, expect } from 'vitest';
import { digitsOnly, selectAdoptableAccountId, type AdoptionCandidate } from '../accountMatching';

const acct = (id: string, accountNumber: string | null, sortCode: string | null): AdoptionCandidate => ({
  id,
  accountNumber,
  sortCode
});

describe('digitsOnly', () => {
  it('strips all non-digits so formats compare equal', () => {
    expect(digitsOnly('40-18-41')).toBe('401841');
    expect(digitsOnly('401841')).toBe('401841');
    expect(digitsOnly('82195747')).toBe('82195747');
  });
  it('treats null/undefined/empty as empty string', () => {
    expect(digitsOnly(null)).toBe('');
    expect(digitsOnly(undefined)).toBe('');
    expect(digitsOnly('')).toBe('');
  });
});

describe('selectAdoptableAccountId', () => {
  const A1 = acct('a1', '82195747', '40-18-41'); // stored with dashes (the incident account)

  it('re-adopts the single unlinked match across sort-code format variance', () => {
    // Incoming from TrueLayer with no dashes — must still match the dashed stored value.
    const id = selectAdoptableAccountId([A1], new Set(), '82195747', '401841');
    expect(id).toBe('a1');
  });

  it('returns null when the bank supplies no stable identifier (regression: avoids duplicate-less adoption)', () => {
    expect(selectAdoptableAccountId([A1], new Set(), null, null)).toBeNull();
    expect(selectAdoptableAccountId([A1], new Set(), '82195747', null)).toBeNull();
    expect(selectAdoptableAccountId([A1], new Set(), null, '401841')).toBeNull();
  });

  it('returns null when the existing account has no stored identifiers to match (documents the duplicate-creating gap)', () => {
    // An account whose account_number/sort_code were never written cannot be
    // re-adopted — the handler falls through to creating a new account. This is
    // the eventual-consistency window closed by writing identifiers at link/sync.
    const noIds = acct('a1', null, null);
    expect(selectAdoptableAccountId([noIds], new Set(), '82195747', '401841')).toBeNull();
  });

  it('returns null on ambiguity (two real accounts share the identifier)', () => {
    const dup = acct('a2', '82195747', '40-18-41');
    expect(selectAdoptableAccountId([A1, dup], new Set(), '82195747', '401841')).toBeNull();
  });

  it('refuses to hijack an account already linked to a live connection', () => {
    expect(selectAdoptableAccountId([A1], new Set(['a1']), '82195747', '401841')).toBeNull();
  });

  it('does not match on account number alone or sort code alone', () => {
    const sameNumberDiffSort = acct('a1', '82195747', '99-99-99');
    expect(selectAdoptableAccountId([sameNumberDiffSort], new Set(), '82195747', '401841')).toBeNull();
    const sameSortDiffNumber = acct('a1', '00000000', '40-18-41');
    expect(selectAdoptableAccountId([sameSortDiffNumber], new Set(), '82195747', '401841')).toBeNull();
  });

  it('returns null when there are no candidates at all (genuinely new account)', () => {
    expect(selectAdoptableAccountId([], new Set(), '82195747', '401841')).toBeNull();
  });
});
