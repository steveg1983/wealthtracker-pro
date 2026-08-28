import { describe, it, expect } from 'vitest';
import { resolveTransferAdoption, type ManualTransferLeg } from './transferAdoption';

// Every figure invented. The SHAPE is the owner's three cards (28 Aug): a
// hand-made transfer leg ("VIRGIN MONEY") and the feed's payment row
// ("PAYMENT DD - THANK YOU") — one payment, two spellings, matched by
// account + amount + a three-day window and never by the words.

const candidate = (over: Partial<{ external_transaction_id: string; account_id: string; date: string; amount: number }> = {}) => ({
  external_transaction_id: 'ext-1',
  account_id: 'card-1',
  date: '2026-08-02',
  amount: 25,
  ...over
});

const leg = (over: Partial<ManualTransferLeg> = {}): ManualTransferLeg => ({
  id: 'leg-1',
  account_id: 'card-1',
  date: '2026-08-03',
  amount: 25,
  ...over
});

describe('resolveTransferAdoption', () => {
  it('adopts the one matching leg — same account, same amount, within the window', () => {
    const out = resolveTransferAdoption([candidate()], [leg()]);

    expect(out.adoptions).toEqual([{ existingRowId: 'leg-1', candidate: candidate() }]);
    expect(out.inserts).toEqual([]);
  });

  it('inserts when no leg matches — a genuinely new payment', () => {
    const out = resolveTransferAdoption([candidate({ amount: 100 })], [leg()]);

    expect(out.adoptions).toEqual([]);
    expect(out.inserts).toHaveLength(1);
  });

  it('inserts on ambiguity — two matching legs are never guessed between', () => {
    const out = resolveTransferAdoption(
      [candidate()],
      [leg(), leg({ id: 'leg-2', date: '2026-08-01' })]
    );

    expect(out.adoptions).toEqual([]);
    expect(out.inserts).toHaveLength(1);
  });

  it('lets a leg adopt at most one candidate — the second identical payment inserts', () => {
    const out = resolveTransferAdoption(
      [candidate(), candidate({ external_transaction_id: 'ext-2', date: '2026-08-04' })],
      [leg()]
    );

    expect(out.adoptions).toHaveLength(1);
    expect(out.inserts).toHaveLength(1);
  });

  it('respects the account boundary and the three-day window', () => {
    const wrongAccount = resolveTransferAdoption([candidate()], [leg({ account_id: 'card-2' })]);
    expect(wrongAccount.adoptions).toEqual([]);

    const tooFar = resolveTransferAdoption([candidate()], [leg({ date: '2026-08-08' })]);
    expect(tooFar.adoptions).toEqual([]);

    const edge = resolveTransferAdoption([candidate()], [leg({ date: '2026-08-05' })]);
    expect(edge.adoptions).toHaveLength(1);
  });
});
