/**
 * Error-handling tests for RealTimePriceService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RealTimePriceService,
  type RealTimePriceServiceOptions
} from '../realtimePriceService';
import * as stockPriceService from '../stockPriceService';

vi.mock('../stockPriceService', () => ({
  getStockQuote: vi.fn()
}));

const getStockQuoteMock = stockPriceService.getStockQuote as ReturnType<typeof vi.fn>;

const mockQuote = {
  symbol: 'AAPL',
  price: 150.5,
  change: 2.5,
  changePercent: 1.68,
  previousClose: 148,
  marketCap: 2_500_000_000_000,
  dayHigh: 151,
  dayLow: 149,
  fiftyTwoWeekHigh: 180,
  fiftyTwoWeekLow: 120,
  lastUpdated: new Date()
};

const createIntervalScheduler = () => {
  const snapshots: Array<() => void | Promise<void>> = [];
  return {
    setInterval(handler: () => void | Promise<void>) {
      snapshots.push(handler);
      return {} as NodeJS.Timeout;
    },
    clearInterval() {
      // no-op
    },
    async runAll() {
      const tasks = [...snapshots];
      snapshots.length = 0;
      for (const task of tasks) {
        await task();
      }
    }
  };
};

const buildService = (options: Partial<RealTimePriceServiceOptions> = {}) => {
  const scheduler = createIntervalScheduler();
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  };
  const service = new RealTimePriceService({
    defaultUpdateFrequency: 50,
    enableMarketStatusCheck: false,
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    logger,
    ...options
  });
  return { service, scheduler, logger };
};

describe('RealTimePriceService - error handling', () => {
  let service: RealTimePriceService;
  let scheduler: ReturnType<typeof createIntervalScheduler>;
  let logger: ReturnType<typeof buildService>['logger'];

  const resetQuoteMock = () => {
    getStockQuoteMock.mockReset();
    getStockQuoteMock.mockImplementation((symbol: string) =>
      Promise.resolve({ ...mockQuote, symbol })
    );
  };

  beforeEach(() => {
    resetQuoteMock();
    ({ service, scheduler, logger } = buildService());
  });

  afterEach(() => {
    service.dispose();
  });

  it('emits error event when fetch fails', async () => {
    const callback = vi.fn();
    const errorListener = vi.fn();

    service.on('error', errorListener);
    getStockQuoteMock.mockRejectedValue(new Error('Network error'));

    service.subscribe('AAPL', callback);

    await vi.waitFor(() => expect(errorListener).toHaveBeenCalled());
    expect(callback).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith({
      symbol: 'AAPL',
      error: 'Error: Network error'
    });
  });

  it('swallows callback errors but keeps polling', async () => {
    const errorCallback = vi.fn(() => {
      throw new Error('Callback error');
    });
    const normalCallback = vi.fn();

    service.subscribe('AAPL', errorCallback);
    service.subscribe('AAPL', normalCallback);

    await vi.waitFor(() => {
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    expect(logger.error).toHaveBeenCalled();
  });

  it('ignores null quotes', async () => {
    const callback = vi.fn();
    getStockQuoteMock.mockResolvedValue(null);

    service.subscribe('INVALID', callback);

    await scheduler.runAll();
    expect(callback).not.toHaveBeenCalled();
  });
});
