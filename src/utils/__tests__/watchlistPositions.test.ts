/**
 * The watchlist's dummy positions — the migration and the money arithmetic.
 *
 * Two quiet failure modes, each pinned: a reader that mishandles the OLD
 * stored shape (a plain array of symbol strings) empties somebody's list on
 * the day this ships; and the gain is money, where float maths is banned and
 * an off-by-a-unit shows a fake profit.
 */
import { describe, it, expect } from 'vitest';
import { normaliseWatchlist, positionMetrics } from '../watchlistPositions';

describe('the migration: whatever is stored becomes a clean list', () => {
  it('reads the OLD shape — plain symbol strings — as position-less items', () => {
    // The one that must never break: every existing user has this shape.
    expect(normaliseWatchlist(['AAPL', 'vod.l'])).toEqual([
      { symbol: 'AAPL' },
      { symbol: 'VOD.L' },
    ]);
  });

  it('reads the new shape, dropping malformed numbers rather than keeping them', () => {
    expect(normaliseWatchlist([
      { symbol: 'AAPL', shares: '10', startPrice: '250.50' },
      { symbol: 'MSFT', shares: 'ten', startPrice: '-5' },
    ])).toEqual([
      { symbol: 'AAPL', shares: '10', startPrice: '250.50' },
      { symbol: 'MSFT' },
    ]);
  });

  it('drops junk without taking the list with it', () => {
    // localStorage is hand-editable; one bad entry must cost one entry.
    expect(normaliseWatchlist(['AAPL', 42, null, {}, { symbol: '' }])).toEqual([
      { symbol: 'AAPL' },
    ]);
    expect(normaliseWatchlist('not-an-array')).toEqual([]);
  });

  it('keeps the first of a duplicated symbol', () => {
    expect(normaliseWatchlist([
      { symbol: 'AAPL', shares: '10', startPrice: '1' },
      'AAPL',
    ])).toEqual([{ symbol: 'AAPL', shares: '10', startPrice: '1' }]);
  });
});

describe('the arithmetic: a dummy position against a live price', () => {
  it('values the position and signs the gain', () => {
    const metrics = positionMetrics({ symbol: 'AAPL', shares: '10', startPrice: '250' }, '305.93');
    expect(metrics).not.toBeNull();
    expect(metrics?.value.toFixed(2)).toBe('3059.30');
    expect(metrics?.gain.toFixed(2)).toBe('559.30');
    expect(metrics?.gainPercent?.toFixed(2)).toBe('22.37');
  });

  it('shows a LOSS as negative, not as absolute', () => {
    const metrics = positionMetrics({ symbol: 'AAPL', shares: '4', startPrice: '350' }, '305.93');
    expect(metrics?.gain.toFixed(2)).toBe('-176.28');
    expect(metrics?.gainPercent?.toFixed(2)).toBe('-12.59');
  });

  it('is exact where floats are not', () => {
    // 0.1 + 0.2 country: 3 × (0.30 − 0.10) must be 0.60, not 0.6000000000000001.
    const metrics = positionMetrics({ symbol: 'X', shares: '3', startPrice: '0.10' }, '0.30');
    expect(metrics?.gain.toString()).toBe('0.6');
  });

  it('answers null for half a position — both fields or neither', () => {
    // Shares without a start price could show a value but not a gain, and a
    // card answering half its configured question reads as broken.
    expect(positionMetrics({ symbol: 'AAPL', shares: '10' }, '300')).toBeNull();
    expect(positionMetrics({ symbol: 'AAPL', startPrice: '250' }, '300')).toBeNull();
    expect(positionMetrics({ symbol: 'AAPL' }, '300')).toBeNull();
  });
});
