/**
 * Allocation by security rather than by account.
 *
 * The tests that matter are the honesty ones: a holding with no price must be
 * COUNTED and reported rather than quietly dropped, and cash must appear as one
 * category however many sleeves it is spread across.
 */
import { describe, it, expect } from 'vitest';
import { buildHoldingAllocation, CASH_SLICE_LABEL } from '../holdingAllocation';
import { toDecimal } from '../decimal';
import type { InvestmentHolding } from '../../services/investments/holding';
import type { PortfolioLine } from '../portfolioSummary';

function holding(over: Partial<InvestmentHolding> & { symbol: string }): InvestmentHolding {
  const quantity = over.quantity ?? toDecimal(10);
  const price = over.currentPrice === undefined ? toDecimal(100) : over.currentPrice;
  return {
    id: `h-${over.symbol}-${Math.abs(quantity.toNumber())}`,
    accountId: 'acc-1',
    name: over.name ?? over.symbol,
    quantity,
    costBasis: toDecimal(0),
    averageCost: toDecimal(0),
    currentPrice: price,
    marketValue: over.marketValue !== undefined
      ? over.marketValue
      : price === null ? null : price.times(quantity),
    currency: 'GBP',
    assetType: 'stock',
    purchaseDate: null,
    purchasePrice: null,
    lastUpdated: null,
    notes: '',
    ...over
  } as InvestmentHolding;
}

function line(cash: Array<{ label: string; value: number }>): PortfolioLine {
  return {
    accountId: 'acc-1',
    name: 'An account',
    institution: '',
    value: toDecimal(0),
    cash: cash.map((entry, i) => ({
      accountId: `cash-${i}`,
      label: entry.label,
      value: toDecimal(entry.value)
    })),
    allocation: toDecimal(0)
  } as PortfolioLine;
}

describe('allocation by holding', () => {
  it('adds one security up across every account that holds it', () => {
    const result = buildHoldingAllocation(
      [
        holding({ symbol: 'AAPL', quantity: toDecimal(10), currentPrice: toDecimal(100) }),
        holding({ symbol: 'AAPL', quantity: toDecimal(5), currentPrice: toDecimal(100) }),
        holding({ symbol: 'MSFT', quantity: toDecimal(2), currentPrice: toDecimal(50) })
      ],
      []
    );

    // An ISA and a dealing account holding Apple is one position, not two.
    expect(result.slices.map(s => [s.key, s.value.toNumber()])).toEqual([
      ['AAPL', 1500],
      ['MSFT', 100]
    ]);
    expect(result.total.toNumber()).toBe(1600);
  });

  it('matches on the ticker even when the two rows spell the name differently', () => {
    const result = buildHoldingAllocation(
      [
        holding({ symbol: 'aapl', name: 'Apple Inc', quantity: toDecimal(1), currentPrice: toDecimal(10) }),
        holding({ symbol: 'AAPL', name: 'Apple Inc.', quantity: toDecimal(1), currentPrice: toDecimal(10) })
      ],
      []
    );

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].value.toNumber()).toBe(20);
  });

  it('gathers every cash sleeve into one category', () => {
    const result = buildHoldingAllocation(
      [holding({ symbol: 'AAPL', quantity: toDecimal(1), currentPrice: toDecimal(100) })],
      [
        line([{ label: 'Cash', value: 30 }, { label: 'Cash', value: 20 }]),
        line([{ label: 'Cash', value: 50 }])
      ]
    );

    const cash = result.slices.filter(s => s.label === CASH_SLICE_LABEL);
    expect(cash).toHaveLength(1);
    expect(cash[0].value.toNumber()).toBe(100);
  });

  it('ranks cash by size like anything else, not last', () => {
    // A portfolio that has just sold up is mostly cash, and burying it at the
    // end of the legend would be the one arrangement that misleads.
    const result = buildHoldingAllocation(
      [holding({ symbol: 'AAPL', quantity: toDecimal(1), currentPrice: toDecimal(10) })],
      [line([{ label: 'Cash', value: 900 }])]
    );

    expect(result.slices[0].label).toBe(CASH_SLICE_LABEL);
  });

  describe('holdings with no price', () => {
    it('counts them instead of pretending they are not owned', () => {
      const result = buildHoldingAllocation(
        [
          holding({ symbol: 'AAPL', quantity: toDecimal(1), currentPrice: toDecimal(100) }),
          holding({ symbol: 'XYZ', currentPrice: null, marketValue: null }),
          holding({ symbol: 'ABC', currentPrice: null, marketValue: null })
        ],
        []
      );

      expect(result.unpricedCount).toBe(2);
      // Not in the ring, because there is no number for them…
      expect(result.slices.map(s => s.key)).toEqual(['AAPL']);
      // …and therefore not in the total either, so the shares still add to 100
      // of what IS shown, and the caller says what is missing.
      expect(result.total.toNumber()).toBe(100);
    });

    it('reports none when everything is priced', () => {
      const result = buildHoldingAllocation(
        [holding({ symbol: 'AAPL', quantity: toDecimal(1), currentPrice: toDecimal(1) })],
        []
      );
      expect(result.unpricedCount).toBe(0);
    });
  });

  describe('nothing to show', () => {
    it('is empty rather than a zero slice when there is nothing at all', () => {
      const result = buildHoldingAllocation([], []);
      expect(result.slices).toEqual([]);
      expect(result.total.toNumber()).toBe(0);
      expect(result.unpricedCount).toBe(0);
    });

    it('leaves out a security worth nothing, and cash worth nothing', () => {
      const result = buildHoldingAllocation(
        [holding({ symbol: 'GONE', quantity: toDecimal(0), currentPrice: toDecimal(100) })],
        [line([{ label: 'Cash', value: 0 }])]
      );
      // A 0% wedge is not a slice anybody can see or click.
      expect(result.slices).toEqual([]);
    });

    it('leaves out a short position rather than drawing a negative wedge', () => {
      const result = buildHoldingAllocation(
        [
          holding({ symbol: 'LONG', quantity: toDecimal(2), currentPrice: toDecimal(100) }),
          holding({ symbol: 'SHORT', quantity: toDecimal(-3), currentPrice: toDecimal(100) })
        ],
        []
      );
      expect(result.slices.map(s => s.key)).toEqual(['LONG']);
      expect(result.total.toNumber()).toBe(200);
    });
  });
});
