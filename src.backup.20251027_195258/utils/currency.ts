import { Decimal } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';
import {
  convertCurrency as convertCurrencyDecimal,
  convertMultipleCurrencies as convertMultipleCurrenciesDecimal,
  formatCurrency as formatCurrencyDecimal,
  getCurrencySymbol as getCurrencySymbolDecimal,
  parseCurrencyToNumber,
  supportedCurrencies,
} from './currency-decimal';

export { supportedCurrencies };

export function getCurrencySymbol(currency: string): string {
  return getCurrencySymbolDecimal(currency);
}

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return formatCurrencyDecimal(amount, currency);
}

export function formatDisplayCurrency(amount: number, currency: string = 'GBP'): string {
  return formatCurrency(amount, currency);
}

export function parseCurrency(value: string): number {
  return parseCurrencyToNumber(value);
}

const staticRates: Record<string, number> = {
  GBP: 1,
  USD: 1.25,
  EUR: 1.176470588,
};

const convertUsingStaticRates = (
  decimalAmount: DecimalInstance,
  fromCurrency: string,
  toCurrency: string,
): DecimalInstance => {
  if (fromCurrency === toCurrency) {
    return decimalAmount;
  }
  const fromRate = new Decimal(staticRates[fromCurrency] ?? 1);
  const toRate = new Decimal(staticRates[toCurrency] ?? 1);
  const inGBP = fromCurrency === 'GBP' ? decimalAmount : decimalAmount.dividedBy(fromRate);
  return toCurrency === 'GBP' ? inGBP : inGBP.times(toRate);
};

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const decimalAmount = new Decimal(amount);
  return convertUsingStaticRates(decimalAmount, fromCurrency, toCurrency).toNumber();
}

export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const fromRate = staticRates[fromCurrency] ?? 1;
  const toRate = staticRates[toCurrency] ?? 1;

  if (fromCurrency === 'GBP') {
    return toRate;
  }

  if (toCurrency === 'GBP') {
    return 1 / fromRate;
  }

  return toRate / fromRate;
}

export async function convertCurrencyAsync(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  const decimal = await convertCurrencyDecimal(new Decimal(amount), fromCurrency, toCurrency);
  return decimal.toNumber();
}

export async function convertMultipleCurrencies(
  amounts: Array<{ amount: number; currency: string }>,
  toCurrency: string,
): Promise<number> {
  const decimalAmounts = amounts.map(({ amount, currency }) => ({ amount: new Decimal(amount), currency }));
  const total = await convertMultipleCurrenciesDecimal(decimalAmounts, toCurrency);
  return total.toNumber();
}

export function convertToDisplayCurrency(amount: number, currency: string, displayCurrency: string): number {
  return convertCurrency(amount, currency, displayCurrency);
}
