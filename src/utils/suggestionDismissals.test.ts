/**
 * The dismissal key — the one thing that has to be right for "leave it" to
 * stick. A sweep re-runs from scratch every time it opens and is free to reach
 * the same two rows from either end, so the key has to be a fact about the rows
 * and not about the order they were found in.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalSubjectKey,
  dismissedKeys,
  duplicateDismissalKey,
  duplicateDismissalSubjectIds,
  legDismissalKey,
  legDismissalSubjectIds,
  pairDismissalKey,
  pairDismissalSubjectIds,
  payeeLineDismissalKey,
  payeeMerchantDismissalKey,
  readPayeeDismissalKey,
  strandedDismissalKey,
  strandedDismissalSubjectIds,
} from './suggestionDismissals';
import type { SuggestionDismissal, Transaction, TransactionSplit } from '../types';
import type { StrandedFinding } from './strandedTransfers';
import type { SplitLegSuggestion, TransferPairSuggestion } from './transferSweep';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -200,
  description: 'Transfer (Online)',
  category: '',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const OUT = txn({ id: 'b-out', amount: -200 });
const IN = txn({ id: 'a-in', amount: 200, accountId: 'acc-joint', type: 'income' });

const pair = (outgoing: Transaction, incoming: Transaction): TransferPairSuggestion => ({
  outgoing, incoming, daysApart: 0, descriptionScore: 100, ambiguous: false,
});

describe('canonicalSubjectKey', () => {
  it('does not depend on the order the ids arrive in', () => {
    expect(canonicalSubjectKey(['b', 'a'])).toBe(canonicalSubjectKey(['a', 'b']));
    expect(canonicalSubjectKey(['c', 'a', 'b'])).toBe(canonicalSubjectKey(['a', 'b', 'c']));
  });

  it('leaves the caller\'s array alone', () => {
    const ids = ['b', 'a'];
    canonicalSubjectKey(ids);
    expect(ids).toEqual(['b', 'a']);
  });

  it('is stable text, so a stored key still matches after a reload', () => {
    expect(canonicalSubjectKey(['b', 'a'])).toBe('a|b');
  });

  it('tells different sets of rows apart', () => {
    expect(canonicalSubjectKey(['a', 'b'])).not.toBe(canonicalSubjectKey(['a', 'c']));
    expect(canonicalSubjectKey(['a', 'b'])).not.toBe(canonicalSubjectKey(['a', 'b', 'c']));
  });
});

describe('pairDismissalKey', () => {
  it('is the same whichever leg the sweep calls the outgoing one', () => {
    // The sweep decides direction by sign, but a future scan order (or a
    // corrected sign) must not resurrect a refused pairing.
    expect(pairDismissalKey(pair(OUT, IN))).toBe(pairDismissalKey(pair(IN, OUT)));
  });

  it('keeps the rows in role order for the record, not sorted', () => {
    expect(pairDismissalSubjectIds(pair(OUT, IN))).toEqual(['b-out', 'a-in']);
  });
});

describe('legDismissalKey', () => {
  const leg: SplitLegSuggestion = {
    split: { id: 'line-1', transactionId: 'parent-1', category: 'c', amount: 30000, sortOrder: 1 } as TransactionSplit,
    parent: txn({ id: 'parent-1', amount: 35000, type: 'income' }),
    candidate: txn({ id: 'row-over-there', amount: -30000, accountId: 'acc-loan' }),
    daysApart: 0,
    descriptionScore: 100,
    ambiguous: false,
  };

  it('tags the two halves by role, because they come from different tables', () => {
    expect(legDismissalKey(leg)).toBe('split:line-1|txn:row-over-there');
  });

  it('records the TRANSACTIONS it is about — the line id lives in the key', () => {
    expect(legDismissalSubjectIds(leg)).toEqual(['parent-1', 'row-over-there']);
  });
});

describe('strandedDismissalKey', () => {
  const row = txn({ id: 'stranded' });
  const other = txn({ id: 'counterpart', amount: 200, accountId: 'acc-joint' });
  const partner = txn({ id: 'wrong-partner', amount: 200, accountId: 'acc-credit' });

  const claimed: StrandedFinding = {
    kind: 'claimed', row, counterpart: other, currentPartner: partner,
    daysApart: 0, partnerDaysApart: 4, descriptionScore: 100, wonOnDescription: false,
  };
  const categorised: StrandedFinding = {
    kind: 'categorised', row, counterpart: other,
    counterpartCategoryName: 'Dental', daysApart: 0, descriptionScore: 100,
  };

  it('names every row that makes the case, order-independently', () => {
    const swapped: StrandedFinding = {
      ...claimed, row: partner, currentPartner: row,
    };
    expect(strandedDismissalKey(swapped)).toBe(strandedDismissalKey(claimed));
  });

  it('does not let one kind of finding suppress another about the same rows', () => {
    // Refusing "archive this copy" must not silently hide "nothing anywhere is
    // the other side of this" — different offers, different consequences.
    expect(strandedDismissalKey(categorised)).not.toBe(
      strandedDismissalKey({ kind: 'duplicate', row, duplicateOf: other, descriptionScore: 100 })
    );
  });

  it('records a one-sided finding against its single row', () => {
    expect(strandedDismissalSubjectIds({ kind: 'one-sided', row })).toEqual(['stranded']);
    expect(strandedDismissalKey({ kind: 'one-sided', row })).toBe('one-sided|stranded');
  });
});

describe('duplicateDismissalKey', () => {
  const first = txn({ id: 'copy-b' });
  const second = txn({ id: 'copy-a' });

  it('is the same whichever copy the scan seeded the group with', () => {
    expect(duplicateDismissalKey(first, second)).toBe(duplicateDismissalKey(second, first));
  });

  it('records both rows, so deleting either one cleans the dismissal up', () => {
    expect(duplicateDismissalSubjectIds(first, second)).toEqual(['copy-b', 'copy-a']);
  });
});

/**
 * Payee cleanup's keys are the only ones made of TEXT rather than row ids, and
 * they live in the same column the restore path rewrites ids in. Two properties
 * keep that safe, and both are pinned here: every segment carries a role prefix
 * (so nothing is ever taken for a bare id or re-sorted), and the value behind
 * that prefix always contains a further ':' (so it can never be uuid-shaped, and
 * can never equal an id in a backup file). backupService.test.ts proves the
 * consequence end to end.
 */
describe('payee cleanup keys', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** What remapDismissalKey sees: the segments, and the value in each. */
  const segmentsOf = (key: string): Array<{ prefix: string; value: string }> =>
    key.split('|').map((segment) => {
      const colon = segment.indexOf(':');
      return {
        prefix: colon >= 0 ? segment.slice(0, colon + 1) : '',
        value: colon >= 0 ? segment.slice(colon + 1) : segment,
      };
    });

  it('tags every segment, so a restore can never take a payee for a row id', () => {
    const keys = [
      payeeMerchantDismissalKey('AMAZON.CO.UK'),
      payeeLineDismissalKey('AMAZON.CO.UK', 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK'),
    ];
    for (const key of keys) {
      for (const segment of segmentsOf(key)) {
        expect(segment.prefix).toBe('payee-cleanup:');
        // A colon inside the value is what makes it impossible for the value to
        // be uuid-shaped — a uuid has no colon in it anywhere.
        expect(segment.value).toContain(':');
        expect(UUID.test(segment.value)).toBe(false);
      }
    }
  });

  it('survives a payee whose text is itself uuid-shaped', () => {
    // A bank reference can be anything. If the value could be uuid-shaped, a
    // restore would rewrite it and every refusal the user made would come back.
    const key = payeeLineDismissalKey('REF', '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    for (const segment of segmentsOf(key)) {
      expect(UUID.test(segment.value)).toBe(false);
    }
    expect(readPayeeDismissalKey(key)?.payee).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('escapes the separator, so a payee holding "|" cannot forge a segment', () => {
    const key = payeeLineDismissalKey('CARD PAYMENT', 'CARD PAYMENT|REF 4471982');
    expect(key.split('|')).toHaveLength(2);
    expect(readPayeeDismissalKey(key)).toEqual({
      merchant: 'CARD PAYMENT', payee: 'CARD PAYMENT|REF 4471982',
    });
  });

  it('reads back the exact text it was given, spaces, case and punctuation', () => {
    const payee = "Ol' Bakery & Co. #12 (café)";
    expect(readPayeeDismissalKey(payeeLineDismissalKey('OL BAKERY', payee))).toEqual({
      merchant: 'OL BAKERY', payee,
    });
    expect(readPayeeDismissalKey(payeeMerchantDismissalKey('DEBIT INTEREST TO'))).toEqual({
      merchant: 'DEBIT INTEREST TO', payee: null,
    });
  });

  it('tells a whole merchant from one of its payees', () => {
    // Refusing the grouping and refusing one line are different decisions with
    // different consequences; one must never be stored as the other.
    expect(payeeMerchantDismissalKey('TESCO STORES')).not.toBe(
      payeeLineDismissalKey('TESCO STORES', 'TESCO STORES')
    );
    expect(payeeLineDismissalKey('TESCO STORES', 'TESCO STORES 3456')).not.toBe(
      payeeLineDismissalKey('TESCO STORES', 'TESCO STORES 9821')
    );
  });

  it('recognises nothing but its own keys', () => {
    // Fed a transfer sweep's key it must say "not mine" rather than describe
    // two transaction ids as a shop.
    expect(readPayeeDismissalKey('a-id|b-id')).toBeNull();
    expect(readPayeeDismissalKey('split:line-1|txn:row')).toBeNull();
    expect(readPayeeDismissalKey('payee-cleanup:merchant:A|payee-cleanup:merchant:B')).toBeNull();
    expect(readPayeeDismissalKey('')).toBeNull();
  });
});

describe('dismissedKeys', () => {
  const dismissal = (
    kind: SuggestionDismissal['kind'], subjectKey: string
  ): SuggestionDismissal => ({
    id: `${kind}-${subjectKey}`, kind, subjectKey, subjectIds: [], dismissedAt: new Date(),
  });

  it('narrows to one kind, so the four kinds cannot cross-filter', () => {
    const stored = [
      dismissal('transfer-pair', 'a|b'),
      dismissal('duplicate', 'a|b'),
      dismissal('stranded', 'one-sided|c'),
    ];
    expect(dismissedKeys(stored, 'transfer-pair')).toEqual(new Set(['a|b']));
    expect(dismissedKeys(stored, 'duplicate')).toEqual(new Set(['a|b']));
    expect(dismissedKeys(stored, 'transfer-leg')).toEqual(new Set());
  });
});
