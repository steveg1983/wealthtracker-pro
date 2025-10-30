/**
 * useRealTimePrices REAL Tests
 * Tests real-time price updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealTimePrices } from '../useRealTimePrices';
import { realTimePriceService, type PriceUpdate } from '../../services/realtimePriceService';
import { toDecimal } from '@wealthtracker/utils';

describe('useRealTimePrices - REAL Tests', () => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT'];
  const nextCheck = new Date(Date.now() + 60_000);

  let subscribeMock: ReturnType<typeof vi.spyOn>;
  let getMarketStatusMock: ReturnType<typeof vi.spyOn>;
  let onMock: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const makeQuote = (symbol: string) => ({
    symbol,
    price: toDecimal(150),
    currency: 'USD',
    change: toDecimal(1.5),
    changePercent: toDecimal(1),
    previousClose: toDecimal(148.5),
    lastUpdated: new Date(),
  });

  let capturedCallback: ((update: PriceUpdate) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    capturedCallback = null;

    subscribeMock = vi
      .spyOn(realTimePriceService, 'subscribeMultiple')
      .mockImplementation((symbolsList, callback) => {
        capturedCallback = callback;
        callback({
          symbol: symbolsList[0],
          quote: makeQuote(symbolsList[0]),
          timestamp: new Date(),
        });
        return () => {
          capturedCallback = null;
        };
      });

    getMarketStatusMock = vi
      .spyOn(realTimePriceService, 'getMarketStatus')
      .mockReturnValue({ isOpen: true, nextCheck });

    onMock = vi.spyOn(realTimePriceService, 'on').mockImplementation(() => {});
    vi.spyOn(realTimePriceService, 'off').mockImplementation(() => {});

    fetchSpy = vi
      .spyOn(realTimePriceService as unknown as { fetchAndBroadcast(symbol: string): Promise<void> }, 'fetchAndBroadcast')
      .mockImplementation(async symbol => {
        if (capturedCallback) {
          capturedCallback({
            symbol,
            quote: makeQuote(symbol),
            timestamp: new Date(),
          });
        }
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('handles real-time price data', async () => {
    const { result } = renderHook(() =>
      useRealTimePrices({
        symbols,
        enabled: true,
      }),
    );

    expect(subscribeMock).toHaveBeenCalledWith(symbols, expect.any(Function));
    expect(getMarketStatusMock).toHaveBeenCalled();
    expect(onMock).toHaveBeenCalledWith('error', expect.any(Function));

    // Initial update should populate quotes map
    const initialQuote = result.current.quotes.get('AAPL');
    expect(initialQuote).toBeDefined();
    expect(initialQuote?.symbol).toBe('AAPL');
    expect(initialQuote?.price.equals?.(toDecimal(150))).toBe(true);

    // Allow loading timeout to resolve
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.marketStatus.isOpen).toBe(true);

    // Trigger refresh and ensure fetch is called for each symbol
    await act(async () => {
      result.current.refresh();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(symbols.length);
    symbols.forEach(symbol => {
      expect(fetchSpy).toHaveBeenCalledWith(symbol);
      const quote = result.current.quotes.get(symbol);
      if (quote) {
        expect(quote.symbol).toBe(symbol);
      }
    });
  });
});
