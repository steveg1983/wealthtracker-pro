import { describe, it, expect } from 'vitest';
import {
  buildAccountDistribution,
  ACCOUNT_DISTRIBUTION_REMAINDER_ID,
  ACCOUNT_DISTRIBUTION_SLICES,
} from './accountDistribution';

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

  /* Until 17 August this expected slices A–E with F silently dropped — the
     ring closed at six-sevenths of the money and read as the whole (Design
     §2.1: "a closed ring is a stronger claim than a subtitle"). The sixth
     account is now folded, so the ring always sums to what is held. */
  it('folds everything past the named slices into one counted remainder', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E', 'F', 'Overdrawn');
    const balances = new Map([
      ['acc-0', 700], ['acc-1', 600], ['acc-2', 500],
      ['acc-3', 400], ['acc-4', 300], ['acc-5', 200],
      ['acc-6', -1000],
    ]);

    const { slices, entries, foldedCount } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(slices).toHaveLength(ACCOUNT_DISTRIBUTION_SLICES);
    expect(slices.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', '2 smaller accounts']);
    expect(foldedCount).toBe(2);
    // The remainder is E + F, and the overdraft plays no part in it.
    const remainder = slices[slices.length - 1];
    expect(remainder.id).toBe(ACCOUNT_DISTRIBUTION_REMAINDER_ID);
    expect(remainder.value).toBe(500);
    expect(slices.every(s => s.value > 0)).toBe(true);
    // The table still lists every real account — never the pseudo-slice.
    expect(entries).toHaveLength(7);
    expect(entries.some(e => e.id === ACCOUNT_DISTRIBUTION_REMAINDER_ID)).toBe(false);
  });

  it('the ring sums to the whole: named slices plus remainder equal the in-credit total', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');
    // Thirds and the like, so a float fold would drift where Decimal cannot.
    const balances = new Map([
      ['acc-0', 1000.10], ['acc-1', 900.01], ['acc-2', 800.02], ['acc-3', 700.03],
      ['acc-4', 33.33], ['acc-5', 33.33], ['acc-6', 33.34], ['acc-7', 0.01],
    ]);

    const { slices, inCreditTotal } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    const drawn = slices.reduce((sum, s) => sum + s.value, 0);
    expect(drawn).toBeCloseTo(inCreditTotal.toNumber(), 10);
    const shares = slices.reduce((sum, s) => sum + (s.share?.toNumber() ?? 0), 0);
    expect(shares).toBeCloseTo(100, 10);
  });

  it('draws all five by name when exactly five are in credit — a fold of one would hide nothing', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E');
    const balances = new Map([
      ['acc-0', 500], ['acc-1', 400], ['acc-2', 300], ['acc-3', 200], ['acc-4', 100],
    ]);

    const { slices, foldedCount } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(slices.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(foldedCount).toBe(0);
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
