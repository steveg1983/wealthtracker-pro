import { describe, it, expect } from 'vitest';
import { buildAccountDistribution, ACCOUNT_DISTRIBUTION_SLICES } from './accountDistribution';

/**
 * The Dashboard card and the full report both read this, so what it decides is
 * what BOTH show. Every account name and figure here is invented.
 */

const accountsOf = (...names: string[]) => names.map((name, index) => ({ id: `acc-${index}`, name }));

describe('buildAccountDistribution', () => {
  it('ranks every account by what it holds, largest first', () => {
    const accounts = accountsOf('Small', 'Large', 'Middle');
    const balances = new Map([['acc-0', 100], ['acc-1', 900], ['acc-2', 400]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(entries.map(e => e.name)).toEqual(['Large', 'Middle', 'Small']);
  });

  it('keeps zero and overdrawn accounts in the list', () => {
    // An account holding nothing is part of the answer to "where is my money";
    // dropping it silently is how a user concludes the app lost an account.
    const accounts = accountsOf('In credit', 'Empty', 'Overdrawn');
    const balances = new Map([['acc-0', 500], ['acc-1', 0], ['acc-2', -250]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(entries.map(e => [e.name, e.value])).toEqual([
      ['In credit', 500],
      ['Empty', 0],
      ['Overdrawn', -250],
    ]);
  });

  it('gives a share only to accounts with something to share', () => {
    const accounts = accountsOf('In credit', 'Empty', 'Overdrawn');
    const balances = new Map([['acc-0', 500], ['acc-1', 0], ['acc-2', -250]]);

    const { entries, inCreditTotal } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    // The total is what is HELD, so the overdraft does not reduce it.
    expect(inCreditTotal.toNumber()).toBe(500);
    expect(entries[0].share?.toNumber()).toBe(100);
    expect(entries[1].share).toBeNull();
    expect(entries[2].share).toBeNull();
  });

  it('splits the shares in Decimal, so thirds still add to a hundred', () => {
    const accounts = accountsOf('A', 'B', 'C');
    const balances = new Map([['acc-0', 100], ['acc-1', 100], ['acc-2', 100]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    const total = entries.reduce((sum, e) => sum + (e.share?.toNumber() ?? 0), 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('draws only the largest accounts in credit, and never a negative slice', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E', 'F', 'Overdrawn');
    const balances = new Map([
      ['acc-0', 700], ['acc-1', 600], ['acc-2', 500],
      ['acc-3', 400], ['acc-4', 300], ['acc-5', 200],
      ['acc-6', -1000],
    ]);

    const { slices, entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(slices).toHaveLength(ACCOUNT_DISTRIBUTION_SLICES);
    expect(slices.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(slices.every(s => s.value > 0)).toBe(true);
    // The table still lists everything the chart left out.
    expect(entries).toHaveLength(7);
  });

  it('breaks a tie by name, so equal balances do not swap places between renders', () => {
    const accounts = accountsOf('Zebra', 'Aardvark');
    const balances = new Map([['acc-0', 100], ['acc-1', 100]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(entries.map(e => e.name)).toEqual(['Aardvark', 'Zebra']);
  });

  it('has nothing to draw when nothing is in credit', () => {
    const accounts = accountsOf('Overdrawn');

    const { slices, inCreditTotal, entries } = buildAccountDistribution(accounts, () => -40);

    expect(slices).toEqual([]);
    expect(inCreditTotal.toNumber()).toBe(0);
    expect(entries[0].share).toBeNull();
  });
});
