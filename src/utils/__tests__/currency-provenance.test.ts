import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Where a converted figure's rates came from.
 *
 * The gap this closes: a failed fetch fell back to a hardcoded table of
 * approximate rates and said nothing, so a total built on a guess was
 * indistinguishable from one built on a live quote.
 *
 * Every test re-imports the module through `vi.resetModules()` because the
 * rates cache is module state, and a test that inherited another's cache would
 * be asserting on the wrong fetch.
 */

const mockRates = {
  GBP: 1,
  USD: 1.25,
  EUR: 1.2,
};

const freshModule = async () => {
  vi.resetModules();
  return import('../currency-decimal');
};

const okResponse = () => ({
  ok: true,
  json: () => Promise.resolve({ base: 'GBP', rates: mockRates }),
});

describe('rates provenance', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRatesProvenance', () => {
    it('is null before anything has been fetched', async () => {
      const { getRatesProvenance } = await freshModule();
      // A surface that has converted nothing has no provenance to show,
      // because it has used no rates.
      expect(getRatesProvenance()).toBeNull();
    });

    it('reports a live quote as api', async () => {
      const { getExchangeRates, getRatesProvenance } = await freshModule();
      mockFetch.mockResolvedValueOnce(okResponse());

      await getExchangeRates();

      const provenance = getRatesProvenance();
      expect(provenance?.source).toBe('api');
      expect(provenance?.asOf).toBeInstanceOf(Date);
    });

    it('reports a failed fetch as fallback', async () => {
      const { getExchangeRates, getRatesProvenance } = await freshModule();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('offline'));

      await getExchangeRates();

      expect(getRatesProvenance()?.source).toBe('fallback');
      consoleErrorSpy.mockRestore();
    });

    it('reports a non-ok response as fallback too', async () => {
      const { getExchangeRates, getRatesProvenance } = await freshModule();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await getExchangeRates();

      expect(getRatesProvenance()?.source).toBe('fallback');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('a fallback is retried sooner than a live quote is refreshed', () => {
    it('holds a live quote for the full hour', async () => {
      const { getExchangeRates } = await freshModule();
      mockFetch.mockResolvedValue(okResponse());

      // One request per provider (api, then the ECB overlay).
      await getExchangeRates();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // 30 minutes later: still inside the hour, so no further requests.
      const realNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(realNow + 30 * 60 * 1000);
      await getExchangeRates();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries a fallback after five minutes, not after an hour', async () => {
      // Caching a failure for a full hour leaves every total labelled
      // "approximate" long after the network came back, which turns a real
      // warning into furniture.
      const { getExchangeRates, getRatesProvenance } = await freshModule();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('offline'));

      await getExchangeRates();
      expect(getRatesProvenance()?.source).toBe('fallback');
      // Both providers were attempted before falling back.
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Six minutes later the provider is reachable again.
      const realNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(realNow + 6 * 60 * 1000);
      mockFetch.mockResolvedValueOnce(okResponse());

      await getExchangeRates();

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(getRatesProvenance()?.source).toBe('api');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('convertMultipleCurrenciesWithProvenance', () => {
    it('reports NO provenance when nothing needed converting', async () => {
      const { convertMultipleCurrenciesWithProvenance } = await freshModule();

      const result = await convertMultipleCurrenciesWithProvenance(
        [{ amount: 100, currency: 'GBP' }, { amount: 250, currency: 'GBP' }],
        'GBP'
      );

      // The single-currency case, and the whole reason provenance is nullable:
      // no rates were used, so there is nothing to disclose and the surfaces
      // that read this render nothing at all.
      expect(result.provenance).toBeNull();
      expect(result.total.toString()).toBe('350');
      expect(result.unconverted).toEqual([]);
      // It did not even ask for rates.
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports live provenance when a conversion did happen', async () => {
      const { convertMultipleCurrenciesWithProvenance } = await freshModule();
      mockFetch.mockResolvedValueOnce(okResponse());

      const result = await convertMultipleCurrenciesWithProvenance(
        [{ amount: 100, currency: 'GBP' }, { amount: 125, currency: 'USD' }],
        'GBP'
      );

      // 125 USD at 1.25 per GBP is 100 GBP, plus the 100 already in GBP.
      expect(result.total.toString()).toBe('200');
      expect(result.provenance?.source).toBe('api');
      expect(result.unconverted).toEqual([]);
    });

    it('reports fallback provenance when the provider could not be reached', async () => {
      const { convertMultipleCurrenciesWithProvenance } = await freshModule();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('offline'));

      const result = await convertMultipleCurrenciesWithProvenance(
        [{ amount: 100, currency: 'GBP' }, { amount: 127, currency: 'USD' }],
        'GBP'
      );

      // The figure is still produced — an offline app still shows a total —
      // but it now says what it was built from.
      expect(result.provenance?.source).toBe('fallback');
      expect(result.total.isZero()).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('names a currency it had no rate for instead of only logging it', async () => {
      const { convertMultipleCurrenciesWithProvenance } = await freshModule();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce(okResponse());

      const result = await convertMultipleCurrenciesWithProvenance(
        [{ amount: 100, currency: 'GBP' }, { amount: 50, currency: 'ZZZ' }],
        'GBP'
      );

      // Pre-existing behaviour: the unconvertible amount is still added, which
      // makes the total wrong by exactly that much. Now it is reported rather
      // than only written to a console nobody is reading.
      expect(result.unconverted).toEqual(['ZZZ']);
      expect(result.total.toString()).toBe('150');
      consoleWarnSpy.mockRestore();
    });

    it('lists each missing currency once, however many rows carry it', async () => {
      const { convertMultipleCurrenciesWithProvenance } = await freshModule();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce(okResponse());

      const result = await convertMultipleCurrenciesWithProvenance(
        [
          { amount: 10, currency: 'ZZZ' },
          { amount: 20, currency: 'ZZZ' },
          { amount: 30, currency: 'QQQ' },
        ],
        'GBP'
      );

      expect(result.unconverted).toEqual(['ZZZ', 'QQQ']);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('convertMultipleCurrencies still answers exactly as it did', () => {
    it('returns the same total the provenance version computes', async () => {
      const { convertMultipleCurrencies, convertMultipleCurrenciesWithProvenance } =
        await freshModule();
      mockFetch.mockResolvedValue(okResponse());

      const amounts = [{ amount: 100, currency: 'GBP' }, { amount: 125, currency: 'USD' }];
      const plain = await convertMultipleCurrencies(amounts, 'GBP');
      const withProvenance = await convertMultipleCurrenciesWithProvenance(amounts, 'GBP');

      expect(plain.toString()).toBe(withProvenance.total.toString());
    });
  });
});
