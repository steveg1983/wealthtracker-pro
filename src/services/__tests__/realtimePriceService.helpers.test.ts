/**
 * Pure helper tests for RealTimePriceService.
 */

import { describe, it, expect } from 'vitest';
import { isMarketOpenAt, clampUpdateFrequency } from '../realtimePriceService';

const dateStub = (options: { day: number; hour: number; minute: number; offset: number }): Date => {
  const { day, hour, minute, offset } = options;
  return {
    getDay: () => day,
    getHours: () => hour,
    getMinutes: () => minute,
    getTimezoneOffset: () => offset
  } as unknown as Date;
};

describe('RealTimePriceService helpers', () => {
  describe('isMarketOpenAt', () => {
    it('returns true during US market hours', () => {
      const date = dateStub({ day: 2, hour: 10, minute: 0, offset: 300 });
      expect(isMarketOpenAt(date)).toBe(true);
    });

    it('returns false outside market hours', () => {
      const date = dateStub({ day: 2, hour: 20, minute: 0, offset: 300 });
      expect(isMarketOpenAt(date)).toBe(false);
    });

    it('returns false on weekend', () => {
      const date = dateStub({ day: 6, hour: 10, minute: 0, offset: 300 });
      expect(isMarketOpenAt(date)).toBe(false);
    });
  });

  describe('clampUpdateFrequency', () => {
    it('keeps value when above minimum', () => {
      expect(clampUpdateFrequency(20000)).toBe(20000);
    });

    it('clamps below minimum', () => {
      expect(clampUpdateFrequency(5000)).toBe(10000);
    });
  });
});
