import { describe, it, expect, vi } from 'vitest';
import { DividendService, type Dividend } from '../dividendService';

const createStorage = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    dump: () => Object.fromEntries(map.entries())
  };
};

const fixedNow = Date.UTC(2025, 0, 1);

const buildService = (overrides: {
  storage?: ReturnType<typeof createStorage>;
  randomValues?: number[];
} = {}) => {
  const storage = overrides.storage ?? createStorage();
  const randomValues = overrides.randomValues ?? [0.123456789];
  let randomIndex = 0;
  const logger = { warn: vi.fn(), error: vi.fn() };

  const service = new DividendService({
    storage,
    logger,
    now: () => fixedNow,
    random: () => {
      const value = randomValues[randomIndex] ?? randomValues[randomValues.length - 1];
      randomIndex += 1;
      return value;
    }
  });

  return { service, storage, logger };
};

const sampleDividend: Omit<Dividend, 'id'> = {
  investmentId: 'inv-1',
  accountId: 'acc-1',
  symbol: 'SAMP',
  amount: 120,
  amountPerShare: 1.2,
  shares: 100,
  currency: 'USD',
  paymentDate: new Date('2024-12-01T00:00:00Z'),
  exDividendDate: new Date('2024-11-28T00:00:00Z'),
  frequency: 'quarterly',
  type: 'regular',
  reinvested: false
};

describe('DividendService (deterministic)', () => {
  it('hydrates dividends from injected storage with proper Date conversion', () => {
    const storage = createStorage({
      wealthtracker_dividends: JSON.stringify([
        {
          ...sampleDividend,
          id: 'div-old',
          paymentDate: '2024-06-01T00:00:00.000Z',
          exDividendDate: '2024-05-29T00:00:00.000Z'
        }
      ])
    });

    const { service } = buildService({ storage });
    const [dividend] = service.getDividends();
    expect(dividend.paymentDate).toBeInstanceOf(Date);
    expect(dividend.exDividendDate).toBeInstanceOf(Date);
    expect(storage.getItem).toHaveBeenCalledWith('wealthtracker_dividends');
  });

  it('persists added dividends using injected storage, clock, and randomizer', () => {
    const { service, storage } = buildService({ randomValues: [0.42] });

    const created = service.addDividend(sampleDividend);
    const expectedId = `div-${fixedNow}-${Math.floor(0.42 * 1e9).toString(36)}`;
    expect(created.id).toBe(expectedId);
    expect(storage.setItem).toHaveBeenCalledWith(
      'wealthtracker_dividends',
      expect.stringContaining(`"id":"${expectedId}"`)
    );
  });

  it('uses injected clock for projections and persists yield updates', () => {
    const storage = createStorage();
    const { service } = buildService({ storage });
    service.addDividend(sampleDividend);

    const projections = service.getDividendProjections([{ symbol: 'SAMP', shares: 100, currentValue: 1000 }]);
    expect(projections).toHaveLength(1);
    expect(projections[0].nextPaymentDate.getTime()).toBeGreaterThan(fixedNow);

    service.updateYieldData('XYZ', 5.5);
    expect(storage.setItem).toHaveBeenCalledWith(
      'wealthtracker_yield_data',
      expect.stringContaining('"XYZ":5.5')
    );
  });
});
