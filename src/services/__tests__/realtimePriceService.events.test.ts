/**
 * Event emitter behaviour for RealTimePriceService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealTimePriceService } from '../realtimePriceService';
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
  const entries: Array<() => void | Promise<void>> = [];
  return {
    setInterval(handler: () => void | Promise<void>) {
      entries.push(handler);
      return {} as NodeJS.Timeout;
    },
    clearInterval() {
      // no-op
    },
    async runAll() {
      const snapshot = [...entries];
      entries.length = 0;
      for (const entry of snapshot) {
        await entry();
      }
    }
  };
};

describe('RealTimePriceService - events', () => {
  let service: RealTimePriceService;
  let scheduler: ReturnType<typeof createIntervalScheduler>;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    scheduler = createIntervalScheduler();
    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };
    service = new RealTimePriceService({
      defaultUpdateFrequency: 50,
      enableMarketStatusCheck: false,
      setIntervalFn: scheduler.setInterval,
      clearIntervalFn: scheduler.clearInterval,
      logger
    });

    getStockQuoteMock.mockReset();
    getStockQuoteMock.mockImplementation((symbol: string) =>
      Promise.resolve({ ...mockQuote, symbol })
    );
  });

  afterEach(() => {
    service.dispose();
  });

  it('emits priceUpdate events', async () => {
    const eventListener = vi.fn();
    service.on('priceUpdate', eventListener);

    service.subscribe('AAPL', () => {});
    await vi.waitFor(() => expect(eventListener).toHaveBeenCalled());

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

    service.on('priceUpdate', listener1);
    service.on('priceUpdate', listener2);
    service.subscribe('AAPL', () => {});

    await vi.waitFor(() => {
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    service.off('priceUpdate', listener1);
    listener1.mockClear();
    listener2.mockClear();

    await scheduler.runAll();

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('handles event listener errors', async () => {
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const normalListener = vi.fn();

    service.on('priceUpdate', errorListener);
    service.on('priceUpdate', normalListener);
    service.subscribe('AAPL', () => {});

    await vi.waitFor(() => {
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });

    expect(logger.error).toHaveBeenCalled();
  });

  it('dispose removes listeners', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const eventListener = vi.fn();

    service.on('priceUpdate', eventListener);
    service.subscribe('AAPL', callback1);
    service.subscribe('GOOGL', callback2);

    await vi.waitFor(() => {
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(eventListener).toHaveBeenCalled();
    });

    service.dispose();
    callback1.mockClear();
    callback2.mockClear();
    eventListener.mockClear();

    await scheduler.runAll();

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    expect(eventListener).not.toHaveBeenCalled();
  });
});
