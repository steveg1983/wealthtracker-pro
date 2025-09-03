import { Decimal, toDecimal } from './decimal';
import type { DecimalInstance } from './decimal';
import { logger } from '../services/loggingService';
import { captureMessage } from '../lib/sentry';

// Currency conversion utilities with Decimal.js
interface ExchangeRates {
  [key: string]: number;
}

// Cache exchange rates for 1 hour
let ratesCache: {
  rates: ExchangeRates;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

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

// Format amount with currency (accepts Decimal or number)
export function formatCurrency(amount: DecimalInstance | number, currency: string = 'GBP'): string {
  const decimal = toDecimal(amount);
  const symbol = getCurrencySymbol(currency);
  const isNegative = decimal.isNegative();
  const absValue = decimal.abs().toNumber();
  
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);
  
  // Special handling for currencies that come after the number
  if (currency === 'CHF') {
    return isNegative ? `-${formatted} ${symbol}` : `${formatted} ${symbol}`;
  }
  
  // For negative amounts, put the minus sign before the currency symbol
  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

// Fetch exchange rates via serverless proxy first, fallback to public API
async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    // Prefer serverless endpoint for caching/observability
    const response = await fetch('/api/exchange-rates?base=GBP');
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }
    
    const data = await response.json();
    return data.rates;
  } catch (error) {
    logger.error('Error fetching exchange rates via API route (falling back):', error);
    try { captureMessage('FX_FALLBACK_SERVERLESS_FAILURE', 'warning', { error: String(error) }); } catch {
      // Sentry not available, continue without logging
    }
    // Fallback to upstream directly
    try {
      const upstream = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
      if (!upstream.ok) throw new Error('Upstream failed');
      const data = await upstream.json();
      return data.rates;
    } catch (e) {
      logger.error('Error fetching exchange rates from upstream:', e);
      try { captureMessage('FX_FALLBACK_UPSTREAM_FAILURE', 'warning', { error: String(e) }); } catch {
        // Sentry not available, continue without logging
      }
    }
    
    // Fallback to approximate rates if API fails
    const fallback = {
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
    try { captureMessage('FX_USING_STATIC_FALLBACK_RATES', 'warning', { provider: 'static' }); } catch {
      // Sentry not available, continue without logging
    }
    return fallback;
  }
}

// Get cached or fresh exchange rates
export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (ratesCache && (now - ratesCache.timestamp) < CACHE_DURATION) {
    return ratesCache.rates;
  }
  
  // Fetch fresh rates
  const rates = await fetchExchangeRates();
  ratesCache = {
    rates,
    timestamp: now,
  };
  
  return rates;
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
      logger.warn(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`);
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
    logger.error('Currency conversion error:', error);
    return decimalAmount; // Return original amount if conversion fails
  }
}

// Convert multiple amounts with different currencies to a single currency
export async function convertMultipleCurrencies(
  amounts: Array<{ amount: DecimalInstance | number; currency: string }>,
  toCurrency: string
): Promise<DecimalInstance> {
  try {
    const rates = await getExchangeRates();
    
    let total = new Decimal(0);
    
    for (const { amount, currency } of amounts) {
      const decimalAmount = toDecimal(amount);
      
      if (currency === toCurrency) {
        total = total.plus(decimalAmount);
        continue;
      }
      
      // Check if we have rates for the currency
      if (!rates[currency] || !rates[toCurrency]) {
        logger.warn(`Missing exchange rate for ${currency} or ${toCurrency}`);
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
    
    return total;
  } catch (error) {
    logger.error('Currency conversion error:', error);
    // Fallback: just sum amounts without conversion
    return amounts.reduce((sum, { amount }) => sum.plus(toDecimal(amount)), new Decimal(0));
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
