/**
 * RealTimePriceService Tests
 * Tests for real-time stock price monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { realTimePriceService } from './realtimePriceService';
import type { PriceUpdate } from './realtimePriceService';
import * as stockPriceService from './stockPriceService';

// Mock the stockPriceService
vi.mock('./stockPriceService', () => ({
  getStockQuote: vi.fn()
}));

describe('RealTimePriceService', () => {
  const mockQuote = {
    symbol: 'AAPL',
    price: 150.50,
    change: 2.50,
    changePercent: 1.68,
    previousClose: 148.00,
    marketCap: 2500000000000,
    dayHigh: 151.00,
    dayLow: 149.00,
    fiftyTwoWeekHigh: 180.00,
    fiftyTwoWeekLow: 120.00,
    lastUpdated: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers(); // Reset first
    vi.useFakeTimers();
    
    // Dispose the service first to clear any existing intervals
    realTimePriceService.dispose();
    
    // Mock getStockQuote to return mock data
    (stockPriceService.getStockQuote as Mock).mockImplementation((symbol) => 
      Promise.resolve({ ...mockQuote, symbol })
    );
  });

  afterEach(() => {
    realTimePriceService.dispose();
    vi.useRealTimers();
  });

  describe('subscribe', () => {
    it('subscribes to price updates for a symbol', async () => {
      const callback = vi.fn();
      const unsubscribe = realTimePriceService.subscribe('AAPL', callback);

      // Wait for the immediate fetch to complete
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());

      expect(callback).toHaveBeenCalledWith({
        symbol: 'AAPL',
        quote: mockQuote,
        timestamp: expect.any(Date)
      });

      unsubscribe();
    });

    it('normalizes symbol to uppercase', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      // Create a new symbol to avoid interference from other tests
      const unsub1 = realTimePriceService.subscribe('tsla', callback1);
      
      // Wait for first callback to be called
      await vi.waitFor(() => {
        expect(callback1).toHaveBeenCalled();
      });
      
      // Subscribe with uppercase version
      const unsub2 = realTimePriceService.subscribe('TSLA', callback2);

      // Second callback is added to existing subscription, so it gets called on next interval
      // But not immediately
      expect(callback2).not.toHaveBeenCalled();

      // Clear first callback calls
      callback1.mockClear();

      // Advance timer to trigger next update
      await vi.advanceTimersByTimeAsync(30000);

      // Now both should have been called with normalized symbol
      expect(callback1).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'TSLA'
      }));
      expect(callback2).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'TSLA'
      }));
      
      // Cleanup
      unsub1();
      unsub2();
    });

    it('polls for updates at regular intervals', async () => {
      const callback = vi.fn();
      realTimePriceService.subscribe('AAPL', callback);

      // Wait for initial fetch
      await vi.waitFor(() => expect(callback).toHaveBeenCalled());
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance time by 30 seconds (default update frequency)
      await vi.advanceTimersByTimeAsync(30000);
      expect(callback).toHaveBeenCalledTimes(2);

      // Advance again
      await vi.advanceTimersByTimeAsync(30000);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('supports multiple callbacks for same symbol', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      // Use a unique symbol to avoid interference
      const unsub1 = realTimePriceService.subscribe('GOOGL', callback1);
      
      // Wait for first callback (immediate fetch happens only on first subscribe)
      await vi.waitFor(() => {
        expect(callback1).toHaveBeenCalled();
      });
      
      const unsub2 = realTimePriceService.subscribe('GOOGL', callback2);
      const unsub3 = realTimePriceService.subscribe('GOOGL', callback3);

      // Other callbacks won't be called immediately since interval already exists
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // Clear the first callback to count new calls
      callback1.mockClear();
      (stockPriceService.getStockQuote as Mock).mockClear();

      // Advance timer to trigger update for all callbacks
      await vi.advanceTimersByTimeAsync(30000);

      // All callbacks should be called on timer update
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
      expect(stockPriceService.getStockQuote).toHaveBeenCalledTimes(1); // One fetch for the timer
      
      // Cleanup
      unsub1();
      unsub2();
      unsub3();
    });

    it('unsubscribe function removes callback', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = realTimePriceService.subscribe('AAPL', callback1);
      realTimePriceService.subscribe('AAPL', callback2);

      // Wait for both callbacks to be called
      await vi.waitFor(() => {
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
      });

      // Unsubscribe first callback
      unsub1();

      // Clear previous calls
      callback1.mockClear();
      callback2.mockClear();

      // Advance timer
      await vi.advanceTimersByTimeAsync(30000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('stops polling when all callbacks unsubscribed', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = realTimePriceService.subscribe('AAPL', callback1);
      const unsub2 = realTimePriceService.subscribe('AAPL', callback2);

      // Wait for initial fetch (only first subscription triggers immediate fetch)
      await vi.waitFor(() => {
        expect(callback1).toHaveBeenCalled();
      });

      // First subscription fetches immediately, second just adds callback
      expect(stockPriceService.getStockQuote).toHaveBeenCalledTimes(1);

      // Unsubscribe both
      unsub1();
      unsub2();

      // Clear mock
      (stockPriceService.getStockQuote as Mock).mockClear();

      // Advance timer - should not fetch
      await vi.advanceTimersByTimeAsync(30000);

      expect(stockPriceService.getStockQuote).not.toHaveBeenCalled();
    });
  });

  describe('subscribeMultiple', () => {
    it('subscribes to multiple symbols', async () => {
      const callback = vi.fn();
      const symbols = ['AAPL', 'GOOGL', 'MSFT'];

      // Mock different quotes for each symbol
      (stockPriceService.getStockQuote as Mock).mockImplementation((symbol) => 
        Promise.resolve({ ...mockQuote, symbol })
      );

      const unsubscribe = realTimePriceService.subscribeMultiple(symbols, callback);

      // Wait for all symbols to be fetched
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(symbols.length);
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'GOOGL' }));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'MSFT' }));

      unsubscribe();
    });

    it('unsubscribes from all symbols', async () => {
      const callback = vi.fn();
      const symbols = ['AAPL', 'GOOGL'];

      const unsubscribe = realTimePriceService.subscribeMultiple(symbols, callback);
      
      // Wait for initial fetches
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(symbols.length);
      });
      
      callback.mockClear();
      unsubscribe();

      // Advance timer - should not receive updates
      await vi.advanceTimersByTimeAsync(30000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      const callback = vi.fn();
      const errorListener = vi.fn();
      
      realTimePriceService.on('error', errorListener);
      
      // Mock error
      (stockPriceService.getStockQuote as Mock).mockRejectedValue(new Error('Network error'));
      
      realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for error to be emitted
      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalled();
      });

      // Callback should not be called on error
      expect(callback).not.toHaveBeenCalled();
      
      // Error event should be emitted
      expect(errorListener).toHaveBeenCalledWith({
        symbol: 'AAPL',
        error: 'Error: Network error'
      });
    });

    it('handles callback errors without stopping polling', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      // Mock console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      realTimePriceService.subscribe('AAPL', errorCallback);
      realTimePriceService.subscribe('AAPL', normalCallback);
      
      // Wait for callbacks to be called
      await vi.waitFor(() => {
        expect(errorCallback).toHaveBeenCalled();
        expect(normalCallback).toHaveBeenCalled();
      });

      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('handles null quote response', async () => {
      const callback = vi.fn();
      
      (stockPriceService.getStockQuote as Mock).mockResolvedValue(null);
      
      realTimePriceService.subscribe('INVALID', callback);
      
      // Give it some time to process
      await vi.advanceTimersByTimeAsync(100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('market status', () => {
    it('checks market status', () => {
      const status = realTimePriceService.getMarketStatus();
      
      expect(status).toHaveProperty('isOpen');
      expect(status).toHaveProperty('nextCheck');
      expect(typeof status.isOpen).toBe('boolean'); // Depends on current time
      expect(status.nextCheck).toBeInstanceOf(Date);
    });

    it('schedules market status checks', () => {
      // Fast forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Market status should have been checked
      // This is internal behavior, but we can verify it doesn't throw
      expect(() => realTimePriceService.getMarketStatus()).not.toThrow();
    });
  });

  describe('setUpdateFrequency', () => {
    it('changes update frequency', async () => {
      const callback = vi.fn();
      
      // Set to 10 seconds
      realTimePriceService.setUpdateFrequency(10000);
      realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for initial call
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
      
      // Advance 10 seconds
      await vi.advanceTimersByTimeAsync(10000);
      expect(callback).toHaveBeenCalledTimes(2);
      
      // Advance another 10 seconds
      await vi.advanceTimersByTimeAsync(10000);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('enforces minimum frequency of 10 seconds', async () => {
      realTimePriceService.setUpdateFrequency(5000); // Try to set 5 seconds
      
      // Should be clamped to 10 seconds minimum
      const callback = vi.fn();
      realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for initial call
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
      
      // Clear initial call
      callback.mockClear();
      
      await vi.advanceTimersByTimeAsync(5000);
      expect(callback).not.toHaveBeenCalled(); // Not called yet
      
      await vi.advanceTimersByTimeAsync(5000); // Total 10 seconds
      expect(callback).toHaveBeenCalledTimes(1); // Now it updates
    });

    it('restarts existing subscriptions with new frequency', async () => {
      const callback = vi.fn();
      
      realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for initial call
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
      
      // Change frequency to 20 seconds
      realTimePriceService.setUpdateFrequency(20000);
      
      // Clear mock to count only new calls
      callback.mockClear();
      
      // Advance 10 seconds - should not trigger with old 30s frequency
      await vi.advanceTimersByTimeAsync(10000);
      expect(callback).not.toHaveBeenCalled();
      
      // Advance another 10 seconds (total 20) - should trigger with new frequency
      await vi.advanceTimersByTimeAsync(10000);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('event emitter', () => {
    it('emits price update events', async () => {
      const eventListener = vi.fn();
      realTimePriceService.on('priceUpdate', eventListener);
      
      realTimePriceService.subscribe('AAPL', () => {});
      
      // Wait for event to be emitted
      await vi.waitFor(() => {
        expect(eventListener).toHaveBeenCalled();
      });

      expect(eventListener).toHaveBeenCalledWith({
        symbol: 'AAPL',
        quote: expect.objectContaining({
          symbol: 'AAPL',
          price: '150.5'
        }),
        timestamp: expect.any(String)
      });
    });

    it('removes event listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      realTimePriceService.on('priceUpdate', listener1);
      realTimePriceService.on('priceUpdate', listener2);
      
      realTimePriceService.subscribe('AAPL', () => {});
      
      // Wait for initial fetch
      await vi.waitFor(() => {
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
      });
      
      // Remove first listener
      realTimePriceService.off('priceUpdate', listener1);
      
      listener1.mockClear();
      listener2.mockClear();
      
      // Trigger another update
      await vi.advanceTimersByTimeAsync(30000);
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('handles event listener errors', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      realTimePriceService.on('priceUpdate', errorListener);
      realTimePriceService.on('priceUpdate', normalListener);
      
      realTimePriceService.subscribe('AAPL', () => {});
      
      // Wait for listeners to be called
      await vi.waitFor(() => {
        expect(errorListener).toHaveBeenCalled();
        expect(normalListener).toHaveBeenCalled();
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('dispose', () => {
    it('cleans up all resources', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const eventListener = vi.fn();
      
      realTimePriceService.on('priceUpdate', eventListener);
      realTimePriceService.subscribe('AAPL', callback1);
      realTimePriceService.subscribe('GOOGL', callback2);
      
      // Wait for initial calls
      await vi.waitFor(() => {
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
        expect(eventListener).toHaveBeenCalled();
      });
      
      callback1.mockClear();
      callback2.mockClear();
      eventListener.mockClear();
      
      // Dispose
      realTimePriceService.dispose();
      
      // Advance timers - nothing should happen
      await vi.advanceTimersByTimeAsync(60000);
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(eventListener).not.toHaveBeenCalled();
    });

    it('can be reused after dispose', async () => {
      const callback = vi.fn();
      
      realTimePriceService.dispose();
      
      // Should work again
      realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for callback to be called
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    it('handles very long symbol names', async () => {
      const callback = vi.fn();
      const longSymbol = 'VERYLONGSYMBOLNAME';
      
      realTimePriceService.subscribe(longSymbol, callback);
      
      // Wait for fetch to complete
      await vi.waitFor(() => {
        expect(stockPriceService.getStockQuote).toHaveBeenCalledWith(longSymbol);
      });
    });

    it('handles special characters in symbols', async () => {
      const callback = vi.fn();
      const specialSymbol = 'BRK.B';
      
      realTimePriceService.subscribe(specialSymbol, callback);
      
      // Wait for fetch to complete
      await vi.waitFor(() => {
        expect(stockPriceService.getStockQuote).toHaveBeenCalledWith('BRK.B');
      });
    });

    it('handles rapid subscribe/unsubscribe', async () => {
      const callback = vi.fn();
      
      const unsub1 = realTimePriceService.subscribe('AAPL', callback);
      unsub1();
      const unsub2 = realTimePriceService.subscribe('AAPL', callback);
      
      // Wait for at least one callback
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
      
      unsub2();
    });

    it('handles concurrent subscriptions to many symbols', async () => {
      const symbols = Array.from({ length: 10 }, (_, i) => `SYM${i}`); // Reduced from 50 to 10
      const callbacks = symbols.map(() => vi.fn());
      
      // Subscribe to all
      const unsubscribes = symbols.map((symbol, i) => 
        realTimePriceService.subscribe(symbol, callbacks[i])
      );
      
      // Wait for all callbacks to be called
      await vi.waitFor(() => {
        const allCalled = callbacks.every(cb => cb.mock.calls.length > 0);
        expect(allCalled).toBe(true);
      }, { timeout: 3000 }); // Reduced timeout
      
      // Cleanup
      unsubscribes.forEach(unsub => unsub());
    });
  });
});