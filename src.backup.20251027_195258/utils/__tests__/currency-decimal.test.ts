import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertCurrency, getExchangeRates } from '../currency-decimal';

const origFetch = global.fetch;

const createJsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

const mockFetch = (handler: typeof fetch) => {
  global.fetch = vi.fn<typeof fetch>(handler);
};

describe('currency-decimal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = origFetch;
  });

  it('converts GBP to USD using serverless rates', async () => {
    mockFetch(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/exchange-rates')) {
        return createJsonResponse({ rates: { GBP: 1, USD: 1.2 } });
      }
      throw new Error(`Unexpected fetch: ${urlString}`);
    });

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(100, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(120, 5);
  });

  it('falls back to upstream when serverless fails', async () => {
    let first = true;
    mockFetch(async (url) => {
      const urlString = String(url);
      if (urlString.includes('/api/exchange-rates') && first) {
        first = false;
        return createJsonResponse({}, { status: 500 });
      }
      if (urlString.includes('api.exchangerate-api.com')) {
        return createJsonResponse({ rates: { GBP: 1, USD: 1.2 } });
      }
      throw new Error(`Unexpected fetch: ${urlString}`);
    });

    const rates = await getExchangeRates();
    expect(rates.USD).toBe(1.2);

    const result = await convertCurrency(200, 'GBP', 'USD');
    expect(Number(result)).toBeCloseTo(240, 5);
  });
});
