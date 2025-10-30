// Delegate currency formatting to Decimal-based implementation for correctness
import { formatCurrency as decimalFormatCurrency } from './currency-decimal';
import { toDecimal, Decimal } from '@wealthtracker/utils';

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  return decimalFormatCurrency(amount, currency);
}

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }

  if (!Number.isFinite(value)) {
    return value === Infinity ? 'Infinity' : '-Infinity';
  }

  const decimal = toDecimal(value).toDecimalPlaces(2);
  const formatter = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(decimal.toNumber());
}

export function formatCompactNumber(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN';
  }

  if (value === Infinity) {
    return 'InfinityM';
  }

  if (value === -Infinity || value < 0) {
    return formatNumber(value);
  }

  const decimal = toDecimal(value);
  const absDecimal = decimal.abs();
  const oneThousand = toDecimal(1_000);
  const oneMillion = toDecimal(1_000_000);

  if (absDecimal.greaterThanOrEqualTo(oneMillion)) {
    const compact = absDecimal.dividedBy(oneMillion).toDecimalPlaces(1, Decimal.ROUND_HALF_EVEN);
    return `${compact.toFixed(1)}M`;
  }

  if (absDecimal.greaterThanOrEqualTo(oneThousand)) {
    const compact = absDecimal.dividedBy(oneThousand).toDecimalPlaces(1, Decimal.ROUND_HALF_EVEN);
    return `${compact.toFixed(1)}K`;
  }

  return formatNumber(decimal.toNumber());
}
