import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  getCurrencySymbol,
  formatCurrency,
  formatCurrencyCompact,
  getExchangeRates,
  supportedCurrencies,
  currencySymbols
} from '../currency-decimal';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('currency-decimal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrencySymbol', () => {
    it('returns correct symbols for known currencies', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('JPY')).toBe('¥');
      expect(getCurrencySymbol('INR')).toBe('₹');
      expect(getCurrencySymbol('CHF')).toBe('CHF');
    });

    it('returns currency code for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
      expect(getCurrencySymbol('ABC')).toBe('ABC');
    });

    it('handles empty string', () => {
      expect(getCurrencySymbol('')).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('formats positive amounts correctly', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
      expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
      expect(formatCurrency(99.9, 'EUR')).toBe('€99.90');
    });

    it('formats negative amounts with negative sign', () => {
      expect(formatCurrency(-1234.56, 'GBP')).toBe('(£1,234.56)');
      expect(formatCurrency(-50, 'USD')).toBe('($50.00)');
    });

    it('formats zero correctly', () => {
      expect(formatCurrency(0, 'GBP')).toBe('£0.00');
      expect(formatCurrency(0, 'EUR')).toBe('€0.00');
    });

    it('never prints a minus in front of zero', () => {
      // Zero has no sign to show, but Decimal keeps one: JS negative zero (which
      // float arithmetic hands over from a running balance that nets out) and
      // any amount small enough to round away both answer isNegative() while
      // printing as 0.00. The account register showed "(£0.00)" against a day
      // whose payment and offsetting sweep cancelled, which reads to the user
      // like a rounding error in their own money.
      expect(formatCurrency(-0, 'GBP')).toBe('£0.00');
      expect(formatCurrency(-0.001, 'GBP')).toBe('£0.00');
      expect(formatCurrency(new Decimal('-0'), 'GBP')).toBe('£0.00');
      expect(formatCurrency(new Decimal(75).minus(75), 'GBP')).toBe('£0.00');
      expect(formatCurrency(-0, 'CHF')).toBe('0.00 CHF');
      // A real negative still shows one — this must not silence the sign.
      expect(formatCurrency(-0.01, 'GBP')).toBe('(£0.01)');
    });

    it('formats Decimal instances', () => {
      const decimal = new Decimal('1234.567');
      expect(formatCurrency(decimal, 'GBP')).toBe('£1,234.57');
    });

    it('handles CHF currency position', () => {
      expect(formatCurrency(1234.56, 'CHF')).toBe('1,234.56 CHF');
      expect(formatCurrency(50, 'CHF')).toBe('50.00 CHF');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(1000000, 'GBP')).toBe('£1,000,000.00');
      expect(formatCurrency(9999999.99, 'USD')).toBe('$9,999,999.99');
    });

    it('handles small decimal values', () => {
      expect(formatCurrency(0.01, 'GBP')).toBe('£0.01');
      expect(formatCurrency(0.001, 'EUR')).toBe('€0.00'); // Rounds to 2 decimals
      expect(formatCurrency(0.005, 'USD')).toBe('$0.01'); // Rounds up
    });

    it('uses GBP as default currency', () => {
      expect(formatCurrency(100)).toBe('£100.00');
    });

    it('handles unknown currencies', () => {
      expect(formatCurrency(100, 'XYZ')).toBe('XYZ100.00');
    });

    it('handles currencies with same symbol', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100.00');
      expect(formatCurrency(100, 'CAD')).toBe('$100.00');
      expect(formatCurrency(100, 'AUD')).toBe('$100.00');
      expect(formatCurrency(100, 'NZD')).toBe('$100.00');
    });
  });

  describe('getExchangeRates', () => {
    const mockRates = {
      GBP: 1,
      USD: 1.27,
      EUR: 1.17,
      CAD: 1.71,
      AUD: 1.92,
      JPY: 189.50,
      CHF: 1.12,
      CNY: 9.19,
      INR: 105.85,
      NZD: 2.09
    };

    const mockApiResponse = {
      base: 'GBP',
      date: '2024-01-20',
      rates: mockRates
    };

    it('fetches exchange rates from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      const rates = await getExchangeRates();

      expect(mockFetch).toHaveBeenCalledWith('https://api.exchangerate-api.com/v4/latest/GBP');
      expect(rates).toEqual(mockRates);
    });

    it('caches rates for subsequent calls', async () => {
      // Reimport to get fresh module without cache
      vi.resetModules();
      const { getExchangeRates: getExchangeRatesFresh } = await import('../currency-decimal');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      // First call — one request per provider (api, then the ECB overlay)
      const rates1 = await getExchangeRatesFresh();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should use cache
      const rates2 = await getExchangeRatesFresh();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(rates2).toEqual(rates1);
    });

    it('refreshes cache after expiration', async () => {
      vi.resetModules();
      const { getExchangeRates: getExchangeRatesFresh } = await import('../currency-decimal');
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      // First call — one request per provider (api, then the ECB overlay)
      await getExchangeRatesFresh();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Mock time passing (1 hour + 1 minute)
      const originalDateNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValueOnce(originalDateNow() + 61 * 60 * 1000);

      // Second call should fetch again
      await getExchangeRatesFresh();
      expect(mockFetch).toHaveBeenCalledTimes(4);

      vi.restoreAllMocks();
    });

    it('returns fallback rates on API error', async () => {
      vi.resetModules();
      const { getExchangeRates: getExchangeRatesFresh } = await import('../currency-decimal');
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const rates = await getExchangeRatesFresh();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching exchange rates:', expect.any(Error));
      expect(rates).toEqual({
        GBP: 1,
        USD: 1.27,
        EUR: 1.17,
        CAD: 1.71,
        AUD: 1.92,
        JPY: 189.50,
        CHF: 1.12,
        CNY: 9.19,
        INR: 105.85,
        NZD: 2.09
      });

      consoleErrorSpy.mockRestore();
    });

    it('returns fallback rates on non-ok response', async () => {
      vi.resetModules();
      const { getExchangeRates: getExchangeRatesFresh } = await import('../currency-decimal');
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const rates = await getExchangeRatesFresh();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(rates.GBP).toBe(1);
      expect(rates.USD).toBe(1.27);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('convertCurrency', () => {
    const mockRates = {
      GBP: 1,
      USD: 1.25,
      EUR: 1.15,
      JPY: 150
    };

    beforeEach(async () => {
      vi.resetModules();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: mockRates })
      });
    });

    it('returns same amount for same currency', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(100, 'GBP', 'GBP');
      expect(result.toNumber()).toBe(100);

      const decimal = new Decimal(50.50);
      const result2 = await convertCurrency(decimal, 'USD', 'USD');
      expect(result2.toNumber()).toBe(50.50);
    });

    it('converts from GBP to other currencies', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(100, 'GBP', 'USD');
      expect(result.toNumber()).toBe(125); // 100 * 1.25

      const result2 = await convertCurrency(100, 'GBP', 'EUR');
      expect(result2.toNumber()).toBe(115); // 100 * 1.15

      const result3 = await convertCurrency(10, 'GBP', 'JPY');
      expect(result3.toNumber()).toBe(1500); // 10 * 150
    });

    it('converts from other currencies to GBP', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(125, 'USD', 'GBP');
      expect(result.toNumber()).toBe(100); // 125 / 1.25

      const result2 = await convertCurrency(230, 'EUR', 'GBP');
      expect(result2.toNumber()).toBe(200); // 230 / 1.15

      const result3 = await convertCurrency(1500, 'JPY', 'GBP');
      expect(result3.toNumber()).toBe(10); // 1500 / 150
    });

    it('converts between non-GBP currencies', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(100, 'USD', 'EUR');
      // 100 USD -> 80 GBP -> 92 EUR
      expect(result.toNumber()).toBeCloseTo(92, 1);

      const result2 = await convertCurrency(1150, 'EUR', 'JPY');
      // 1150 EUR -> 1000 GBP -> 150000 JPY
      expect(result2.toNumber()).toBe(150000);
    });

    it('handles Decimal input', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const amount = new Decimal('123.456');
      const result = await convertCurrency(amount, 'GBP', 'USD');
      expect(result.toNumber()).toBeCloseTo(154.32, 2); // 123.456 * 1.25
    });

    it('returns original amount for unknown currencies', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await convertCurrency(100, 'XYZ', 'USD');
      expect(result.toNumber()).toBe(100);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Missing exchange rate for XYZ or USD');

      consoleWarnSpy.mockRestore();
    });

    it('handles conversion errors gracefully', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Both providers down (api, then the ECB overlay).
      mockFetch.mockRejectedValueOnce(new Error('API error')).mockRejectedValueOnce(new Error('API error'));

      const result = await convertCurrency(100, 'GBP', 'USD');
      // Falls back to hardcoded rates: 100 * 1.27
      expect(result.toNumber()).toBe(127);

      consoleErrorSpy.mockRestore();
    });

    it('handles zero amounts', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(0, 'GBP', 'USD');
      expect(result.toNumber()).toBe(0);
    });

    it('handles negative amounts', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const result = await convertCurrency(-100, 'GBP', 'USD');
      expect(result.toNumber()).toBe(-125);
    });

    it('maintains precision with Decimal', async () => {
      const { convertCurrency } = await import('../currency-decimal');
      
      const amount = new Decimal('0.01');
      const result = await convertCurrency(amount, 'GBP', 'USD');
      expect(result.toNumber()).toBe(0.0125);
    });
  });

  describe('convertMultipleCurrencies', () => {
    const mockRates = {
      GBP: 1,
      USD: 1.25,
      EUR: 1.15,
      JPY: 150
    };

    beforeEach(async () => {
      vi.resetModules();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: mockRates })
      });
    });

    it('converts and sums multiple amounts to target currency', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: 100, currency: 'GBP' },    // 100 GBP
        { amount: 125, currency: 'USD' },    // 100 GBP
        { amount: 115, currency: 'EUR' }     // 100 GBP
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBe(300);
    });

    it('handles mixed currencies to USD', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: 80, currency: 'GBP' },     // 100 USD
        { amount: 50, currency: 'USD' },     // 50 USD
        { amount: 1500, currency: 'JPY' }    // 12.50 USD
      ];

      const result = await convertMultipleCurrencies(amounts, 'USD');
      expect(result.toNumber()).toBeCloseTo(162.50, 2);
    });

    it('handles empty array', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const result = await convertMultipleCurrencies([], 'GBP');
      expect(result.toNumber()).toBe(0);
    });

    it('handles single amount', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [{ amount: 100, currency: 'EUR' }];
      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBeCloseTo(86.96, 2); // 100 / 1.15
    });

    it('handles amounts already in target currency', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: 100, currency: 'GBP' },
        { amount: 200, currency: 'GBP' },
        { amount: 300, currency: 'GBP' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBe(600);
    });

    it('handles Decimal amounts', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: new Decimal('100.50'), currency: 'GBP' },
        { amount: new Decimal('125.25'), currency: 'USD' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBeCloseTo(200.70, 2);
    });

    it('warns and continues for unknown currencies', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const amounts = [
        { amount: 100, currency: 'GBP' },
        { amount: 50, currency: 'XYZ' },  // Unknown, will be added as-is
        { amount: 125, currency: 'USD' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBe(250); // 100 + 50 + 100
      expect(consoleWarnSpy).toHaveBeenCalledWith('Missing exchange rate for XYZ or GBP');

      consoleWarnSpy.mockRestore();
    });

    it('falls back to sum without conversion on error', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Both providers down (api, then the ECB overlay).
      mockFetch.mockRejectedValueOnce(new Error('API error')).mockRejectedValueOnce(new Error('API error'));

      const amounts = [
        { amount: 100, currency: 'GBP' },
        { amount: 200, currency: 'USD' },
        { amount: 300, currency: 'EUR' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      // With fallback rates: 100 + 200/1.27 + 300/1.17
      // = 100 + 157.48 + 256.41 = 513.89
      expect(result.toNumber()).toBeCloseTo(513.89, 1);

      consoleErrorSpy.mockRestore();
    });

    it('handles negative amounts', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: 100, currency: 'GBP' },
        { amount: -50, currency: 'USD' },
        { amount: -30, currency: 'EUR' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBeCloseTo(34, 0); // 100 - 40 - 26.09
    });

    it('handles zero amounts', async () => {
      const { convertMultipleCurrencies } = await import('../currency-decimal');
      
      const amounts = [
        { amount: 0, currency: 'GBP' },
        { amount: 0, currency: 'USD' },
        { amount: 100, currency: 'EUR' }
      ];

      const result = await convertMultipleCurrencies(amounts, 'GBP');
      expect(result.toNumber()).toBeCloseTo(86.96, 2);
    });
  });

  describe('supportedCurrencies', () => {
    it('contains expected currencies', () => {
      expect(supportedCurrencies).toHaveLength(10);
      
      const codes = supportedCurrencies.map(c => c.code);
      expect(codes).toContain('GBP');
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('JPY');
    });

    it('has correct structure for each currency', () => {
      supportedCurrencies.forEach(currency => {
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('name');
        expect(currency).toHaveProperty('symbol');
        expect(currency.code).toBeTruthy();
        expect(currency.name).toBeTruthy();
        expect(currency.symbol).toBeTruthy();
      });
    });

    it('matches currencySymbols mapping', () => {
      supportedCurrencies.forEach(currency => {
        expect(currencySymbols[currency.code]).toBe(currency.symbol);
      });
    });
  });

  describe('currencySymbols', () => {
    it('contains all expected symbols', () => {
      expect(currencySymbols).toHaveProperty('GBP', '£');
      expect(currencySymbols).toHaveProperty('USD', '$');
      expect(currencySymbols).toHaveProperty('EUR', '€');
      expect(currencySymbols).toHaveProperty('JPY', '¥');
      expect(currencySymbols).toHaveProperty('INR', '₹');
      expect(currencySymbols).toHaveProperty('CHF', 'CHF');
    });

    it('has entries for all supported currencies', () => {
      supportedCurrencies.forEach(currency => {
        expect(currencySymbols).toHaveProperty(currency.code);
      });
    });
  });
});

describe('formatCurrency — whole pounds (per-page display choice, owner 19 Aug)', () => {
  it('rounds half-up to the pound and drops the pennies, keeping grouping and brackets', () => {
    expect(formatCurrency(24354.39, 'GBP', { wholePounds: true })).toBe('£24,354');
    expect(formatCurrency(24354.5, 'GBP', { wholePounds: true })).toBe('£24,355');
    expect(formatCurrency(-42150.21, 'GBP', { wholePounds: true })).toBe('(£42,150)');
  });

  it('a figure that rounds to zero wears no brackets — the sign rides the ROUNDED value', () => {
    expect(formatCurrency(-0.4, 'GBP', { wholePounds: true })).toBe('£0');
  });

  it('without the option, nothing changes', () => {
    expect(formatCurrency(24354.39)).toBe('£24,354.39');
    expect(formatCurrency(-42150.21)).toBe('(£42,150.21)');
  });
});

describe('formatCurrencyCompact — axis notation (owner, 21 Aug: £8m, never £2000k)', () => {
  it('millions in m, 1dp only when not whole', () => {
    expect(formatCurrencyCompact(8_000_000)).toBe('£8m');
    expect(formatCurrencyCompact(2_400_000)).toBe('£2.4m');
  });

  it('thousands in k, grouped, 1dp when whole-thousand rounding would collide', () => {
    expect(formatCurrencyCompact(750_000)).toBe('£750k');
    expect(formatCurrencyCompact(2_550)).toBe('£2.6k');
  });

  it('whole units below a thousand; negatives keep the minus (colourless axis notation)', () => {
    expect(formatCurrencyCompact(850)).toBe('£850');
    expect(formatCurrencyCompact(-2_400_000)).toBe('-£2.4m');
  });
});

describe('one provider for a given day — the ECB overlay (Design, 24 Aug §1)', () => {
  // Every rate below is invented; the repo is public.
  const apiResponse = { ok: true, json: () => Promise.resolve({ rates: { GBP: 1, USD: 1.27, XXX: 5 } }) };
  const ecbResponse = { ok: true, json: () => Promise.resolve({ rates: { USD: 1.3 } }) };
  const down = () => Promise.reject(new Error('down'));

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ECB values overlay the api record wherever the ECB publishes; api keeps the breadth', async () => {
    const { getExchangeRatesWithProvenance } = await import('../currency-decimal');
    mockFetch.mockResolvedValueOnce(apiResponse).mockResolvedValueOnce(ecbResponse);
    const { rates, provenance } = await getExchangeRatesWithProvenance();
    // The major quotes the ECB — the same provider every backdated figure
    // uses, so the chart's last point and the closing snapshot agree.
    expect(rates.USD).toBe(1.3);
    // A currency the ECB does not publish keeps the api's live quote.
    expect(rates.XXX).toBe(5);
    expect(provenance.source).toBe('ecb');
  });

  it('with the ECB unreachable, the api record stands alone and says so', async () => {
    const { getExchangeRatesWithProvenance } = await import('../currency-decimal');
    mockFetch.mockResolvedValueOnce(apiResponse).mockImplementationOnce(down);
    const { rates, provenance } = await getExchangeRatesWithProvenance();
    expect(rates.USD).toBe(1.27);
    expect(provenance.source).toBe('api');
  });

  it('with the api unreachable, the ECB majors overlay the stored approximations', async () => {
    const { getExchangeRatesWithProvenance } = await import('../currency-decimal');
    mockFetch.mockImplementationOnce(down).mockResolvedValueOnce(ecbResponse);
    const { rates, provenance } = await getExchangeRatesWithProvenance();
    expect(rates.USD).toBe(1.3);
    expect(provenance.source).toBe('ecb');
  });

  it('with both unreachable, the fallback says it is one', async () => {
    const { getExchangeRatesWithProvenance } = await import('../currency-decimal');
    mockFetch.mockImplementationOnce(down).mockImplementationOnce(down);
    const { provenance } = await getExchangeRatesWithProvenance();
    expect(provenance.source).toBe('fallback');
  });
});
