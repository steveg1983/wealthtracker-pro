export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

import { toDecimal } from './decimal';
import { formatDecimal } from './decimal-format';

export function formatCompactNumber(num: number): string {
  const numeric = Number(num);

  if (Number.isNaN(numeric)) {
    return 'NaN';
  }

  if (numeric === Infinity) {
    return 'InfinityM';
  }

  if (numeric === -Infinity) {
    return '-Infinity';
  }

  const decimalValue = toDecimal(numeric);

  if (decimalValue.isNegative()) {
    return formatDecimal(decimalValue, 2, { group: true });
  }

  const absolute = decimalValue.abs();

  if (absolute.greaterThanOrEqualTo(1_000_000)) {
    const scaled = decimalValue.dividedBy(1_000_000);
    return `${formatDecimal(scaled, 1)}M`;
  }

  if (absolute.greaterThanOrEqualTo(1_000)) {
    const scaled = decimalValue.dividedBy(1_000);
    return `${formatDecimal(scaled, 1)}K`;
  }

  return formatDecimal(decimalValue, 2, { group: true });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
