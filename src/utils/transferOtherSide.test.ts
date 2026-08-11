import { describe, it, expect } from 'vitest';
import { describeDeleteStranding, resolveTransferOtherSide } from './transferOtherSide';
import type { Account, Transaction } from '../types';

const account = (id: string, name: string, isActive = true): Account => ({
  id,
  name,
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-06-01'),
  isActive,
});

const leg = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId'>): Transaction => ({
  date: new Date('2026-06-10'),
  description: 'Transfer',
  amount: -500,
  type: 'transfer',
  category: 'tofrom',
  cleared: false,
  ...overrides,
});

const OUT = leg({
  id: 'out',
  accountId: 'acc-a',
  transferAccountId: 'acc-b',
  linkedTransferId: 'in',
});

const IN = leg({
  id: 'in',
  accountId: 'acc-b',
  amount: 500,
  transferAccountId: 'acc-a',
  linkedTransferId: 'out',
});

const OPEN = [account('acc-a', 'Current Account'), account('acc-b', 'Savings')];

describe('resolveTransferOtherSide', () => {
  it('resolves from the counterpart row, in both directions', () => {
    expect(resolveTransferOtherSide(OUT, [OUT, IN], OPEN)).toEqual({
      transactionId: 'in',
      accountId: 'acc-b',
      accountName: 'Savings',
      isOpen: true,
    });
    expect(resolveTransferOtherSide(IN, [OUT, IN], OPEN)).toEqual({
      transactionId: 'out',
      accountId: 'acc-a',
      accountName: 'Current Account',
      isOpen: true,
    });
  });

  it('prefers the counterpart row over a stale denormalised account', () => {
    const stale = { ...OUT, transferAccountId: 'acc-gone' };
    expect(resolveTransferOtherSide(stale, [stale, IN], OPEN)?.accountId).toBe('acc-b');
  });

  it('falls back to transferAccountId when the counterpart is not loaded', () => {
    expect(resolveTransferOtherSide(OUT, [OUT], OPEN)).toEqual({
      transactionId: 'in',
      accountId: 'acc-b',
      accountName: 'Savings',
      isOpen: true,
    });
  });

  it('reports a closed other side without a name — it is not in the open list', () => {
    expect(resolveTransferOtherSide(OUT, [OUT], [account('acc-a', 'Current Account')])).toEqual({
      transactionId: 'in',
      accountId: 'acc-b',
      isOpen: false,
    });
    // Present but flagged inactive counts as closed too.
    expect(
      resolveTransferOtherSide(OUT, [OUT], [OPEN[0], account('acc-b', 'Savings', false)])?.isOpen
    ).toBe(false);
  });

  it('returns null when there is nothing to jump to', () => {
    expect(resolveTransferOtherSide(null, [], OPEN)).toBeNull();
    expect(resolveTransferOtherSide(undefined, [], OPEN)).toBeNull();
    // A transfer with no link
    expect(resolveTransferOtherSide(leg({ id: 'lonely', accountId: 'acc-a' }), [], OPEN)).toBeNull();
    // Linked, but neither source names an account
    const noAccount = leg({ id: 'x', accountId: 'acc-a', linkedTransferId: 'ghost' });
    expect(resolveTransferOtherSide(noAccount, [], OPEN)).toBeNull();
    // Corrupt self-reference: jumping to the register you are already in,
    // at a row that is not there, is worse than not offering the jump.
    const selfRef = leg({ id: 'y', accountId: 'acc-a', linkedTransferId: 'z', transferAccountId: 'acc-a' });
    expect(resolveTransferOtherSide(selfRef, [], OPEN)).toBeNull();
  });
});

describe('describeDeleteStranding', () => {
  it('says nothing for an ordinary transaction', () => {
    // Zero counts render nothing: a plain expense loses nothing but itself, and
    // a warning that fires on every delete is a warning nobody reads.
    const ordinary = leg({
      id: 'shopping',
      accountId: 'acc-a',
      type: 'expense',
      transferAccountId: undefined,
      linkedTransferId: undefined,
    });
    expect(describeDeleteStranding(ordinary, [ordinary], OPEN)).toBeNull();
    expect(describeDeleteStranding(null, [], OPEN)).toBeNull();
  });

  it('names the account the survivor is left in, and what it BECOMES there', () => {
    const stranding = describeDeleteStranding(OUT, [OUT, IN], OPEN);

    expect(stranding).not.toBeNull();
    // The account by NAME: the whole point is that the damage lands somewhere
    // the user is not looking.
    expect(stranding?.message).toContain('Savings');
    // The consequence, not the mechanism: the row survives and still counts.
    expect(stranding?.message).toMatch(/still counted in that account's balance/);
    // …and it stops being a transfer, because a transfer must have another
    // side. The survivor here is the +500 leg, so it lands as a deposit.
    expect(stranding?.message).toMatch(/stops being a transfer/);
    expect(stranding?.message).toMatch(/uncategorised deposit waiting to be filed/);
    // And where to go and finish the job.
    expect(stranding).toMatchObject({ accountId: 'acc-b', transactionId: 'in' });
  });

  it('works from the other leg too — and names what THAT survivor becomes', () => {
    const stranding = describeDeleteStranding(IN, [OUT, IN], OPEN);

    expect(stranding?.message).toContain('Current Account');
    // Deleting the money-IN leg leaves the −500 money-out row, which becomes a
    // payment rather than a deposit. Both directions, because a single word
    // that was right half the time would be worse than no word.
    expect(stranding?.message).toMatch(/uncategorised payment waiting to be filed/);
  });

  it('reads the direction off the survivor, not off the row being deleted', () => {
    // A pair whose legs are BOTH negative should not happen, and imported
    // history has produced it. What matters is that the sentence describes the
    // row the user will actually find, so it is read from that row when it is
    // loaded rather than inferred from this one's sign.
    const oddPartner = { ...IN, amount: -500 };
    expect(describeDeleteStranding(OUT, [OUT, oddPartner], OPEN)?.message)
      .toMatch(/uncategorised payment/);
  });

  it('does not invent a name for an account that is closed', () => {
    const stranding = describeDeleteStranding(OUT, [OUT], [account('acc-a', 'Current Account')]);

    expect(stranding?.message).toContain('in the account it faces');
    expect(stranding?.message).not.toContain('undefined');
    expect(stranding?.accountId).toBe('acc-b');
    expect(stranding?.accountName).toBeUndefined();
  });

  it('says a split LINE is what survives, when that is what survives', () => {
    // The counterpart is one line inside a split. Telling the user to "delete
    // that side too" would be telling them to delete other people's spending:
    // the rest of the split is unrelated, and it stays. Nor is it released —
    // that line is still a real leg of the split it belongs to.
    const facingASplitLine = { ...OUT, linkedTransferSplitId: 'split-line-1' };
    const message = describeDeleteStranding(facingASplitLine, [facingASplitLine, IN], OPEN)?.message;

    expect(message).toContain('a single line inside a split transaction in Savings');
    expect(message).toMatch(/the split itself stays exactly as it is/);
    expect(message).not.toMatch(/Delete that side too/);
    expect(message).not.toMatch(/stops being a transfer/);
  });
});

/**
 * WHICH OTHER HALVES MAY BE DELETED ALONGSIDE THIS ONE.
 *
 * `deletableOtherSide` is the whole of the decision behind the dialog's third
 * button, so the three refusals are stated here rather than in the component:
 * a row nobody can see, a split's line, and a split parent are each a promise
 * this app must not make on the user's behalf.
 */
describe('describeDeleteStranding — deletableOtherSide', () => {
  it('offers the loaded, ordinary counterpart', () => {
    expect(describeDeleteStranding(OUT, [OUT, IN], OPEN)?.deletableOtherSide).toEqual(IN);
  });

  it('refuses a counterpart that is not loaded — usually a closed account', () => {
    // The row may be anything: a split, a reconciled import, a leg of a third
    // transfer. Offering to delete it would be describing contents nobody has.
    const stranding = describeDeleteStranding(OUT, [OUT], OPEN);

    expect(stranding?.transactionId).toBe('in');
    expect(stranding?.deletableOtherSide).toBeNull();
  });

  it('refuses a counterpart that is a split parent', () => {
    // Its lines go with it, and they are other spending. The bulk delete
    // refuses exactly this row for exactly this reason.
    const splitPartner = { ...IN, isSplit: true };
    expect(describeDeleteStranding(OUT, [OUT, splitPartner], OPEN)?.deletableOtherSide).toBeNull();
  });

  it('refuses when the other half is one LINE of a split, either direction', () => {
    const facingASplitLine = { ...OUT, linkedTransferSplitId: 'split-line-1' };
    expect(describeDeleteStranding(facingASplitLine, [facingASplitLine, IN], OPEN)?.deletableOtherSide)
      .toBeNull();

    const partnerIsALeg = { ...IN, linkedTransferSplitId: 'split-line-9' };
    expect(describeDeleteStranding(OUT, [OUT, partnerIsALeg], OPEN)?.deletableOtherSide).toBeNull();
  });
});
