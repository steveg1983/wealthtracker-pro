import Decimal from 'decimal.js';

export type DecimalInstance = InstanceType<typeof Decimal>;

Decimal.config({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 9,
  toExpNeg: -9,
});

const TEN = new Decimal(10);

const toPlainString = (value: string): string => {
  if (!/[eE]/.test(value)) {
    return value;
  }

  const sign = value.startsWith('-') ? '-' : '';
  const normalizedValue = value.replace('-', '');
  const [base = '0', exponentPart = '0'] = normalizedValue.split(/[eE]/);
  const exponent = parseInt(exponentPart || '0', 10);
  const [integerPart = '0', fractionalPart = ''] = base.split('.');
  const digits = `${integerPart}${fractionalPart}`;

  if (exponent >= 0) {
    const zerosNeeded = exponent - fractionalPart.length;
    if (zerosNeeded >= 0) {
      return `${sign}${digits}${'0'.repeat(zerosNeeded)}`;
    }
    const decimalIndex = digits.length + zerosNeeded;
    return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  const zerosNeeded = Math.abs(exponent) - integerPart.length;
  if (zerosNeeded >= 0) {
    return `${sign}0.${'0'.repeat(zerosNeeded)}${digits}`;
  }

  const decimalIndex = integerPart.length + exponent;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
};

const decimalToFixedString = (decimal: DecimalInstance, decimals: number): string => {
  const rounded = decimal.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);

  if (decimals <= 0) {
    return rounded.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString();
  }

  const multiplier = TEN.pow(decimals);
  const scaled = rounded.times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const absScaledString = toPlainString(scaled.abs().toString());
  const padded = absScaledString.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, padded.length - decimals) || '0';
  const fractionalPart = padded.slice(-decimals);
  const sign = scaled.isNegative() ? '-' : '';

  return `${sign}${integerPart}.${fractionalPart}`;
};

export function toDecimal(value: number | string | DecimalInstance | null | undefined): DecimalInstance {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

export function toNumber(value: DecimalInstance): number {
  return value.toDecimalPlaces(2).toNumber();
}

export function toStorageNumber(value: DecimalInstance): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumDecimals(values: (number | string | DecimalInstance)[]): DecimalInstance {
  return values.reduce((sum: DecimalInstance, value) => sum.plus(toDecimal(value)), new Decimal(0));
}

export function calculatePercentage(
  value: DecimalInstance | number,
  percentage: DecimalInstance | number,
): DecimalInstance {
  return toDecimal(value).times(toDecimal(percentage)).dividedBy(100);
}

export function decimalsEqual(
  a: DecimalInstance | number,
  b: DecimalInstance | number,
  tolerance: number = 0.01,
): boolean {
  return toDecimal(a).minus(toDecimal(b)).abs().lessThanOrEqualTo(tolerance);
}

export function formatDecimalFixed(
  value: DecimalInstance | number | string,
  decimals: number = 2,
): string {
  const decimalValue = toDecimal(value);
  return decimalToFixedString(decimalValue, decimals);
}

export function formatPercentageValue(
  value: DecimalInstance | number,
  decimals: number = 2,
): string {
  return `${formatDecimalFixed(value, decimals)}%`;
}

export function formatSignedPercentageValue(
  value: DecimalInstance | number,
  decimals: number = 2,
): string {
  const decimalValue = toDecimal(value);
  const prefix = decimalValue.isNegative() ? '-' : '+';
  return `${prefix}${formatDecimalFixed(decimalValue.abs(), decimals)}%`;
}

export function formatPercentageFromRatio(
  value: DecimalInstance | number,
  decimals: number = 2,
): string {
  return formatPercentageValue(
    toDecimal(value).times(100),
    decimals,
  );
}

export { Decimal };
