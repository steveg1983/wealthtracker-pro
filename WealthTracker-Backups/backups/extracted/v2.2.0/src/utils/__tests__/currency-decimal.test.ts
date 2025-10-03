import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertCurrency, getExchangeRates } from '../currency-decimal';

const origFetch = global.fetch;

// Type definition for fetch mock
type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('currency-decimal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = origFetch;
  });

  it('converts GBP to USD using serverless rates', async () => {
    global.fetch = vi.fn<FetchMock>(async (url) => {
      if (String(url).includes('/api/exchange-rates')) {
        return {
          ok: true,
          json: async () => ({ rates: { GBP: 1, USD: 1.2 } }),
        } as Response;
      }
      throw new Error('Unexpected fetch: ' + url);
    }) as FetchMock;

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(100, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(120, 5);
  });

  it('falls back to upstream when serverless fails', async () => {
    let first = true;
    global.fetch = vi.fn<FetchMock>(async (url) => {
      if (String(url).includes('/api/exchange-rates') && first) {
        first = false;
        return { ok: false, json: async () => ({}) } as Response;
      }
      if (String(url).includes('api.exchangerate-api.com')) {
        return {
          ok: true,
          json: async () => ({ rates: { GBP: 1, USD: 1.2 } }),
        } as Response;
      }
      throw new Error('Unexpected fetch: ' + url);
    }) as FetchMock;

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(200, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(240, 5);
  });
});

