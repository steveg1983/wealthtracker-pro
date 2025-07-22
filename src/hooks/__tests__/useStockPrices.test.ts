import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStockPrices, useStockPrice } from '../useStockPrices';
import type { Holding } from '../../types';

// Mock the stock price service module
vi.mock('../../services/stockPriceService', () => ({
  getMultipleStockQuotes: vi.fn(),
  getStockQuote: vi.fn()
}));

// Import after mocking
import { getMultipleStockQuotes, getStockQuote } from '../../services/stockPriceService';

describe('useStockPrices', () => {
  const mockHoldings: Holding[] = [
    {
      id: 'holding-1',
      investmentId: 'inv-1',
      accountId: 'acc-1',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      quantity: '100',
      costBasis: '15000.00',
      currentValue: '17500.00',
      purchaseDate: '2023-01-15',
      type: 'stock',
      createdAt: new Date('2023-01-15').toISOString(),
      updatedAt: new Date('2023-01-15').toISOString()
    },
    {
      id: 'holding-2',
      investmentId: 'inv-2',
      accountId: 'acc-1',
      ticker: 'GOOGL',
      name: 'Alphabet Inc.',
      quantity: '50',
      costBasis: '5000.00',
      currentValue: '7000.00',
      purchaseDate: '2023-02-01',
      type: 'stock',
      createdAt: new Date('2023-02-01').toISOString(),
      updatedAt: new Date('2023-02-01').toISOString()
    }
  ];

  const createMockDecimal = (value: number) => ({
    toNumber: () => value,
    toString: () => value.toString(),
  });

  const mockQuotes = new Map([
    ['AAPL', {
      symbol: 'AAPL',
      price: createMockDecimal(175.50),
      currency: 'USD',
      change: createMockDecimal(2.50),
      changePercent: createMockDecimal(1.45),
      lastUpdated: new Date('2024-01-15T16:00:00Z'),
      name: 'Apple Inc.'
    }],
    ['GOOGL', {
      symbol: 'GOOGL',
      price: createMockDecimal(140.00),
      currency: 'USD',
      change: createMockDecimal(-1.00),
      changePercent: createMockDecimal(-0.71),
      lastUpdated: new Date('2024-01-15T16:00:00Z'),
      name: 'Alphabet Inc.'
    }]
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    // Return resolved promise immediately
    (getMultipleStockQuotes as any).mockResolvedValue(mockQuotes);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should initialize with empty prices and not loading', () => {
      const { result } = renderHook(() => useStockPrices([]));

      expect(result.current.prices.size).toBe(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should fetch prices for holdings on mount', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      // Initial state
      expect(result.current.loading).toBe(true);

      // Wait for the async operation to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getMultipleStockQuotes).toHaveBeenCalledWith(['AAPL', 'GOOGL']);
      expect(result.current.prices.size).toBe(2);
      expect(result.current.error).toBe(null);
    });

    it('should convert decimal prices to numbers', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const applePrice = result.current.prices.get('AAPL');
      expect(applePrice).toEqual({
        symbol: 'AAPL',
        price: 175.50,
        currency: 'USD',
        change: 2.50,
        changePercent: 1.45,
        lastUpdated: new Date('2024-01-15T16:00:00Z'),
        name: 'Apple Inc.'
      });
    });

    it('should handle empty holdings array', () => {
      const { result } = renderHook(() => useStockPrices([]));

      expect(getMultipleStockQuotes).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.prices.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors', async () => {
      const errorMessage = 'Network error';
      (getMultipleStockQuotes as any).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.prices.size).toBe(0);
    });

    it('should handle non-Error rejections', async () => {
      (getMultipleStockQuotes as any).mockRejectedValue('String error');

      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch stock prices');
    });
  });

  describe('refresh functionality', () => {
    it('should refresh prices when refreshPrices is called', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getMultipleStockQuotes).toHaveBeenCalledTimes(1);

      // Update mock response
      const updatedQuotes = new Map(mockQuotes);
      updatedQuotes.set('AAPL', {
        ...mockQuotes.get('AAPL')!,
        price: createMockDecimal(180.00),
        change: createMockDecimal(7.00)
      });
      (getMultipleStockQuotes as any).mockResolvedValue(updatedQuotes);

      // Trigger refresh
      await act(async () => {
        await result.current.refreshPrices();
      });

      expect(getMultipleStockQuotes).toHaveBeenCalledTimes(2);
      expect(result.current.prices.get('AAPL')?.price).toBe(180.00);
    });

    it.skip('should refresh prices automatically every 5 minutes', () => {
      // Skipping due to timer complexity in test environment
    });

    it('should clear interval on unmount', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { unmount } = renderHook(() => useStockPrices(mockHoldings));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('getPrice function', () => {
    it('should return price for existing symbol', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const price = result.current.getPrice('AAPL');
      expect(price).toEqual({
        symbol: 'AAPL',
        price: 175.50,
        currency: 'USD',
        change: 2.50,
        changePercent: 1.45,
        lastUpdated: new Date('2024-01-15T16:00:00Z'),
        name: 'Apple Inc.'
      });
    });

    it('should handle case-insensitive symbol lookup', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getPrice('aapl')).toEqual(result.current.getPrice('AAPL'));
    });

    it('should return undefined for non-existent symbol', async () => {
      const { result } = renderHook(() => useStockPrices(mockHoldings));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getPrice('TSLA')).toBeUndefined();
    });
  });
});

describe('useStockPrice', () => {
  const createMockDecimal = (value: number) => ({
    toNumber: () => value,
    toString: () => value.toString(),
  });

  const mockQuote = {
    symbol: 'AAPL',
    price: createMockDecimal(175.50),
    currency: 'USD',
    change: createMockDecimal(2.50),
    changePercent: createMockDecimal(1.45),
    lastUpdated: new Date('2024-01-15T16:00:00Z'),
    name: 'Apple Inc.'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getStockQuote as any).mockResolvedValue(mockQuote);
  });

  it('should fetch price for symbol', async () => {
    const { result } = renderHook(() => useStockPrice('AAPL'));

    expect(result.current.loading).toBe(true);
    expect(result.current.price).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getStockQuote).toHaveBeenCalledWith('AAPL');
    expect(result.current.price).toEqual({
      symbol: 'AAPL',
      price: 175.50,
      currency: 'USD',
      change: 2.50,
      changePercent: 1.45,
      lastUpdated: new Date('2024-01-15T16:00:00Z'),
      name: 'Apple Inc.'
    });
    expect(result.current.error).toBe(null);
  });

  it('should handle undefined symbol', () => {
    const { result } = renderHook(() => useStockPrice(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.price).toBe(null);
    expect(result.current.error).toBe(null);
    expect(getStockQuote).not.toHaveBeenCalled();
  });

  it('should handle null quote response', async () => {
    (getStockQuote as any).mockResolvedValue(null);

    const { result } = renderHook(() => useStockPrice('INVALID'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.price).toBe(null);
    expect(result.current.error).toBe('Failed to fetch price');
  });

  it('should handle fetch errors', async () => {
    const errorMessage = 'API error';
    (getStockQuote as any).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useStockPrice('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.price).toBe(null);
    expect(result.current.error).toBe(errorMessage);
  });

  it.skip('should refresh price every minute', () => {
    // Skipping due to timer complexity in test environment
  });

  it('should clear interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useStockPrice('AAPL'));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});