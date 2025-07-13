// Currency conversion utilities
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

// Format amount with currency
export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  // Special handling for currencies that come after the number
  if (currency === 'CHF') {
    return `${formatted} ${symbol}`;
  }
  
  return `${symbol}${formatted}`;
}

// Fetch exchange rates from a free API
async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    // Using exchangerate-api.com free tier
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }
    
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    
    // Fallback to approximate rates if API fails
    return {
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

// Convert amount from one currency to another
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  try {
    const rates = await getExchangeRates();
    
    // Check if we have rates for both currencies
    if (!rates[fromCurrency] || !rates[toCurrency]) {
      console.warn(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`);
      return amount; // Return original amount if conversion fails
    }
    
    // Convert to GBP first (base currency), then to target currency
    const inGBP = fromCurrency === 'GBP' ? amount : amount / rates[fromCurrency];
    const converted = toCurrency === 'GBP' ? inGBP : inGBP * rates[toCurrency];
    
    return converted;
  } catch (error) {
    console.error('Currency conversion error:', error);
    return amount; // Return original amount if conversion fails
  }
}

// Convert multiple amounts with different currencies to a single currency
export async function convertMultipleCurrencies(
  amounts: Array<{ amount: number; currency: string }>,
  toCurrency: string
): Promise<number> {
  try {
    const rates = await getExchangeRates();
    
    return amounts.reduce((total, { amount, currency }) => {
      if (currency === toCurrency) {
        return total + amount;
      }
      
      // Check if we have rates for the currency
      if (!rates[currency] || !rates[toCurrency]) {
        console.warn(`Missing exchange rate for ${currency} or ${toCurrency}`);
        return total + amount; // Add unconverted amount
      }
      
      // Convert to GBP first, then to target currency
      const inGBP = currency === 'GBP' ? amount : amount / rates[currency];
      const converted = toCurrency === 'GBP' ? inGBP : inGBP * rates[toCurrency];
      
      return total + converted;
    }, 0);
  } catch (error) {
    console.error('Currency conversion error:', error);
    // Fallback: just sum amounts without conversion
    return amounts.reduce((sum, { amount }) => sum + amount, 0);
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