/**
 * Subscription behaviour (single/multi) for RealTimePriceService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RealTimePriceService,
  type RealTimePriceServiceOptions,
  type PriceUpdate
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
  type Entry = { handler: () => void | Promise<void>; active: boolean };
  const entries: Entry[] = [];

  return {
    setInterval(handler: () => void | Promise<void>) {
      const entry: Entry = { handler, active: true };
      entries.push(entry);
      return entry as unknown as NodeJS.Timeout;
    },
    clearInterval(handle: NodeJS.Timeout) {
      const entry = handle as unknown as Entry;
      entry.active = false;
    },
    async runAll() {
      const tasks = [...entries];
      entries.length = 0;
      for (const task of tasks) {
        if (task.active) {
          await task.handler();
        }
      }
    }
  };
};

const buildService = (options: Partial<RealTimePriceServiceOptions> = {}) => {
  const scheduler = createIntervalScheduler();
  const service = new RealTimePriceService({
    defaultUpdateFrequency: 50,
    enableMarketStatusCheck: false,
    setIntervalFn: scheduler.setInterval,
    clearIntervalFn: scheduler.clearInterval,
    ...options
  });

  return { service, scheduler };
};

describe('RealTimePriceService - subscriptions', () => {
  let service: RealTimePriceService;
  let scheduler: ReturnType<typeof createIntervalScheduler>;

  const resetMocks = () => {
    getStockQuoteMock.mockReset();
    getStockQuoteMock.mockImplementation((symbol: string) =>
      Promise.resolve({ ...mockQuote, symbol })
    );
  };

  beforeEach(() => {
    resetMocks();
    const result = buildService();
    service = result.service;
    scheduler = result.scheduler;
  });

  afterEach(() => {
    service.dispose();
  });

  it('subscribes to price updates for a symbol', async () => {
    const callback = vi.fn();
    const unsubscribe = service.subscribe('AAPL', callback);

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());
    expect(callback).toHaveBeenCalledWith({
      symbol: 'AAPL',
      quote: mockQuote,
      timestamp: expect.any(Date)
    });

    unsubscribe();
  });

  it('normalizes symbols to uppercase', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsub1 = service.subscribe('tsla', callback1);
    await vi.waitFor(() => expect(callback1).toHaveBeenCalled());

    const unsub2 = service.subscribe('TSLA', callback2);
    expect(callback2).not.toHaveBeenCalled();

    callback1.mockClear();
    await scheduler.runAll();

    expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'TSLA' }));
    expect(callback2).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'TSLA' }));

    unsub1();
    unsub2();
  });

  it('supports multiple callbacks for same symbol', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();

    const unsub1 = service.subscribe('GOOGL', callback1);
    await vi.waitFor(() => expect(callback1).toHaveBeenCalled());

    const unsub2 = service.subscribe('GOOGL', callback2);
    const unsub3 = service.subscribe('GOOGL', callback3);
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();

    callback1.mockClear();
    getStockQuoteMock.mockClear();

    await scheduler.runAll();

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    expect(getStockQuoteMock).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
    unsub3();
  });

  it('unsubscribe function removes callback', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsub1 = service.subscribe('AAPL', callback1);
    service.subscribe('AAPL', callback2);

    await vi.waitFor(() => {
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    unsub1();
    callback1.mockClear();
    callback2.mockClear();

    await scheduler.runAll();

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('stops polling when all callbacks unsubscribed', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsub1 = service.subscribe('AAPL', callback1);
    const unsub2 = service.subscribe('AAPL', callback2);

    await vi.waitFor(() => expect(callback1).toHaveBeenCalled());
    expect(getStockQuoteMock).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
    getStockQuoteMock.mockClear();

    await scheduler.runAll();
    expect(getStockQuoteMock).not.toHaveBeenCalled();
  });

  it('subscribeMultiple wires up all symbols', async () => {
    const callback = vi.fn();
    const symbols = ['AAPL', 'GOOGL', 'MSFT'];

    const unsubscribe = service.subscribeMultiple(symbols, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(symbols.length));

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'GOOGL' }));
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'MSFT' }));

    unsubscribe();
  });

  it('unsubscribeMultiple stops updates', async () => {
    const callback = vi.fn();
    const symbols = ['AAPL', 'GOOGL'];

    const unsubscribe = service.subscribeMultiple(symbols, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(symbols.length));

    callback.mockClear();
    unsubscribe();

    await scheduler.runAll();
    expect(callback).not.toHaveBeenCalled();
  });
});
