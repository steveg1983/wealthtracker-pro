import { describe, it, expect } from 'vitest';
import { planBulkDelete } from '../registerBulkDelete';
import type { Account, Transaction } from '../../types';

/**
 * The rule: a bulk delete may never be quieter than the same deletes done one
 * at a time. Every figure and name below is invented — this repo is public.
 */

const CURRENT: Account = {
  id: 'acc-current', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const SAVINGS: Account = {
  id: 'acc-savings', name: 'Synthetic Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const ACCOUNTS = [CURRENT, SAVINGS];

const row = (over: Partial<Transaction> & { id: string; description: string }): Transaction => ({
  date: new Date('2026-03-01'),
  amount: -12.5,
  category: 'det-groceries',
  accountId: CURRENT.id,
  type: 'expense',
  cleared: false,
  ...over,
});

const ORDINARY = row({ id: 'txn-ordinary', description: 'Synthetic corner shop' });
const ANOTHER = row({ id: 'txn-another', description: 'Synthetic bus fare' });

const TRANSFER_OUT = row({
  id: 'txn-transfer-out', description: 'Synthetic transfer out', amount: -300,
  type: 'transfer', category: 'transfer-out',
  linkedTransferId: 'txn-transfer-in', transferAccountId: SAVINGS.id,
});

const TRANSFER_IN = row({
  id: 'txn-transfer-in', description: 'Synthetic transfer in', amount: 300,
  accountId: SAVINGS.id, type: 'transfer', category: 'transfer-in',
  linkedTransferId: 'txn-transfer-out', transferAccountId: CURRENT.id,
});

const SPLIT_PARENT = row({ id: 'txn-split', description: 'Synthetic weekly shop', isSplit: true });

const SPLIT_LINE_COUNTERPART = row({
  id: 'txn-split-leg', description: 'Synthetic loan settlement', amount: 250, type: 'transfer',
  linkedTransferId: 'txn-split', linkedTransferSplitId: 'split-line-1', transferAccountId: SAVINGS.id,
});

const ALL = [ORDINARY, ANOTHER, TRANSFER_OUT, TRANSFER_IN, SPLIT_PARENT, SPLIT_LINE_COUNTERPART];

describe('planning a bulk delete', () => {
  it('deletes ordinary rows and says nothing extra about them', () => {
    const plan = planBulkDelete([ORDINARY, ANOTHER], ALL, ACCOUNTS);

    expect(plan.deleting.map(t => t.id)).toEqual(['txn-ordinary', 'txn-another']);
    expect(plan.stranding).toHaveLength(0);
    expect(plan.excluded).toHaveLength(0);
  });

  it('names the half of a transfer, and the account left holding the other one', () => {
    const plan = planBulkDelete([ORDINARY, TRANSFER_OUT], ALL, ACCOUNTS);

    // Deleted — a single delete allows this too — but never silently.
    expect(plan.deleting.map(t => t.id)).toEqual(['txn-ordinary', 'txn-transfer-out']);
    expect(plan.stranding).toHaveLength(1);
    expect(plan.stranding[0].transaction.id).toBe('txn-transfer-out');
    expect(plan.stranding[0].message).toContain('one half of a transfer');
    expect(plan.stranding[0].message).toContain('Synthetic Savings');
    // A bulk delete goes down the same audited deleteTransaction as a single
    // one, so the survivor is released there too — and the batch has to say so
    // in the same words. The one sentence serves both dialogs, which is why it
    // names no buttons: this one has none to name.
    expect(plan.stranding[0].message).toContain('stops being a transfer there');
    expect(plan.stranding[0].message).not.toMatch(/Delete both sides/);
  });

  it('refuses a split parent BY NAME instead of quietly taking its lines with it', () => {
    const plan = planBulkDelete([ORDINARY, SPLIT_PARENT], ALL, ACCOUNTS);

    expect(plan.deleting.map(t => t.id)).toEqual(['txn-ordinary']);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].transaction.description).toBe('Synthetic weekly shop');
    expect(plan.excluded[0].reason).toContain('split across several categories');
  });

  it('refuses the opposite side of a split LINE for the same reason', () => {
    const plan = planBulkDelete([SPLIT_LINE_COUNTERPART], ALL, ACCOUNTS);

    expect(plan.deleting).toHaveLength(0);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].transaction.id).toBe('txn-split-leg');
    expect(plan.excluded[0].reason).toContain('single LINE inside a split');
  });

  it('keeps the register order it was given, whatever the mix', () => {
    const plan = planBulkDelete(
      [SPLIT_PARENT, TRANSFER_OUT, ANOTHER, SPLIT_LINE_COUNTERPART, ORDINARY],
      ALL,
      ACCOUNTS
    );

    expect(plan.deleting.map(t => t.id)).toEqual(['txn-transfer-out', 'txn-another', 'txn-ordinary']);
    expect(plan.excluded.map(e => e.transaction.id)).toEqual(['txn-split', 'txn-split-leg']);
  });

  it('does not print an account name it has not got', () => {
    // The other side sits in an account that is CLOSED, so it is absent from
    // the open list the context carries.
    const plan = planBulkDelete([TRANSFER_OUT], ALL, [CURRENT]);

    expect(plan.deleting.map(t => t.id)).toEqual(['txn-transfer-out']);
    expect(plan.stranding[0].message).toContain('the account it faces');
    expect(plan.stranding[0].message).not.toContain('Synthetic Savings');
  });

  it('has nothing to say about an empty selection', () => {
    const plan = planBulkDelete([], ALL, ACCOUNTS);
    expect(plan.deleting).toHaveLength(0);
    expect(plan.stranding).toHaveLength(0);
    expect(plan.excluded).toHaveLength(0);
  });
});
