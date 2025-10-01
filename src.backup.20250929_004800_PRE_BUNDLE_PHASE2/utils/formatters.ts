// Delegate currency formatting to Decimal-based implementation for correctness
import { formatCurrency as decimalFormatCurrency } from './currency-decimal';

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return decimalFormatCurrency(amount, currency);
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return formatNumber(num);
}
