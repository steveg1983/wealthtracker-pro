/**
 * useStockPrices REAL Tests
 * Tests stock price fetching and caching
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Holding } from '@/types';
import { useStockPrices } from '../useStockPrices';

const { mockGetMultipleStockQuotes } = vi.hoisted(() => {
  const createDecimal = (value: number) => ({
    toNumber: () => value,
  });

  return {
    mockGetMultipleStockQuotes: vi.fn(async (symbols: string[]) => {
      return new Map(
        symbols.map(symbol => [
          symbol,
          {
            symbol,
            price: createDecimal(100),
            currency: 'USD',
            change: createDecimal(1),
            changePercent: createDecimal(0.5),
            previousClose: createDecimal(99),
            lastUpdated: new Date(),
            name: `${symbol} Inc`,
          },
        ]),
      );
    }),
  };
});

vi.mock('../../services/stockPriceService', () => {
  return {
    getMultipleStockQuotes: mockGetMultipleStockQuotes,
    getStockQuote: vi.fn(),
  };
});

describe('useStockPrices - REAL Tests', () => {
  it('fetches and caches stock prices', async () => {
    mockGetMultipleStockQuotes.mockClear();

    const holdings: Holding[] = [
      {
        id: 'holding-1',
        accountId: 'acc-1',
        symbol: 'AAPL',
        ticker: 'AAPL',
        name: 'Apple Inc.',
        quantity: 10,
        purchasePrice: 90,
        purchaseDate: new Date('2024-01-01'),
        currentPrice: 100,
        currentValue: 1000,
        averageCost: 95,
        shares: 10,
        value: 1000,
        createdAt: new Date(),
      },
      {
        id: 'holding-2',
        accountId: 'acc-1',
        symbol: 'TSLA',
        ticker: 'TSLA',
        name: 'Tesla Inc.',
        quantity: 5,
        purchasePrice: 200,
        purchaseDate: new Date('2024-01-01'),
        currentPrice: 210,
        currentValue: 1050,
        averageCost: 205,
        shares: 5,
        value: 1050,
        createdAt: new Date(),
      },
    ];

    const { result } = renderHook(() => useStockPrices(holdings));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.getPrice('AAPL')).toBeDefined();
      expect(mockGetMultipleStockQuotes).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refreshPrices();
    });

    expect(mockGetMultipleStockQuotes).toHaveBeenCalledTimes(2);
  });
});
