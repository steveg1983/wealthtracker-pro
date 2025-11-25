import { describe, expect, it } from 'vitest';
import { Decimal } from '../../utils/decimal';
import {
  absMoney,
  addMoney,
  compareMoney,
  Money,
  toMoney
} from '../money';

const toNumber = (money: Money) => Number(money);

describe('money utilities', () => {
  it('converts numbers to normalized money strings', () => {
    expect(toMoney(10.456)).toBe('10.46');
    expect(toMoney(-3)).toBe('-3.00');
  });

  it('accepts Decimal instances', () => {
    const value = new Decimal('123.4567');
    expect(toMoney(value)).toBe('123.46');
  });

  it('adds two money values precisely', () => {
    const result = addMoney(toMoney(10.01), toMoney(0.02));
    expect(result).toBe('10.03');
  });

  it('compares money values correctly', () => {
    expect(compareMoney(toMoney(5), toMoney(5))).toBe(0);
    expect(compareMoney(toMoney(4.99), toMoney(5))).toBe(-1);
    expect(compareMoney(toMoney(5.01), toMoney(5))).toBe(1);
  });

  it('returns absolute value', () => {
    expect(absMoney(toMoney(-12.345))).toBe('12.35');
  });

  it('throws on invalid input', () => {
    expect(() => toMoney('abc' as unknown as number)).toThrowError(/Invalid|DecimalError/);
  });

  it('does not lose precision for large values', () => {
    const sum = addMoney(toMoney(999999999.99), toMoney(0.01));
    expect(sum).toBe('1000000000.00');
    expect(toNumber(sum)).toBe(1000000000);
  });
});
