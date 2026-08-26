import { describe, it, expect } from 'vitest';
import { resolveIdChurn, type ExistingBankRow } from '../idChurn';

// Every figure in this file is invented. The SHAPE of the first case is the
// real Aug 2026 incident (a cheque deposit re-issued under a new TrueLayer
// id between a morning and an evening sync); the amounts are not.

const candidate = (over: Partial<Parameters<typeof resolveIdChurn>[0][number]> = {}) => ({
  external_transaction_id: 'txn-new',
  account_id: 'acct-1',
  date: '2026-08-25',
  amount: 42,
  ...over
});

const existing = (over: Partial<ExistingBankRow> = {}): ExistingBankRow => ({
  id: 'row-1',
  external_transaction_id: 'txn-old',
  account_id: 'acct-1',
  date: '2026-08-25',
  amount: 42,
  ...over
});

describe('resolveIdChurn — the same transaction under a new id', () => {
  it('adopts when the old id vanished and account/date/amount agree — the churned cheque', () => {
    const { adoptions, inserts } = resolveIdChurn(
      [candidate()],
      [existing()],
      new Set(['txn-new']) // the feed no longer carries txn-old
    );

    expect(inserts).toEqual([]);
    expect(adoptions).toEqual([
      { existingRowId: 'row-1', previousExternalId: 'txn-old', candidate: candidate() }
    ]);
  });

  it('does NOT adopt while the old id is still in the feed — two real identical cheques', () => {
    // Both ids present means both transactions exist at the bank. The second
    // one is genuinely new money and MUST insert; merging it would lose a
    // transaction.
    const { adoptions, inserts } = resolveIdChurn(
      [candidate()],
      [existing()],
      new Set(['txn-new', 'txn-old'])
    );

    expect(adoptions).toEqual([]);
    expect(inserts).toEqual([candidate()]);
  });

  it('inserts when any of account, date or amount differs', () => {
    const vanished = new Set(['txn-new']);
    for (const near of [
      existing({ account_id: 'acct-2' }),
      existing({ date: '2026-08-24' }), // settlement date shift: deliberately NOT repaired
      existing({ amount: 42.01 })
    ]) {
      const { adoptions, inserts } = resolveIdChurn([candidate()], [near], vanished);
      expect(adoptions).toEqual([]);
      expect(inserts).toEqual([candidate()]);
    }
  });

  it('consumes a vanished row at most once — one old row cannot be two cheques', () => {
    const first = candidate({ external_transaction_id: 'txn-new-1' });
    const second = candidate({ external_transaction_id: 'txn-new-2' });

    const { adoptions, inserts } = resolveIdChurn(
      [first, second],
      [existing()],
      new Set(['txn-new-1', 'txn-new-2'])
    );

    expect(adoptions.map((a) => a.candidate.external_transaction_id)).toEqual(['txn-new-1']);
    expect(inserts).toEqual([second]);
  });

  it('pairs two vanished rows with two candidates', () => {
    const rows = [existing(), existing({ id: 'row-2', external_transaction_id: 'txn-old-2' })];
    const cands = [
      candidate({ external_transaction_id: 'txn-new-1' }),
      candidate({ external_transaction_id: 'txn-new-2' })
    ];

    const { adoptions, inserts } = resolveIdChurn(cands, rows, new Set(['txn-new-1', 'txn-new-2']));

    expect(inserts).toEqual([]);
    expect(adoptions.map((a) => a.previousExternalId).sort()).toEqual(['txn-old', 'txn-old-2']);
  });

  it('keys amounts by value, not representation', () => {
    const { adoptions } = resolveIdChurn(
      [candidate({ amount: 42.1 })],
      [existing({ amount: 42.10 })],
      new Set(['txn-new'])
    );
    expect(adoptions).toHaveLength(1);
  });

  it('is a no-op on empty inputs', () => {
    expect(resolveIdChurn([], [], new Set())).toEqual({ adoptions: [], inserts: [] });
    expect(resolveIdChurn([candidate()], [], new Set(['txn-new']))).toEqual({
      adoptions: [],
      inserts: [candidate()]
    });
  });
});
