import { describe, it, expect } from 'vitest';
import { computeAccountBalances, type ServerAccountBalance } from './accountBalances';

const accounts = [
  { id: 'acc-1', openingBalance: 100 },
  { id: 'acc-2', openingBalance: -50 },
  { id: 'acc-3' }
];

const serverBalances = new Map<string, ServerAccountBalance>([
  ['acc-1', { balance: 1234.56, txnCount: 3 }],
  ['acc-2', { balance: -99.99, txnCount: 1 }]
]);

describe('computeAccountBalances', () => {
  it('sums opening balance plus transactions for each account', () => {
    const balances = computeAccountBalances(accounts, [
      { accountId: 'acc-1', amount: 25.5 },
      { accountId: 'acc-1', amount: -10.25 },
      { accountId: 'acc-2', amount: -5 }
    ]);

    expect(balances.get('acc-1')).toBe(115.25);
    expect(balances.get('acc-2')).toBe(-55);
    expect(balances.get('acc-3')).toBe(0);
  });

  it('sums without float drift', () => {
    const balances = computeAccountBalances(
      [{ id: 'acc-1', openingBalance: 0 }],
      [
        { accountId: 'acc-1', amount: 0.1 },
        { accountId: 'acc-1', amount: 0.2 }
      ]
    );

    expect(balances.get('acc-1')).toBe(0.3);
  });

  it('uses server balances while the transaction pages are still empty', () => {
    const balances = computeAccountBalances(accounts, [], serverBalances);

    expect(balances.get('acc-1')).toBe(1234.56);
    expect(balances.get('acc-2')).toBe(-99.99);
  });

  it('falls back to the opening balance for accounts the server did not report', () => {
    const balances = computeAccountBalances(accounts, [], serverBalances);

    expect(balances.get('acc-3')).toBe(0);
  });

  it('ignores server balances as soon as any transaction has arrived', () => {
    const balances = computeAccountBalances(
      accounts,
      [{ accountId: 'acc-1', amount: 25 }],
      serverBalances
    );

    expect(balances.get('acc-1')).toBe(125);
    expect(balances.get('acc-2')).toBe(-50);
  });

  it('computes the ledger balance when no server balances are available', () => {
    const empty = new Map<string, ServerAccountBalance>();

    expect(computeAccountBalances(accounts, [], empty).get('acc-1')).toBe(100);
    expect(computeAccountBalances(accounts, []).get('acc-1')).toBe(100);
  });
});
