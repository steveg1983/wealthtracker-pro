import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertCurrency, getExchangeRates } from '../currency-decimal';

const origFetch = global.fetch;

describe('currency-decimal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = origFetch as any;
  });

  it('converts GBP to USD using serverless rates', async () => {
    global.fetch = vi.fn(async (url: any) => {
      if (String(url).includes('/api/exchange-rates')) {
        return {
          ok: true,
          json: async () => ({ rates: { GBP: 1, USD: 1.2 } }),
        } as any;
      }
      throw new Error('Unexpected fetch: ' + url);
    }) as any;

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(100, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(120, 5);
  });

  it('falls back to upstream when serverless fails', async () => {
    let first = true;
    global.fetch = vi.fn(async (url: any) => {
      if (String(url).includes('/api/exchange-rates') && first) {
        first = false;
        return { ok: false, json: async () => ({}) } as any;
      }
      if (String(url).includes('api.exchangerate-api.com')) {
        return {
          ok: true,
          json: async () => ({ rates: { GBP: 1, USD: 1.2 } }),
        } as any;
      }
      throw new Error('Unexpected fetch: ' + url);
    }) as any;

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(200, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(240, 5);
  });
});

