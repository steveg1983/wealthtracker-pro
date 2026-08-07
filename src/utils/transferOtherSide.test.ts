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

  it('names the account the survivor is left in, and what happens to it', () => {
    const stranding = describeDeleteStranding(OUT, [OUT, IN], OPEN);

    expect(stranding).not.toBeNull();
    // The account by NAME: the whole point is that the damage lands somewhere
    // the user is not looking.
    expect(stranding?.message).toContain('Savings');
    // The consequence, not the mechanism: the row survives and still counts.
    expect(stranding?.message).toMatch(/still counted in that account's balance/);
    expect(stranding?.message).toMatch(/no longer linked to anything/);
    // And where to go and finish the job.
    expect(stranding).toMatchObject({ accountId: 'acc-b', transactionId: 'in' });
  });

  it('works from the other leg too — both sides strand each other', () => {
    expect(describeDeleteStranding(IN, [OUT, IN], OPEN)?.message).toContain('Current Account');
  });

  it('does not invent a name for an account that is closed', () => {
    const stranding = describeDeleteStranding(OUT, [OUT], [account('acc-a', 'Current Account')]);

    expect(stranding?.message).toContain('in the account it faces');
    expect(stranding?.message).not.toContain('undefined');
    expect(stranding?.accountId).toBe('acc-b');
  });

  it('says a split LINE is what survives, when that is what survives', () => {
    // The counterpart is one line inside a split. Telling the user to "delete
    // that side too" would be telling them to delete other people's spending:
    // the rest of the split is unrelated, and it stays.
    const facingASplitLine = { ...OUT, linkedTransferSplitId: 'split-line-1' };
    const message = describeDeleteStranding(facingASplitLine, [facingASplitLine, IN], OPEN)?.message;

    expect(message).toContain('a single line inside a split transaction in Savings');
    expect(message).toMatch(/the split itself stays exactly as it is/);
    expect(message).not.toMatch(/Delete that side too/);
  });
});
