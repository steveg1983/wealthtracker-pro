/**
 * Market status + frequency tests (no real timers) for RealTimePriceService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RealTimePriceService,
  type RealTimePriceServiceOptions
} from '../realtimePriceService';

const noopInterval = () => ({} as NodeJS.Timeout);
const noopClear = () => {};

const createService = (options: Partial<RealTimePriceServiceOptions> = {}) => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  };
  return new RealTimePriceService({
    defaultUpdateFrequency: 1000,
    marketStatusCheckIntervalMs: 200,
    enableMarketStatusCheck: false,
    setIntervalFn: noopInterval,
    clearIntervalFn: noopClear,
    logger,
    ...options
  });
};

// TODO: Re-enable when the realtime price service is refactored to avoid high memory usage.
describe.skip('RealTimePriceService - market + frequency', () => {
  let service: RealTimePriceService;

  afterEach(() => {
    service?.dispose();
  });

  describe('market status', () => {
    it('computes status snapshot', () => {
      service = createService({
        enableMarketStatusCheck: true,
        now: () => new Date('2025-01-21T15:00:00Z')
      });

      const status = service.getMarketStatus();
      expect(status).toHaveProperty('isOpen');
      expect(status.nextCheck).toBeInstanceOf(Date);
    });

    it('schedules periodic checks when enabled', () => {
      const setIntervalSpy = vi.fn(noopInterval);
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
      };

      service = new RealTimePriceService({
        enableMarketStatusCheck: true,
        marketStatusCheckIntervalMs: 200,
        now: () => new Date('2025-01-21T15:00:00Z'),
        setIntervalFn: setIntervalSpy,
        clearIntervalFn: noopClear,
        logger
      });

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 200);
    });
  });

  describe('setUpdateFrequency', () => {
    beforeEach(() => {
      service = createService();
    });

    it('sets custom frequency', () => {
      service.setUpdateFrequency(20000);
      expect(service['updateFrequency']).toBe(20000);
    });

    it('enforces minimum frequency', () => {
      service.setUpdateFrequency(5000);
      expect(service['updateFrequency']).toBe(10000);
    });

    it('restarts active subscriptions when frequency changes', () => {
      service['intervals'].set('AAPL', {} as NodeJS.Timeout);
      const stopSpy = vi.spyOn(service as any, 'stopPolling');
      const startSpy = vi.spyOn(service as any, 'startPolling');

      service.setUpdateFrequency(200);

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();

      stopSpy.mockRestore();
      startSpy.mockRestore();
    });
  });
});
