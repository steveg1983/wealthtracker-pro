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

  it('shares are contributions to NET WORTH — negative for a liability, none for a zero', () => {
    const accounts = accountsOf('In credit', 'Empty', 'Overdrawn');
    const balances = new Map([['acc-0', 500], ['acc-1', 0], ['acc-2', -250]]);

    const { entries, netWorth, inCreditTotal } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(netWorth.toNumber()).toBe(250);
    expect(inCreditTotal.toNumber()).toBe(500);
    // 500 of a 250 net worth is honestly 200% — an account CAN hold more than
    // you are worth when a liability sits against it.
    expect(entries[0].share?.toNumber()).toBe(200);
    expect(entries[1].share).toBeNull();
    expect(entries[2].share?.toNumber()).toBe(-100);
  });

  it('splits the shares in Decimal, so thirds still add to a hundred', () => {
    const accounts = accountsOf('A', 'B', 'C');
    const balances = new Map([['acc-0', 100], ['acc-1', 100], ['acc-2', 100]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    const total = entries.reduce((sum, e) => sum + (e.share?.toNumber() ?? 0), 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('with liabilities in the ledger, the shares still sum to a hundred — of net worth', () => {
    const accounts = accountsOf('Asset', 'Loan');
    const balances = new Map([['acc-0', 300], ['acc-1', -100]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    // 150% − 50% = 100%: the decomposition of net worth, signs and all.
    const total = entries.reduce((sum, e) => sum + (e.share?.toNumber() ?? 0), 0);
    expect(total).toBeCloseTo(100, 10);
  });

  /* Until 18 August the remainder gathered only the accounts IN CREDIT, and
     on a real ledger the legend totalled far MORE than net worth — gross
     values counted, every liability ignored. The owner read it exactly:
     "otherwise it looks like a useless report". The remainder now nets EVERY
     other account, and the legend's five figures sum to net worth. */
  it('the legend sums to NET WORTH — the remainder nets every other account, liabilities included', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E', 'F', 'Overdrawn');
    const balances = new Map([
      ['acc-0', 700], ['acc-1', 600], ['acc-2', 500],
      ['acc-3', 400], ['acc-4', 300], ['acc-5', 200],
      ['acc-6', -1000],
    ]);

    const { slices, wedges, entries, netWorth, foldedCount } =
      buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(netWorth.toNumber()).toBe(1700);
    expect(slices.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', '3 other accounts']);
    expect(foldedCount).toBe(3);
    // 300 + 200 − 1000: the remainder is a NET figure, and here it is owed.
    const remainder = slices[slices.length - 1];
    expect(remainder.id).toBe(ACCOUNT_DISTRIBUTION_REMAINDER_ID);
    expect(remainder.value).toBe(-500);
    // The legend reconciles to the penny…
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(1700);
    // …and the ring draws only what a pie can: the negative remainder stays
    // in the legend, so the wedges are the four named slices, colours intact.
    expect(wedges.map(s => s.name)).toEqual(['A', 'B', 'C', 'D']);
    // The table still lists every real account — never the pseudo-slice.
    expect(entries).toHaveLength(7);
    expect(entries.some(e => e.id === ACCOUNT_DISTRIBUTION_REMAINDER_ID)).toBe(false);
  });

  it('legend figures and shares both decompose net worth exactly', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'E', 'F', 'G', 'Loan');
    // Thirds and the like, so a float fold would drift where Decimal cannot.
    const balances = new Map([
      ['acc-0', 1000.10], ['acc-1', 900.01], ['acc-2', 800.02], ['acc-3', 700.03],
      ['acc-4', 33.33], ['acc-5', 33.33], ['acc-6', 33.34], ['acc-7', -100.16],
    ]);

    const { slices, netWorth } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(slices).toHaveLength(ACCOUNT_DISTRIBUTION_SLICES);
    const legendSum = slices.reduce((sum, s) => sum + s.value, 0);
    expect(legendSum).toBeCloseTo(netWorth.toNumber(), 10);
    const shares = slices.reduce((sum, s) => sum + (s.share?.toNumber() ?? 0), 0);
    expect(shares).toBeCloseTo(100, 10);
  });

  it('exactly one account left over is shown by NAME — a fold of one hides nothing and loses the name', () => {
    const accounts = accountsOf('A', 'B', 'C', 'D', 'Mortgage');
    const balances = new Map([
      ['acc-0', 500], ['acc-1', 400], ['acc-2', 300], ['acc-3', 200], ['acc-4', -150],
    ]);

    const { slices, wedges, foldedCount } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(slices.map(s => s.name)).toEqual(['A', 'B', 'C', 'D', 'Mortgage']);
    expect(foldedCount).toBe(0);
    // The liability keeps its name in the legend and stays out of the ring.
    expect(wedges.map(s => s.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(1250);
  });

  it('a net worth at or below zero yields no shares — a percentage of a debt reads as nothing', () => {
    const accounts = accountsOf('Cash', 'Big Loan');
    const balances = new Map([['acc-0', 100], ['acc-1', -400]]);

    const { entries, slices, netWorth } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(netWorth.toNumber()).toBe(-300);
    expect(entries.every(e => e.share === null)).toBe(true);
    // The legend still reconciles: what you hold, less what you owe.
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(-300);
  });

  it('breaks a tie by name, so equal balances do not swap places between renders', () => {
    const accounts = accountsOf('Zebra', 'Aardvark');
    const balances = new Map([['acc-0', 100], ['acc-1', 100]]);

    const { entries } = buildAccountDistribution(accounts, id => balances.get(id) ?? 0);

    expect(entries.map(e => e.name)).toEqual(['Aardvark', 'Zebra']);
  });

  it('with nothing in credit the ring is empty but the legend still tells the truth', () => {
    const accounts = accountsOf('Overdrawn');

    const { slices, wedges, inCreditTotal, entries } = buildAccountDistribution(accounts, () => -40);

    // No wedge to draw — but the account is not hidden: the legend names it,
    // parenthesised, because an all-debt ledger is a fact, not an absence.
    expect(wedges).toEqual([]);
    expect(slices.map(s => s.name)).toEqual(['Overdrawn']);
    expect(inCreditTotal.toNumber()).toBe(0);
    expect(entries[0].share).toBeNull();
  });
});
