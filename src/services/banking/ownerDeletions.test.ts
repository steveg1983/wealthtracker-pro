import { describe, it, expect } from 'vitest';
import { partitionOfferedRows } from './ownerDeletions';

const row = (id: string) => ({ external_transaction_id: id, amount: 1 });

describe('what the bank offered, split against what the ledger knows', () => {
  it('does not re-import a row the owner deleted — the British Airways case', () => {
    // The £8,321.54 card payment: the bank still reports it every sync, and
    // the ledger no longer holds it, because he threw it away on purpose.
    const offered = [row('ba-payment-received')];

    const { alreadyPresent, deletedByOwner, unseen } = partitionOfferedRows(
      offered,
      new Set<string>(),                    // not in the ledger — he deleted it
      new Set(['ba-payment-received'])      // …and that deletion was recorded
    );

    expect(unseen).toHaveLength(0);         // nothing to insert
    expect(alreadyPresent).toHaveLength(0); // and it is not a "duplicate" either
    expect(deletedByOwner.map((r) => r.external_transaction_id)).toEqual(['ba-payment-received']);
  });

  it('WOULD have re-imported it before the tombstone existed', () => {
    // The same row with no deletion recorded is exactly the old behaviour, and
    // it is the reason the card was credited twice. Kept as a spec so the
    // difference the tombstone makes is visible rather than asserted.
    const { unseen } = partitionOfferedRows([row('ba-payment-received')], new Set(), new Set());

    expect(unseen).toHaveLength(1);
  });

  it('still calls a row that is present a duplicate, even if a stale tombstone names it', () => {
    // Deleted, re-imported before this shipped, sitting in the ledger now. The
    // row in front of us is the truth; the tombstone is history.
    const { alreadyPresent, deletedByOwner } = partitionOfferedRows(
      [row('came-back-once')],
      new Set(['came-back-once']),
      new Set(['came-back-once'])
    );

    expect(alreadyPresent).toHaveLength(1);
    expect(deletedByOwner).toHaveLength(0);
  });

  it('leaves genuinely new rows alone', () => {
    const { unseen, alreadyPresent, deletedByOwner } = partitionOfferedRows(
      [row('a'), row('b')],
      new Set(['a']),
      new Set(['c'])
    );

    expect(unseen.map((r) => r.external_transaction_id)).toEqual(['b']);
    expect(alreadyPresent.map((r) => r.external_transaction_id)).toEqual(['a']);
    expect(deletedByOwner).toHaveLength(0);
  });

  it('accounts for every row exactly once — the arithmetic the sync report rests on', () => {
    // The sync tells the owner "your bank offered N, I stored X, skipped Y and
    // Z". If these three ever fail to sum to N, that report is a lie, so the
    // invariant is pinned rather than trusted.
    const offered = ['p', 'q', 'r', 's', 't'].map(row);
    const { alreadyPresent, deletedByOwner, unseen } = partitionOfferedRows(
      offered,
      new Set(['p', 'q']),
      new Set(['r'])
    );

    expect(alreadyPresent.length + deletedByOwner.length + unseen.length).toBe(offered.length);
    const seen = [...alreadyPresent, ...deletedByOwner, ...unseen].map((r) => r.external_transaction_id);
    expect(new Set(seen).size).toBe(offered.length);
  });

  it('handles a sync that offered nothing', () => {
    const { alreadyPresent, deletedByOwner, unseen } = partitionOfferedRows([], new Set(['x']), new Set(['y']));

    expect([alreadyPresent, deletedByOwner, unseen].every((list) => list.length === 0)).toBe(true);
  });
});
