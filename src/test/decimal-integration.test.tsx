import { describe, it, expect } from 'vitest';
import { toDecimal, toNumber } from '../utils/decimal';
import {
  toDecimalAccount,
  fromDecimalAccount
} from '../utils/decimal-converters';

describe('Decimal.js Integration Tests', () => {
  it('converts between regular and decimal types correctly', () => {
    // Test account conversion
    const regularAccount = {
      id: '1',
      name: 'Test Account',
      type: 'savings' as const,
      balance: 1234.56,
      currency: 'GBP',
      institution: 'Test Bank',
      lastUpdated: new Date()
    };
    
    const decimalAccount = toDecimalAccount(regularAccount);
    expect(decimalAccount.balance.toString()).toBe('1234.56');
    
    const convertedBack = fromDecimalAccount(decimalAccount);
    expect(convertedBack.balance).toBe(1234.56);
  });

  it('handles floating point precision correctly', () => {
    // Test that 0.1 + 0.2 = 0.3 (classic floating point issue)
    const a = toDecimal(0.1);
    const b = toDecimal(0.2);
    const sum = a.plus(b);
    
    expect(sum.toString()).toBe('0.3');
    expect(toNumber(sum)).toBe(0.3);
  });

  it('handles large financial calculations without precision loss', () => {
    // Test with large numbers that would lose precision with regular numbers
    const transactions = [
      { amount: toDecimal('999999.99') },
      { amount: toDecimal('0.01') },
      { amount: toDecimal('1000000.00') }
    ];
    
    const total = transactions.reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
    expect(total.toString()).toBe('2000000');
  });

  it('handles currency calculations with proper rounding', () => {
    // Test division and rounding for currency
    const total = toDecimal(100);
    const split = total.dividedBy(3);
    
    // Round to 2 decimal places for currency
    const rounded = split.toDecimalPlaces(2);
    expect(rounded.toString()).toBe('33.33');
    
    // Verify that 3 * 33.33 + 0.01 = 100
    const reconstructed = rounded.times(3).plus(0.01);
    expect(reconstructed.toString()).toBe('100');
  });

  it('preserves precision through multiple operations', () => {
    // Simulate complex financial calculation
    const principal = toDecimal('10000.00');
    const interestRate = toDecimal('0.05'); // 5%
    const months = 12;
    
    // Calculate monthly interest
    const monthlyRate = interestRate.dividedBy(12);
    let balance = principal;
    
    for (let i = 0; i < months; i++) {
      const interest = balance.times(monthlyRate);
      balance = balance.plus(interest);
    }
    
    // Should be exactly 10511.62 (rounded to 2 decimals)
    const finalBalance = balance.toDecimalPlaces(2);
    expect(finalBalance.toString()).toBe('10511.62');
  });

  it('handles negative values correctly', () => {
    const accounts = [
      { balance: toDecimal('5000.00') },  // Asset
      { balance: toDecimal('-3000.00') }, // Liability
      { balance: toDecimal('1000.00') },  // Asset
    ];
    
    const netWorth = accounts.reduce((sum, acc) => sum.plus(acc.balance), toDecimal(0));
    expect(netWorth.toString()).toBe('3000');
    
    // Test comparison
    expect(netWorth.greaterThan(0)).toBe(true);
    expect(accounts[1].balance.lessThan(0)).toBe(true);
  });
});
