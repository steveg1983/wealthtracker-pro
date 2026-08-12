import { describe, it, expect } from 'vitest';
import { Decimal } from '../decimal';
import {
  accountCurrencyIndex,
  compareCrossCurrencyCandidates,
  crossCurrencyCandidate,
  hasMultipleCurrencies,
  oppositeInSign,
  type CrossCurrencyRateLookup,
} from '../crossCurrencyMatch';
import { findTransferCandidates } from '../transferMatch';
import { sweepTransferPairs } from '../transferSweep';
import { findStrandedTransfers } from '../strandedTransfers';
import type { Account, Category, Transaction } from '../../types';

/**
 * Offering a pair that crosses a currency boundary.
 *
 * The matchers used to bucket by exact penny amount, so −$100.00 and the
 * +£74.20 that is its other side landed in buckets that never met. The engines
 * now accept such a link — opposite in sign, both non-zero, no constraint on
 * magnitude — and these are the tests that the matchers ask the same question
 * the engines answer, and that they still ask the OLD question, unchanged, of
 * everything else.
 */

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -100,
  description: 'Transfer',
  category: '',
  accountId: 'acc-gbp',
  type: 'expense',
  ...over,
});

const account = (id: string, currency: string): Account => ({
  id,
  name: id,
  type: 'current',
  balance: 0,
  currency,
  lastUpdated: new Date('2026-07-01'),
});

/** A sterling account and a dollar one — the boundary under test. */
const TWO_CURRENCIES: Account[] = [account('acc-gbp', 'GBP'), account('acc-usd', 'USD')];
/** The same two accounts, both in sterling — the control. */
const ONE_CURRENCY: Account[] = [account('acc-gbp', 'GBP'), account('acc-usd', 'GBP')];

/** A quote of 1.36 USD per GBP, in the shape the matchers accept. */
const quoteUsdPerGbp: CrossCurrencyRateLookup = (from, to) =>
  from === 'GBP' && to === 'USD' ? new Decimal('1.36') : null;

describe('the cross-currency candidate rule', () => {
  it('is opposite in sign and non-zero — the engine\'s own test', () => {
    expect(oppositeInSign(-100, 136.25)).toBe(true);
    expect(oppositeInSign(136.25, -100)).toBe(true);
    // Same money in both directions is two receipts, not a transfer.
    expect(oppositeInSign(-100, -136.25)).toBe(false);
    expect(oppositeInSign(100, 136.25)).toBe(false);
    // There is no rate at which zero becomes something.
    expect(oppositeInSign(0, 136.25)).toBe(false);
    expect(oppositeInSign(-100, 0)).toBe(false);
  });

  it('imposes NO magnitude constraint — the ratio is the rate', () => {
    const index = accountCurrencyIndex(TWO_CURRENCIES);
    // Absurd on its face, and still offered: every threshold that would exclude
    // it is a claim about an exchange rate.
    const match = crossCurrencyCandidate(
      { amount: -10, accountId: 'acc-gbp' },
      { amount: 14000, accountId: 'acc-usd' },
      index
    );
    expect(match?.pair).toEqual({ from: 'GBP', to: 'USD' });
  });

  it('declines a pair that shares a currency, or whose currency is unknown', () => {
    expect(crossCurrencyCandidate(
      { amount: -100, accountId: 'acc-gbp' },
      { amount: 100, accountId: 'acc-usd' },
      accountCurrencyIndex(ONE_CURRENCY)
    )).toBeNull();

    // An unknown currency is not evidence that a conversion happened, so the
    // strict same-amount rule stays in force.
    expect(crossCurrencyCandidate(
      { amount: -100, accountId: 'acc-gbp' },
      { amount: 136.25, accountId: 'acc-unknown' },
      accountCurrencyIndex(TWO_CURRENCIES)
    )).toBeNull();
  });

  it('declines two rows in the same account whatever the currencies say', () => {
    expect(crossCurrencyCandidate(
      { amount: -100, accountId: 'acc-gbp' },
      { amount: 136.25, accountId: 'acc-gbp' },
      accountCurrencyIndex(TWO_CURRENCIES)
    )).toBeNull();
  });

  it('measures divergence from a quote only when one is offered', () => {
    const index = accountCurrencyIndex(TWO_CURRENCIES);
    const pair = { amount: -100, accountId: 'acc-gbp' };

    expect(crossCurrencyCandidate(pair, { amount: 136, accountId: 'acc-usd' }, index)
      ?.rateDivergence).toBeUndefined();

    // 136 / 100 = 1.36, exactly the quote.
    expect(crossCurrencyCandidate(pair, { amount: 136, accountId: 'acc-usd' }, index, quoteUsdPerGbp)
      ?.rateDivergence).toBeCloseTo(1, 10);
    // 272 / 100 = 2.72 — twice the quote.
    expect(crossCurrencyCandidate(pair, { amount: 272, accountId: 'acc-usd' }, index, quoteUsdPerGbp)
      ?.rateDivergence).toBeCloseTo(2, 10);
    // 68 / 100 = 0.68 — HALF the quote, which is wrong by the same factor and
    // must score the same. A plain difference would rank one of them better.
    expect(crossCurrencyCandidate(pair, { amount: 68, accountId: 'acc-usd' }, index, quoteUsdPerGbp)
      ?.rateDivergence).toBeCloseTo(2, 10);
  });

  it('short-circuits a single-currency book', () => {
    expect(hasMultipleCurrencies(accountCurrencyIndex(ONE_CURRENCY))).toBe(false);
    expect(hasMultipleCurrencies(accountCurrencyIndex(TWO_CURRENCIES))).toBe(true);
    expect(hasMultipleCurrencies(accountCurrencyIndex([]))).toBe(false);
  });

  it('ranks by date first, then plausibility, then wording', () => {
    const near = { daysApart: 0, rateDivergence: 9, descriptionScore: 0 };
    const far = { daysApart: 3, rateDivergence: 1, descriptionScore: 100 };
    // Date leads: it is the only evidence about the two ROWS rather than about
    // a market.
    expect(compareCrossCurrencyCandidates(near, far)).toBeLessThan(0);

    const plausible = { daysApart: 1, rateDivergence: 1.01, descriptionScore: 0 };
    const wild = { daysApart: 1, rateDivergence: 40, descriptionScore: 100 };
    expect(compareCrossCurrencyCandidates(plausible, wild)).toBeLessThan(0);

    const wordy = { daysApart: 1, descriptionScore: 90 };
    const terse = { daysApart: 1, descriptionScore: 10 };
    expect(compareCrossCurrencyCandidates(wordy, terse)).toBeLessThan(0);
  });
});

describe('findTransferCandidates across a currency boundary', () => {
  const source = txn({ id: 'src', amount: -100, accountId: 'acc-gbp' });
  const converted = txn({
    id: 'usd', amount: 136.25, accountId: 'acc-usd', type: 'income',
    date: new Date('2026-07-11'), description: 'Incoming transfer',
  });

  it('offers a candidate whose amount matches nothing, within the SAME window', () => {
    const result = findTransferCandidates([source, converted], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    });
    expect(result.map(c => c.transaction.id)).toEqual(['usd']);
    expect(result[0].crossCurrency).toEqual({ from: 'GBP', to: 'USD' });
  });

  it('offers nothing for a row of the same sign', () => {
    const sameSign = txn({ id: 'usd', amount: -136.25, accountId: 'acc-usd' });
    expect(findTransferCandidates([source, sameSign], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    })).toHaveLength(0);
  });

  it('offers nothing for a zero on either side', () => {
    const zero = txn({ id: 'usd', amount: 0, accountId: 'acc-usd' });
    expect(findTransferCandidates([source, zero], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    })).toHaveLength(0);

    const zeroSource = txn({ id: 'src0', amount: 0, accountId: 'acc-gbp' });
    expect(findTransferCandidates([zeroSource, converted], zeroSource, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    })).toHaveLength(0);
  });

  it('uses the window it already had, not a new one', () => {
    const late = txn({
      id: 'usd', amount: 136.25, accountId: 'acc-usd', date: new Date('2026-07-20'),
    });
    expect(findTransferCandidates([source, late], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    })).toHaveLength(0);
    // …and the caller's own window still reaches it.
    expect(findTransferCandidates([source, late], source, 'acc-usd', 30, {
      accounts: TWO_CURRENCIES,
    })).toHaveLength(1);
  });

  it('sorts plausible conversions above wild ones on the same day', () => {
    const plausible = txn({
      id: 'plausible', amount: 136, accountId: 'acc-usd', type: 'income',
      description: 'Nothing alike',
    });
    const wild = txn({
      id: 'wild', amount: 5400, accountId: 'acc-usd', type: 'income',
      description: 'Transfer',
    });

    const ranked = findTransferCandidates([source, wild, plausible], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
      rateLookup: quoteUsdPerGbp,
    });
    // `wild` wins on wording and ties on date; the quote is what separates them.
    expect(ranked.map(c => c.transaction.id)).toEqual(['plausible', 'wild']);

    // And WITHOUT a quote both are still offered — a rate may sort, never filter.
    const unranked = findTransferCandidates([source, wild, plausible], source, 'acc-usd', undefined, {
      accounts: TWO_CURRENCIES,
    });
    expect(unranked).toHaveLength(2);
  });

  describe('the same-currency matcher, unchanged', () => {
    const exact = txn({
      id: 'exact', amount: 100, accountId: 'acc-usd', type: 'income',
      date: new Date('2026-07-11'),
    });
    const inexact = txn({
      id: 'inexact', amount: 136.25, accountId: 'acc-usd', type: 'income',
      date: new Date('2026-07-11'),
    });

    it('still demands the exact opposite amount when the currencies match', () => {
      const result = findTransferCandidates([source, exact, inexact], source, 'acc-usd', undefined, {
        accounts: ONE_CURRENCY,
      });
      expect(result.map(c => c.transaction.id)).toEqual(['exact']);
      expect(result[0].crossCurrency).toBeUndefined();
    });

    it('is byte-identical with the accounts supplied and without them', () => {
      const withAccounts = findTransferCandidates(
        [source, exact, inexact], source, 'acc-usd', undefined, { accounts: ONE_CURRENCY }
      );
      const without = findTransferCandidates([source, exact, inexact], source, 'acc-usd');
      expect(withAccounts).toEqual(without);
    });
  });
});

describe('sweepTransferPairs across a currency boundary', () => {
  const out = txn({
    id: 'out', amount: -100, accountId: 'acc-gbp', description: 'Transfer to dollars',
  });
  const into = txn({
    id: 'in', amount: 136.25, accountId: 'acc-usd', type: 'income',
    date: new Date('2026-07-11'), description: 'Faster payment received',
  });

  it('pairs a converted transfer, orienting out/in and naming the boundary', () => {
    const { suggestions } = sweepTransferPairs([out, into], { accounts: TWO_CURRENCIES });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outgoing.id).toBe('out');
    expect(suggestions[0].incoming.id).toBe('in');
    // Oriented outgoing → incoming: `from` is the currency the money LEFT.
    expect(suggestions[0].crossCurrency).toEqual({ from: 'GBP', to: 'USD' });
  });

  it('names the boundary the same way round when the sweep meets the incoming side first', () => {
    // The incoming row is the older one here, so the sweep reaches it first —
    // an accident of ordering that must not flip what `from` means.
    const earlyIn = txn({
      id: 'in', amount: 136.25, accountId: 'acc-usd', type: 'income',
      date: new Date('2026-07-09'),
    });
    const { suggestions } = sweepTransferPairs([out, earlyIn], { accounts: TWO_CURRENCIES });
    expect(suggestions[0].outgoing.id).toBe('out');
    expect(suggestions[0].crossCurrency).toEqual({ from: 'GBP', to: 'USD' });
  });

  it('finds nothing without the accounts, and nothing in a single-currency book', () => {
    expect(sweepTransferPairs([out, into]).suggestions).toHaveLength(0);
    expect(sweepTransferPairs([out, into], { accounts: ONE_CURRENCY }).suggestions).toHaveLength(0);
  });

  it('refuses a same-sign pair and a zero side', () => {
    const sameSign = txn({ id: 'in', amount: 136.25, accountId: 'acc-usd', type: 'income' });
    const alsoOut = txn({ id: 'out2', amount: -100, accountId: 'acc-gbp' });
    expect(
      sweepTransferPairs([alsoOut, sameSign], { accounts: TWO_CURRENCIES }).suggestions
    ).toHaveLength(1);
    // …but two rows of the SAME sign never pair.
    const bothOut = txn({ id: 'in', amount: -136.25, accountId: 'acc-usd' });
    expect(
      sweepTransferPairs([out, bothOut], { accounts: TWO_CURRENCIES }).suggestions
    ).toHaveLength(0);

    const zero = txn({ id: 'in', amount: 0, accountId: 'acc-usd' });
    expect(sweepTransferPairs([out, zero], { accounts: TWO_CURRENCIES }).suggestions).toHaveLength(0);
  });

  it('respects the window it already had', () => {
    const late = txn({
      id: 'in', amount: 136.25, accountId: 'acc-usd', type: 'income',
      date: new Date('2026-07-20'),
    });
    expect(sweepTransferPairs([out, late], { accounts: TWO_CURRENCIES }).suggestions).toHaveLength(0);
    expect(
      sweepTransferPairs([out, late], { accounts: TWO_CURRENCIES, windowDays: 30 }).suggestions
    ).toHaveLength(1);
  });

  describe('the exact-amount pass, unchanged', () => {
    // A book where an exact same-currency pair and a converted pair both exist.
    const accounts = [...TWO_CURRENCIES, account('acc-gbp2', 'GBP')];
    const rows = [
      txn({ id: 'exact-out', amount: -500, accountId: 'acc-gbp', description: 'Transfer to 5755' }),
      txn({ id: 'exact-in', amount: 500, accountId: 'acc-gbp2', type: 'income', description: 'Received' }),
      out,
      into,
    ];

    it('produces the same same-currency suggestions with the accounts as without', () => {
      const before = sweepTransferPairs(rows).suggestions;
      const after = sweepTransferPairs(rows, { accounts }).suggestions;

      expect(before).toHaveLength(1);
      // Identical objects, in the same positions: the cross-currency pass is
      // APPENDED, and takes only rows nothing else wanted.
      expect(after.slice(0, before.length)).toEqual(before);
      expect(after).toHaveLength(2);
      expect(after[1].crossCurrency).toEqual({ from: 'GBP', to: 'USD' });
    });

    it('never takes a row the exact pass had already claimed', () => {
      // `steal` would be a fine cross-currency partner for exact-out, but
      // exact-out is spoken for by the penny-perfect pass that runs first.
      const steal = txn({
        id: 'steal', amount: 680, accountId: 'acc-usd', type: 'income',
      });
      const { suggestions } = sweepTransferPairs([...rows, steal], { accounts });
      const exact = suggestions.find(s => s.outgoing.id === 'exact-out');
      expect(exact?.incoming.id).toBe('exact-in');
      expect(exact?.crossCurrency).toBeUndefined();
    });
  });
});

describe('findStrandedTransfers across a currency boundary', () => {
  const categories: Category[] = [
    { id: 'cat-dental', name: 'Dental', type: 'expense', level: 'detail' },
  ];

  const stranded = txn({
    id: 'stranded', amount: -100, accountId: 'acc-gbp', description: 'Transfer to dollars',
  });
  const filedTwin = txn({
    id: 'twin', amount: 136.25, accountId: 'acc-usd', type: 'income',
    category: 'cat-dental', date: new Date('2026-07-11'), description: 'Payment in',
  });

  it('offers a filed twin in another currency once nothing exact exists', () => {
    const { findings } = findStrandedTransfers([stranded, filedTwin], categories, {
      accounts: TWO_CURRENCIES,
    });
    const finding = findings.find(f => f.row.id === 'stranded');
    expect(finding?.kind).toBe('categorised');
    expect(finding).toMatchObject({
      counterpart: expect.objectContaining({ id: 'twin' }),
      counterpartCategoryName: 'Dental',
      crossCurrency: { from: 'GBP', to: 'USD' },
    });
  });

  it('says nothing about it without the accounts — the old answer, unchanged', () => {
    const { findings } = findStrandedTransfers([stranded, filedTwin], categories);
    // Transfer-shaped with no exact opposite anywhere: one-sided, as before.
    expect(findings.find(f => f.row.id === 'stranded')?.kind).toBe('one-sided');
  });

  it('still prefers the exact twin when there is one', () => {
    const exactTwin = txn({
      id: 'exact', amount: 100, accountId: 'acc-usd', type: 'income',
      category: 'cat-dental', date: new Date('2026-07-10'),
    });
    const { findings } = findStrandedTransfers([stranded, exactTwin, filedTwin], categories, {
      accounts: TWO_CURRENCIES,
    });
    const finding = findings.find(f => f.row.id === 'stranded');
    expect(finding).toMatchObject({ kind: 'categorised', counterpart: expect.objectContaining({ id: 'exact' }) });
    // The exact match is not a conversion, so it carries no boundary.
    expect(finding && 'crossCurrency' in finding ? finding.crossCurrency : undefined).toBeUndefined();
  });
});
