import Decimal from 'decimal.js';
import { toDecimal, DecimalInstance } from './decimal';

interface FormatDecimalOptions {
  group?: boolean;
}

function toPlainString(value: DecimalInstance): string {
  let str = value.toString();
  if (!str.includes('e') && !str.includes('E')) {
    return str;
  }

  const isNegative = str.startsWith('-');
  if (isNegative) {
    str = str.slice(1);
  }

  const [coefficient, exponentPart] = str.split('e');
  const exponent = parseInt(exponentPart, 10);
  const [intPartRaw, fracPartRaw = ''] = coefficient.split('.');
  const digits = `${intPartRaw}${fracPartRaw}`;

  if (exponent >= 0) {
    if (exponent >= fracPartRaw.length) {
      const integer = digits + '0'.repeat(exponent - fracPartRaw.length);
      return isNegative ? `-${integer}` : integer;
    }

    const index = digits.length - (fracPartRaw.length - exponent);
    const integerPart = digits.slice(0, index);
    const fractionalPart = digits.slice(index);
    const result = `${integerPart}.${fractionalPart}`;
    return isNegative ? `-${result}` : result;
  }

  const zeros = '0'.repeat(Math.abs(exponent) - 1);
  const result = `0.${zeros}${digits.replace(/^0+/, '') || '0'}`;
  return isNegative ? `-${result}` : result;
}

export function formatDecimal(
  value: number | string | DecimalInstance,
  decimals: number = 2,
  options: FormatDecimalOptions = {}
): string {
  const { group = false } = options;
  const decimalValue = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const isNegative = decimalValue.isNegative() && !decimalValue.isZero();
  const absolute = decimalValue.abs();
  const plain = toPlainString(absolute);

  let [integerPart, fractionalPart = ''] = plain.split('.');
  if (integerPart === '') {
    integerPart = '0';
  }

  if (decimals > 0) {
    fractionalPart = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  }

  if (group) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const fraction = decimals > 0 ? `.${fractionalPart}` : '';
  return `${isNegative ? '-' : ''}${integerPart}${fraction}`;
}

export function formatSignedDecimal(
  value: number | string | DecimalInstance,
  decimals: number = 2,
  options: FormatDecimalOptions = {}
): string {
  const formatted = formatDecimal(value, decimals, options);
  if (formatted.startsWith('-')) {
    return formatted;
  }
  return `+${formatted}`;
}
