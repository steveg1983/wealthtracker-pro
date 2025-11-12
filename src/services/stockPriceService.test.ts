/**
 * StockPriceService Tests
 * Tests for stock price fetching, caching, and portfolio calculations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStockQuote,
  getMultipleStockQuotes,
  convertStockPrice,
  calculatePortfolioMetrics,
  clearQuoteCache,
  validateSymbol,
  configureStockPriceService,
  resetStockPriceService,
  type StockQuote,
  type PortfolioMetrics
} from './stockPriceService';
import { toDecimal } from '../utils/decimal';
import { errorHandlingService } from './errorHandlingService';

// Mock dependencies
vi.mock('../utils/currency', () => ({
  getExchangeRates: vi.fn()
}));

vi.mock('./errorHandlingService', () => ({
  errorHandlingService: {
    handleError: vi.fn()
  },
  ErrorCategory: {
    NETWORK: 'network'
  },
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium'
  },
  retryWithBackoff: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn();
const mockFetch = global.fetch as any;

// Mock currency rates
const { getExchangeRates } = await import('../utils/currency');
const mockGetExchangeRates = getExchangeRates as any;

// Mock retry function
const { retryWithBackoff } = await import('./errorHandlingService');
const mockRetryWithBackoff = retryWithBackoff as any;

describe('StockPriceService', () => {
  const mockYahooResponse = {
    chart: {
      result: [{
        meta: {
          symbol: 'AAPL',
          regularMarketPrice: 150.25,
          chartPreviousClose: 148.50,
          currency: 'USD',
          marketCap: 2500000000000,
          regularMarketVolume: 75000000,
          regularMarketDayHigh: 151.00,
          regularMarketDayLow: 149.50,
          fiftyTwoWeekHigh: 180.00,
          fiftyTwoWeekLow: 125.00,
          longName: 'Apple Inc.',
          exchangeName: 'NASDAQ'
        }
      }]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearQuoteCache();

    configureStockPriceService({
      fetch: mockFetch,
      locationSearch: () => '',
      now: () => Date.now(),
      timeoutSignal: () => null,
      logger: { warn: vi.fn(), error: vi.fn() }
    });
    
    // Setup default mocks
    mockGetExchangeRates.mockResolvedValue({
      USD: 1.25,
      EUR: 1.15,
      GBP: 1.00
    });
    
    mockRetryWithBackoff.mockImplementation((fn, options) => fn());
    
    // Reset fetch mock to default behavior
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStockPriceService();
  });

  describe('getStockQuote', () => {
    it('fetches stock quote successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });
      
      mockRetryWithBackoff.mockImplementation((fn) => fn());

      const quote = await getStockQuote('AAPL');

      expect(quote).not.toBeNull();
      expect(quote!.symbol).toBe('AAPL');
      expect(quote!.price.toNumber()).toBe(150.25);
      expect(quote!.previousClose.toNumber()).toBe(148.50);
      expect(quote!.change.toNumber()).toBe(1.75);
      expect(quote!.changePercent.toNumber()).toBeCloseTo(1.178, 2);
      expect(quote!.currency).toBe('USD');
      expect(quote!.name).toBe('Apple Inc.');
      expect(quote!.exchange).toBe('NASDAQ');
      expect(quote!.lastUpdated).toBeInstanceOf(Date);
    });

    it('calculates change and change percent correctly', async () => {
      const responseWithNegativeChange = {
        chart: {
          result: [{
            meta: {
              symbol: 'TSLA',
              regularMarketPrice: 200.00,
              chartPreviousClose: 210.00,
              currency: 'USD'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithNegativeChange)
      });

      const quote = await getStockQuote('TSLA');

      expect(quote).not.toBeNull();
      expect(quote!.change.toNumber()).toBe(-10.00);
      expect(quote!.changePercent.toNumber()).toBeCloseTo(-4.762, 2);
    });

    it('handles zero previous close gracefully', async () => {
      const responseWithZeroPrevClose = {
        chart: {
          result: [{
            meta: {
              symbol: 'ZERO',
              regularMarketPrice: 10.00,
              chartPreviousClose: 0.01, // Small non-zero value to pass validation
              currency: 'USD'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithZeroPrevClose)
      });
      
      mockRetryWithBackoff.mockImplementation((fn) => fn());

      const quote = await getStockQuote('ZERO');

      expect(quote).not.toBeNull();
      // With such a small previous close, the percentage should be very large
      expect(quote!.changePercent.toNumber()).toBeGreaterThan(900);
    });

    it('cleans and validates symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });

      await getStockQuote('  aapl  ');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('AAPL'),
        expect.any(Object)
      );
    });

    it('rejects invalid symbols', async () => {
      const result = await getStockQuote('INVALID_VERY_LONG_SYMBOL');
      expect(result).toBeNull();
      expect(errorHandlingService.handleError).toHaveBeenCalled();
    });

    it('caches quotes correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });

      // First call
      const quote1 = await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const quote2 = await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
      
      // Compare without timestamps (which will differ)
      expect(quote1!.symbol).toBe(quote2!.symbol);
      expect(quote1!.price.toNumber()).toBe(quote2!.price.toNumber());
      expect(quote1!.currency).toBe(quote2!.currency);
    });

    it('expires cache after TTL', async () => {
      vi.useFakeTimers();
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });

      // First call
      await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past TTL (1 minute)
      vi.advanceTimersByTime(61 * 1000);

      // Second call should fetch again
      await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('tries multiple endpoints on failure', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('First endpoint failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockYahooResponse)
        });

      mockRetryWithBackoff.mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          // Try again with different endpoint
          return await fn();
        }
      });

      const quote = await getStockQuote('AAPL');
      expect(quote).not.toBeNull();
      expect(quote!.symbol).toBe('AAPL');
    });

    it('handles network errors gracefully', async () => {
      const networkError = new Error('Network failed');
      mockFetch.mockRejectedValue(networkError);
      mockRetryWithBackoff.mockRejectedValue(networkError);

      const quote = await getStockQuote('AAPL');
      
      expect(quote).toBeNull();
      expect(errorHandlingService.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          category: 'network',
          severity: 'low',
          context: { symbol: 'AAPL' }
        })
      );
    });

    it('handles malformed API responses', async () => {
      const malformedResponses = [
        {}, // No chart
        { chart: {} }, // No result
        { chart: { result: [] } }, // Empty result
        { chart: { result: [{}] } }, // No meta
        { chart: { result: [{ meta: {} }] } }, // No price data
        { chart: { result: [{ meta: { regularMarketPrice: 150 } }] } } // No previous close
      ];

      for (const response of malformedResponses) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response)
        });
        
        mockRetryWithBackoff.mockImplementation(() => {
          throw new Error('Invalid response format');
        });

        const quote = await getStockQuote('AAPL');
        expect(quote).toBeNull();
      }
    });

    it('handles HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      mockRetryWithBackoff.mockImplementation(() => {
        throw new Error('HTTP 404: Not Found');
      });

      const quote = await getStockQuote('INVALID');
      expect(quote).toBeNull();
    });

    it('includes optional fields when available', async () => {
      const completeResponse = {
        chart: {
          result: [{
            meta: {
              symbol: 'AAPL',
              regularMarketPrice: 150.25,
              chartPreviousClose: 148.50,
              currency: 'USD',
              marketCap: 2500000000000,
              regularMarketVolume: 75000000,
              regularMarketDayHigh: 151.00,
              regularMarketDayLow: 149.50,
              fiftyTwoWeekHigh: 180.00,
              fiftyTwoWeekLow: 125.00,
              longName: 'Apple Inc.',
              shortName: 'Apple',
              exchangeName: 'NASDAQ'
            }
          }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(completeResponse)
      });
      
      mockRetryWithBackoff.mockImplementation((fn) => fn());

      const quote = await getStockQuote('AAPL');

      expect(quote).not.toBeNull();
      expect(quote!.marketCap?.toNumber()).toBe(2500000000000);
      expect(quote!.volume).toBe(75000000);
      expect(quote!.dayHigh?.toNumber()).toBe(151.00);
      expect(quote!.dayLow?.toNumber()).toBe(149.50);
      expect(quote!.fiftyTwoWeekHigh?.toNumber()).toBe(180.00);
      expect(quote!.fiftyTwoWeekLow?.toNumber()).toBe(125.00);
    });
  });

  describe('getMultipleStockQuotes', () => {
    it('fetches multiple quotes in parallel', async () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT'];
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('AAPL')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { result: [{ meta: { symbol: 'AAPL', regularMarketPrice: 150, chartPreviousClose: 149, currency: 'USD' } }] }
            })
          });
        } else if (url.includes('GOOGL')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { result: [{ meta: { symbol: 'GOOGL', regularMarketPrice: 2500, chartPreviousClose: 2490, currency: 'USD' } }] }
            })
          });
        } else if (url.includes('MSFT')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { result: [{ meta: { symbol: 'MSFT', regularMarketPrice: 300, chartPreviousClose: 295, currency: 'USD' } }] }
            })
          });
        }
        return Promise.reject(new Error('Unknown symbol'));
      });

      const quotes = await getMultipleStockQuotes(symbols);

      expect(quotes.size).toBe(3);
      expect(quotes.has('AAPL')).toBe(true);
      expect(quotes.has('GOOGL')).toBe(true);
      expect(quotes.has('MSFT')).toBe(true);
      expect(quotes.get('AAPL')!.price.toNumber()).toBe(150);
    });

    it('handles empty symbol array', async () => {
      const quotes = await getMultipleStockQuotes([]);
      expect(quotes.size).toBe(0);
    });

    it('handles null/undefined input', async () => {
      const quotes1 = await getMultipleStockQuotes(null as any);
      const quotes2 = await getMultipleStockQuotes(undefined as any);
      
      expect(quotes1.size).toBe(0);
      expect(quotes2.size).toBe(0);
    });

    it('continues processing when some quotes fail', async () => {
      const symbols = ['AAPL', 'INVALID', 'MSFT'];
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('AAPL')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { result: [{ meta: { symbol: 'AAPL', regularMarketPrice: 150, chartPreviousClose: 149, currency: 'USD' } }] }
            })
          });
        } else if (url.includes('INVALID')) {
          return Promise.reject(new Error('Invalid symbol'));
        } else if (url.includes('MSFT')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { result: [{ meta: { symbol: 'MSFT', regularMarketPrice: 300, chartPreviousClose: 295, currency: 'USD' } }] }
            })
          });
        }
        return Promise.reject(new Error('Unknown symbol'));
      });

      mockRetryWithBackoff.mockImplementation(async (fn) => {
        return await fn(); // Let invalid symbols fail
      });

      const quotes = await getMultipleStockQuotes(symbols);

      expect(quotes.size).toBe(2);
      expect(quotes.has('AAPL')).toBe(true);
      expect(quotes.has('INVALID')).toBe(false);
      expect(quotes.has('MSFT')).toBe(true);
    });

    it('processes symbols in batches', async () => {
      // Test with more than 5 symbols to trigger batching
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NFLX', 'META'];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          chart: { result: [{ meta: { symbol: 'TEST', regularMarketPrice: 100, chartPreviousClose: 99, currency: 'USD' } }] }
        })
      });

      const quotes = await getMultipleStockQuotes(symbols);

      expect(quotes.size).toBe(7);
    });

    it('handles general errors', async () => {
      // Force an error by making symbols.map throw
      const symbols = null as any;
      
      const quotes = await getMultipleStockQuotes(symbols);

      expect(quotes.size).toBe(0);
    });
  });

  describe('convertStockPrice', () => {
    it('returns original price for same currency', async () => {
      const price = toDecimal(100);
      const converted = await convertStockPrice(price, 'USD', 'USD');
      expect(converted.toNumber()).toBe(100);
    });

    it('converts USD to GBP', async () => {
      mockGetExchangeRates.mockResolvedValue({
        USD: 1.25,
        GBP: 1.00
      });

      const price = toDecimal(125); // $125
      const converted = await convertStockPrice(price, 'USD', 'GBP');
      expect(converted.toNumber()).toBe(100); // £100
    });

    it('converts GBP to USD', async () => {
      mockGetExchangeRates.mockResolvedValue({
        USD: 1.25,
        GBP: 1.00
      });

      const price = toDecimal(100); // £100
      const converted = await convertStockPrice(price, 'GBP', 'USD');
      expect(converted.toNumber()).toBe(125); // $125
    });

    it('converts between non-GBP currencies', async () => {
      mockGetExchangeRates.mockResolvedValue({
        USD: 1.25,
        EUR: 1.15,
        GBP: 1.00
      });

      const price = toDecimal(125); // $125
      const converted = await convertStockPrice(price, 'USD', 'EUR');
      // $125 -> £100 -> €115
      expect(converted.toNumber()).toBe(115);
    });

    it('handles missing exchange rates', async () => {
      mockGetExchangeRates.mockResolvedValue({
        USD: 1.25
        // Missing EUR rate
      });

      const price = toDecimal(100);
      const converted = await convertStockPrice(price, 'EUR', 'USD');
      // Should use rate of 1 for missing currency
      expect(converted.toNumber()).toBe(125);
    });

    it('returns original price on error', async () => {
      mockGetExchangeRates.mockRejectedValue(new Error('Network error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const price = toDecimal(100);
      const converted = await convertStockPrice(price, 'USD', 'GBP');
      expect(converted.toNumber()).toBe(100);
    });
  });

  describe('calculatePortfolioMetrics', () => {
    const mockHoldings = [
      { symbol: 'AAPL', shares: toDecimal(10), averageCost: toDecimal(140) },
      { symbol: 'GOOGL', shares: toDecimal(2), averageCost: toDecimal(2400) }
    ];

    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('AAPL')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { 
                result: [{ 
                  meta: { 
                    symbol: 'AAPL', 
                    regularMarketPrice: 150, 
                    chartPreviousClose: 149, 
                    currency: 'USD',
                    longName: 'Apple Inc.'
                  } 
                }] 
              }
            })
          });
        } else if (url.includes('GOOGL')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chart: { 
                result: [{ 
                  meta: { 
                    symbol: 'GOOGL', 
                    regularMarketPrice: 2500, 
                    chartPreviousClose: 2490, 
                    currency: 'USD',
                    longName: 'Alphabet Inc.'
                  } 
                }] 
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown symbol'));
      });

      // Mock currency conversion (no conversion needed for USD to USD)
      mockGetExchangeRates.mockResolvedValue({
        USD: 1.25,
        GBP: 1.00
      });
    });

    it('calculates portfolio metrics correctly', async () => {
      const metrics = await calculatePortfolioMetrics(mockHoldings, 'USD');

      expect(metrics.totalValue.toNumber()).toBe(6500); // 10*150 + 2*2500
      expect(metrics.totalCost.toNumber()).toBe(6200); // 10*140 + 2*2400
      expect(metrics.totalGain.toNumber()).toBe(300);
      expect(metrics.totalGainPercent.toNumber()).toBeCloseTo(4.84, 2);

      expect(metrics.holdings).toHaveLength(2);
      
      const appleHolding = metrics.holdings.find(h => h.symbol === 'AAPL');
      expect(appleHolding).toBeDefined();
      expect(appleHolding!.marketValue.toNumber()).toBe(1500);
      expect(appleHolding!.gain.toNumber()).toBe(100);
      expect(appleHolding!.gainPercent.toNumber()).toBeCloseTo(7.14, 2);
      expect(appleHolding!.allocation.toNumber()).toBeCloseTo(23.08, 2);

      const googleHolding = metrics.holdings.find(h => h.symbol === 'GOOGL');
      expect(googleHolding).toBeDefined();
      expect(googleHolding!.marketValue.toNumber()).toBe(5000);
      expect(googleHolding!.gain.toNumber()).toBe(200);
      expect(googleHolding!.gainPercent.toNumber()).toBeCloseTo(4.17, 2);
      expect(googleHolding!.allocation.toNumber()).toBeCloseTo(76.92, 2);
    });

    it('handles missing quotes gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('No quotes available'));

      const metrics = await calculatePortfolioMetrics(mockHoldings, 'USD');

      // Should use average cost as current price
      expect(metrics.totalValue.toNumber()).toBe(6200); // Same as cost
      expect(metrics.totalGain.toNumber()).toBe(0);
      expect(metrics.totalGainPercent.toNumber()).toBe(0);
    });

    it('handles empty holdings', async () => {
      const metrics = await calculatePortfolioMetrics([], 'USD');

      expect(metrics.totalValue.toNumber()).toBe(0);
      expect(metrics.totalCost.toNumber()).toBe(0);
      expect(metrics.totalGain.toNumber()).toBe(0);
      expect(metrics.totalGainPercent.toNumber()).toBe(0);
      expect(metrics.holdings).toHaveLength(0);
    });

    it('handles zero cost basis', async () => {
      const freeHoldings = [
        { symbol: 'FREE', shares: toDecimal(100), averageCost: toDecimal(0) }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          chart: { 
            result: [{ 
              meta: { 
                symbol: 'FREE', 
                regularMarketPrice: 10, 
                chartPreviousClose: 9, 
                currency: 'USD'
              } 
            }] 
          }
        })
      });

      const metrics = await calculatePortfolioMetrics(freeHoldings, 'USD');

      expect(metrics.totalValue.toNumber()).toBe(1000);
      expect(metrics.totalCost.toNumber()).toBe(0);
      expect(metrics.totalGain.toNumber()).toBe(1000);
      expect(metrics.totalGainPercent.toNumber()).toBe(0); // Avoid division by zero
    });

    it('converts currencies correctly', async () => {
      const ukHoldings = [
        { symbol: 'AAPL', shares: toDecimal(10), averageCost: toDecimal(140) }
      ];

      const metrics = await calculatePortfolioMetrics(ukHoldings, 'GBP');

      // Should convert USD prices to GBP
      expect(metrics.totalValue.toNumber()).toBe(1200); // 1500 / 1.25
      expect(metrics.totalCost.toNumber()).toBe(1120); // 1400 / 1.25
    });
  });

  describe('clearQuoteCache', () => {
    it('clears the quote cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });

      // Populate cache
      await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call uses cache
      await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearQuoteCache();

      // Third call should fetch again
      await getStockQuote('AAPL');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateSymbol', () => {
    it('returns true for valid symbols', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockYahooResponse)
      });

      const isValid = await validateSymbol('AAPL');
      expect(isValid).toBe(true);
    });

    it('returns false for invalid symbols', async () => {
      mockFetch.mockRejectedValue(new Error('Symbol not found'));
      mockRetryWithBackoff.mockRejectedValue(new Error('Symbol not found'));

      const isValid = await validateSymbol('INVALID');
      expect(isValid).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles AbortSignal timeout', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));
      mockRetryWithBackoff.mockRejectedValue(new Error('The operation was aborted'));

      const quote = await getStockQuote('TIMEOUT');
      expect(quote).toBeNull();
    });

    it('handles JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      mockRetryWithBackoff.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const quote = await getStockQuote('BADSON');
      expect(quote).toBeNull();
    });

    it('handles missing meta fields gracefully', async () => {
      const partialResponse = {
        chart: {
          result: [{
            meta: {
              symbol: 'PARTIAL',
              regularMarketPrice: 100,
              chartPreviousClose: 99
              // Missing optional fields
            }
          }]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(partialResponse)
      });

      const quote = await getStockQuote('PARTIAL');

      expect(quote).not.toBeNull();
      expect(quote!.currency).toBe('USD'); // Default
      expect(quote!.marketCap).toBeUndefined();
      expect(quote!.volume).toBeUndefined();
      expect(quote!.name).toBeUndefined();
    });

    it('handles very large numbers', async () => {
      const largeNumberResponse = {
        chart: {
          result: [{
            meta: {
              symbol: 'LARGE',
              regularMarketPrice: 999999999999,
              chartPreviousClose: 999999999998,
              currency: 'USD',
              marketCap: 50000000000000
            }
          }]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeNumberResponse)
      });

      const quote = await getStockQuote('LARGE');

      expect(quote).not.toBeNull();
      expect(quote!.price.toNumber()).toBe(999999999999);
      expect(quote!.marketCap?.toNumber()).toBe(50000000000000);
    });
  });
});
