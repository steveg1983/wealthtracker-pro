import { Decimal, toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';
import { formatDecimal } from './decimal-format';

const currencyLogger = typeof console !== 'undefined' ? console : { log: () => {}, warn: () => {}, error: () => {} };

// Currency conversion utilities with Decimal.js
interface ExchangeRates {
  [key: string]: number;
}

/**
 * Where the rates in hand came from.
 *
 * This used to be unknowable from outside, and that was the honesty gap: a
 * failed fetch fell back to a hardcoded table of approximate rates and every
 * converted total went on reading exactly as if it were live. A figure derived
 * from a guess and a figure derived from a quote looked identical.
 */
export type RatesSource =
  /** A live quote from the provider named in {@link RATES_PROVIDER}. */
  | 'api'
  /** The hardcoded approximations below. The provider could not be reached. */
  | 'fallback';

export interface RatesProvenance {
  source: RatesSource;
  /** When these rates were obtained. */
  asOf: Date;
}

/** Named, because a converted figure should be able to say who quoted it. */
export const RATES_PROVIDER = 'exchangerate-api.com';

// Cache exchange rates for 1 hour
let ratesCache: {
  rates: ExchangeRates;
  timestamp: number;
  source: RatesSource;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * How long a FALLBACK is held before trying the provider again.
 *
 * Deliberately far shorter than {@link CACHE_DURATION}. Caching a failure for a
 * full hour means one dropped request leaves every total in the app labelled
 * "approximate" long after the network came back — the warning stops being
 * information and becomes furniture, which is how a real one gets ignored. Five
 * minutes retries soon enough to clear itself, and rarely enough that a genuinely
 * offline desktop is not retrying on every render.
 */
const FALLBACK_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Approximate rates, used only when the provider cannot be reached.
 *
 * These are a fixed table. They are wrong the day after they were written and
 * they get wronger; the only thing that makes them acceptable is that every
 * total computed from them says so. See {@link getRatesProvenance}.
 */
const FALLBACK_RATES: ExchangeRates = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  CAD: 1.71,
  AUD: 1.92,
  JPY: 189.50,
  CHF: 1.12,
  CNY: 9.19,
  INR: 105.85,
  NZD: 2.09,
};

// Currency symbols
export const currencySymbols: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  CAD: '$',
  AUD: '$',
  JPY: '¥',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹',
  NZD: '$',
};

// Get currency symbol
export function getCurrencySymbol(currency: string): string {
  return currencySymbols[currency] || currency;
}

/**
 * Whether to print a minus sign — false for anything that has ROUNDED to zero.
 *
 * Zero has no sign to show. Decimal keeps one anyway: a JS negative zero (which
 * float arithmetic produces from `2000 - 2000` in the wrong order, and which a
 * float running balance produces all the time) and any small negative that
 * rounds away both answer true to isNegative() while printing as 0.00. The
 * account register showed "-£0.00" against a day that netted out, which reads
 * like a rounding error in the user's own money.
 */
const showsMinus = (decimal: DecimalInstance): boolean =>
  decimal.isNegative() && !decimal.isZero();

/**
 * ─ NEGATIVES WEAR PARENTHESES, NOT A MINUS ─────────────────────────────────
 *
 * `(£417.54)`, never `-£417.54`. Claude Design's ruling of 15 August, and it
 * strengthens P2 rather than adding anything: colour is a signal, but P2 never
 * said colour may be the ONLY signal — and for sign it was. A reader in
 * greyscale, in print, with a colour vision deficiency, or on a badly
 * calibrated monitor had one carrier for the difference between owing and
 * owning: a glyph four pixels wide, right-aligned, first to be clipped.
 *
 * Parentheses are the accounting convention for exactly this reason. They
 * predate colour displays and they read at any size. Same argument that put
 * dash patterns on the net-worth series rather than a third hue:
 *
 *     Colour may reinforce a distinction but may never be its only carrier.
 *
 * The symbol sits INSIDE the brackets, per convention: `(£417.54)`.
 * Colour is unchanged — the instrumented expense red still applies, and the
 * parentheses are an ADDITIONAL carrier rather than a replacement.
 *
 * Zero never wears them: `showsMinus` already refuses a negative zero, so a
 * day that nets out reads `£0.00` and not `(£0.00)`.
 *
 * NOT used by the exports. `csvExport` formats its own figures through
 * `formatDecimal`, which keeps the minus — parentheses are a display
 * convention and would break anything that parses the file. The PDF DOES come
 * through here, and should: it is a rendered document a person reads, which is
 * where the convention comes from.
 */
/**
 * `wholePounds` is a DISPLAY choice, per page (see WholePoundsContext): the
 * figure rounds half-up to the pound and drops its pennies. The sign rule
 * rides on the ROUNDED value, so a −£0.40 that rounds to zero wears no
 * brackets — the same guard formatCurrencyWhole below has always kept.
 */
export interface FormatCurrencyOptions {
  wholePounds?: boolean;
}

export function formatCurrency(
  amount: DecimalInstance | number,
  currency: string = 'GBP',
  options: FormatCurrencyOptions = {}
): string {
  const places = options.wholePounds ? 0 : 2;
  const decimal = toDecimal(amount).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const symbol = getCurrencySymbol(currency);
  const isNegative = showsMinus(decimal);
  const formatted = formatDecimal(decimal.abs(), places, { group: true });
  const body = currency === 'CHF' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;

  return isNegative ? `(${body})` : body;
}

/**
 * The same amount, said out loud.
 *
 * Screen readers at default punctuation verbosity DO NOT announce brackets, so
 * `(£417.54)` and `£417.54` sound identical — which would take the sign away
 * from exactly the readers the change is meant to help. The visible text may
 * change; the accessible name may not degrade.
 *
 * Pair them with `<Amount>`, or with an `aria-label` at the call site.
 */
export function formatCurrencyForSpeech(
  amount: DecimalInstance | number,
  currency: string = 'GBP'
): string {
  const decimal = toDecimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const symbol = getCurrencySymbol(currency);
  const formatted = formatDecimal(decimal.abs(), 2, { group: true });
  const body = currency === 'CHF' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;

  return showsMinus(decimal) ? `minus ${body}` : body;
}

// Format currency without fractional digits (floored values) for dashboard summaries
export function formatCurrencyWhole(
  amount: DecimalInstance | number | string,
  currency: string = 'GBP'
): string {
  const decimal = toDecimal(amount);
  const rounded = decimal.toDecimalPlaces(0, Decimal.ROUND_DOWN);
  // ROUND_DOWN takes -0.40 to zero, so this needs the same guard: a summary
  // card reading "-£0" is the same lie in fewer digits.
  const isNegative = showsMinus(rounded);
  const symbol = getCurrencySymbol(currency);
  const grouped = formatDecimal(rounded.abs(), 0, { group: true });

  // Same convention as `formatCurrency` above, for the same reason.
  const body = currency === 'CHF' ? `${grouped} ${symbol}` : `${symbol}${grouped}`;
  return isNegative ? `(${body})` : body;
}

// Fetch exchange rates from a free API
async function fetchExchangeRates(): Promise<{ rates: ExchangeRates; source: RatesSource }> {
  try {
    // Using exchangerate-api.com free tier
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    return { rates: data.rates, source: 'api' };
  } catch (error) {
    currencyLogger.error('Error fetching exchange rates:', error);

    // Fallback to approximate rates if API fails. The caller is TOLD it is a
    // fallback — this is the one branch that used to be silent, and a total
    // built on a guess that cannot say so is the thing this reports.
    return { rates: { ...FALLBACK_RATES }, source: 'fallback' };
  }
}

// Get cached or fresh exchange rates
export async function getExchangeRates(): Promise<ExchangeRates> {
  return (await getExchangeRatesWithProvenance()).rates;
}

/**
 * The rates, and where they came from.
 *
 * The same fetch and the same cache as {@link getExchangeRates} — that function
 * is now this one with the provenance dropped, so there is exactly one cache and
 * no way for the two to disagree about which rates are in hand.
 */
export async function getExchangeRatesWithProvenance(): Promise<{
  rates: ExchangeRates;
  provenance: RatesProvenance;
}> {
  const now = Date.now();

  // A fallback is held for minutes, a live quote for an hour: see
  // FALLBACK_CACHE_DURATION for why the two differ.
  if (ratesCache) {
    const ttl = ratesCache.source === 'api' ? CACHE_DURATION : FALLBACK_CACHE_DURATION;
    if ((now - ratesCache.timestamp) < ttl) {
      return {
        rates: ratesCache.rates,
        provenance: { source: ratesCache.source, asOf: new Date(ratesCache.timestamp) },
      };
    }
  }

  // Fetch fresh rates
  const { rates, source } = await fetchExchangeRates();
  ratesCache = {
    rates,
    timestamp: now,
    source,
  };

  return { rates, provenance: { source, asOf: new Date(now) } };
}

/**
 * Where the rates currently in hand came from, WITHOUT fetching.
 *
 * `null` means nothing has been fetched yet in this session, which is the
 * honest answer for a surface that has not converted anything: it has no
 * provenance to show because it has used no rates.
 */
export function getRatesProvenance(): RatesProvenance | null {
  if (!ratesCache) return null;
  return { source: ratesCache.source, asOf: new Date(ratesCache.timestamp) };
}

// Convert amount from one currency to another using Decimal
export async function convertCurrency(
  amount: DecimalInstance | number,
  fromCurrency: string,
  toCurrency: string
): Promise<DecimalInstance> {
  const decimalAmount = toDecimal(amount);
  
  if (fromCurrency === toCurrency) {
    return decimalAmount;
  }
  
  try {
    const rates = await getExchangeRates();
    
    // Check if we have rates for both currencies
    if (!rates[fromCurrency] || !rates[toCurrency]) {
      currencyLogger.warn(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`);
      return decimalAmount; // Return original amount if conversion fails
    }
    
    // Convert to GBP first (base currency), then to target currency
    const fromRate = new Decimal(rates[fromCurrency]);
    const toRate = new Decimal(rates[toCurrency]);
    
    let inGBP: DecimalInstance;
    if (fromCurrency === 'GBP') {
      inGBP = decimalAmount;
    } else {
      inGBP = decimalAmount.dividedBy(fromRate);
    }
    
    let converted: DecimalInstance;
    if (toCurrency === 'GBP') {
      converted = inGBP;
    } else {
      converted = inGBP.times(toRate);
    }
    
    return converted;
  } catch (error) {
    currencyLogger.error('Currency conversion error:', error);
    return decimalAmount; // Return original amount if conversion fails
  }
}

/**
 * A total summed across currencies, and everything a reader needs to judge it.
 *
 * The point of the extra fields: a single number cannot say whether it was
 * converted at live rates, converted at approximations, or partly not converted
 * at all — and those three deserve different amounts of trust.
 */
export interface ConvertedTotal {
  total: DecimalInstance;
  /**
   * Where the rates came from, or `null` when NO conversion was needed because
   * every amount was already in the target currency.
   *
   * The null is load-bearing. A person with one currency has no rates involved
   * in their totals, so there is nothing to disclose to them and the surfaces
   * that read this render nothing at all.
   */
  provenance: RatesProvenance | null;
  /**
   * Currencies whose rate was missing. Their amounts were added UNCONVERTED,
   * which is the pre-existing behaviour — reported now instead of only being
   * written to the console, because it makes the total wrong by however much
   * those rows were worth.
   */
  unconverted: string[];
}

// Convert multiple amounts with different currencies to a single currency
export async function convertMultipleCurrencies(
  amounts: Array<{ amount: DecimalInstance | number; currency: string }>,
  toCurrency: string
): Promise<DecimalInstance> {
  return (await convertMultipleCurrenciesWithProvenance(amounts, toCurrency)).total;
}

/**
 * {@link convertMultipleCurrencies}, with the provenance kept rather than
 * discarded. That function is now this one with the answer narrowed, so the two
 * cannot compute a total differently.
 */
export async function convertMultipleCurrenciesWithProvenance(
  amounts: Array<{ amount: DecimalInstance | number; currency: string }>,
  toCurrency: string
): Promise<ConvertedTotal> {
  // Nothing to convert: every amount is already in the target currency. No
  // rates are fetched and no provenance is reported, because none was used.
  if (amounts.every(({ currency }) => currency === toCurrency)) {
    return {
      total: amounts.reduce((sum, { amount }) => sum.plus(toDecimal(amount)), new Decimal(0)),
      provenance: null,
      unconverted: [],
    };
  }

  try {
    const { rates, provenance } = await getExchangeRatesWithProvenance();

    let total = new Decimal(0);
    const unconverted = new Set<string>();

    for (const { amount, currency } of amounts) {
      const decimalAmount = toDecimal(amount);

      if (currency === toCurrency) {
        total = total.plus(decimalAmount);
        continue;
      }

      // Check if we have rates for the currency
      if (!rates[currency] || !rates[toCurrency]) {
        currencyLogger.warn(`Missing exchange rate for ${currency} or ${toCurrency}`);
        unconverted.add(currency);
        total = total.plus(decimalAmount); // Add unconverted amount
        continue;
      }

      // Convert to GBP first, then to target currency
      const fromRate = new Decimal(rates[currency]);
      const toRate = new Decimal(rates[toCurrency]);

      let inGBP: DecimalInstance;
      if (currency === 'GBP') {
        inGBP = decimalAmount;
      } else {
        inGBP = decimalAmount.dividedBy(fromRate);
      }

      let converted: DecimalInstance;
      if (toCurrency === 'GBP') {
        converted = inGBP;
      } else {
        converted = inGBP.times(toRate);
      }

      total = total.plus(converted);
    }

    return { total, provenance, unconverted: [...unconverted] };
  } catch (error) {
    currencyLogger.error('Currency conversion error:', error);
    // Fallback: just sum amounts without conversion. Every foreign currency in
    // the set is reported as unconverted, because that is exactly what happened
    // — the total is a sum of figures in currencies that were never reconciled.
    return {
      total: amounts.reduce((sum, { amount }) => sum.plus(toDecimal(amount)), new Decimal(0)),
      provenance: getRatesProvenance(),
      unconverted: [...new Set(amounts.map(a => a.currency).filter(c => c !== toCurrency))],
    };
  }
}

// Get all supported currencies
export const supportedCurrencies = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
];
