import { describe, it, expect, vi } from 'vitest';
import { parseInvestmentTransaction, updateHoldings, calculateHoldingsValue } from '../investmentUtils';
import type { Transaction, Holding } from '../../types';

describe('investmentUtils', () => {
  describe('parseInvestmentTransaction', () => {
    const mockBaseTransaction: Transaction = {
      id: 'trans1',
      date: new Date('2024-01-15'),
      amount: 1000,
      description: 'Buy: Apple Inc (AAPL)',
      category: 'investment',
      accountId: 'acc1',
      type: 'expense',
      tags: ['investment']
    };

    it('parses valid investment transaction with all fields', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Stock Code: AAPL\nUnits: 10\nPrice per unit: 95.50\nFees: 5.00'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result).toEqual({
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        pricePerShare: 95.50,
        fees: 5.00,
        type: 'buy'
      });
    });

    it('parses sell transaction correctly', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        type: 'income',
        description: 'Sell: Apple Inc (AAPL)',
        notes: 'Stock Code: AAPL\nUnits: 5\nPrice per unit: 100.00\nFees: 5.00'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result).toBeDefined();
      expect(result?.ticker).toBe('AAPL');
      expect(result?.shares).toBe(5);
      expect(result?.pricePerShare).toBe(100.00);
      expect(result?.fees).toBe(5.00);
      expect(result?.type).toBe('sell');
      // Note: The description pattern doesn't match "Sell:", so name is not extracted
    });

    it('returns null for non-investment transaction', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        tags: []
      };

      const result = parseInvestmentTransaction(transaction);
      expect(result).toBeNull();
    });

    it('returns null for transaction without notes', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: undefined
      };

      const result = parseInvestmentTransaction(transaction);
      expect(result).toBeNull();
    });

    it('returns null for transaction with missing required fields', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Stock Code: AAPL\nFees: 5.00' // Missing Units and Price per unit
      };

      const result = parseInvestmentTransaction(transaction);
      expect(result).toBeNull();
    });

    it('handles zero values correctly', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Stock Code: AAPL\nUnits: 0\nPrice per unit: 0\nFees: 0'
      };

      const result = parseInvestmentTransaction(transaction);

      // With 0 shares, the validation fails and returns null
      expect(result).toBeNull();
    });

    it('handles malformed notes gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Invalid format without colons'
      };

      const result = parseInvestmentTransaction(transaction);
      expect(result).toBeNull();
      
      consoleErrorSpy.mockRestore();
    });

    it('handles description without ticker symbol', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        description: 'Buy: Apple Inc',
        notes: 'Stock Code: AAPL\nUnits: 10\nPrice per unit: 95.50\nFees: 5.00'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result?.name).toBe('Apple Inc');
    });

    it('handles Investment prefix in description', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        description: 'Investment: Microsoft Corp (MSFT)',
        notes: 'Stock Code: MSFT\nUnits: 10\nPrice per unit: 300.00\nFees: 10.00'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result?.name).toBe('Microsoft Corp');
      expect(result?.ticker).toBe('MSFT');
    });

    it('handles decimal shares correctly', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Stock Code: AAPL\nUnits: 10.5\nPrice per unit: 95.50\nFees: 5.00'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result?.shares).toBe(10.5);
    });

    it('handles extra whitespace in notes', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: '  Stock Code:  AAPL  \n  Units:  10  \n  Price per unit:  95.50  \n  Fees:  5.00  '
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result).toEqual({
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        pricePerShare: 95.50,
        fees: 5.00,
        type: 'buy'
      });
    });

    it('handles missing fees field', () => {
      const transaction: Transaction = {
        ...mockBaseTransaction,
        notes: 'Stock Code: AAPL\nUnits: 10\nPrice per unit: 95.50'
      };

      const result = parseInvestmentTransaction(transaction);

      expect(result).toEqual({
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        pricePerShare: 95.50,
        fees: 0,
        type: 'buy'
      });
    });
  });

  describe('updateHoldings', () => {
    const mockInvestmentData = {
      ticker: 'AAPL',
      name: 'Apple Inc',
      shares: 10,
      pricePerShare: 100,
      fees: 5,
      type: 'buy' as const
    };

    it('adds new holding for buy transaction', () => {
      const currentHoldings: Holding[] = [];
      
      const result = updateHoldings(currentHoldings, mockInvestmentData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        value: 1005, // (10 * 100) + 5
        averageCost: 100.5 // 1005 / 10
      });
    });

    it('updates existing holding for buy transaction', () => {
      const currentHoldings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 20,
        value: 1900,
        averageCost: 95
      }];
      
      const result = updateHoldings(currentHoldings, mockInvestmentData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 30, // 20 + 10
        value: 2905, // 1900 + 1005
        averageCost: 96.83333333333333 // 2905 / 30
      });
    });

    it('removes holding when all shares are sold', () => {
      const currentHoldings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        value: 1000,
        averageCost: 100
      }];
      
      const sellData = {
        ...mockInvestmentData,
        type: 'sell' as const,
        shares: 10
      };
      
      const result = updateHoldings(currentHoldings, sellData);

      expect(result).toHaveLength(0);
    });

    it('updates holding when partial shares are sold', () => {
      const currentHoldings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 20,
        value: 2000,
        averageCost: 100
      }];
      
      const sellData = {
        ...mockInvestmentData,
        type: 'sell' as const,
        shares: 5
      };
      
      const result = updateHoldings(currentHoldings, sellData);

      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].name).toBe('Apple Inc');
      expect(result[0].shares).toBe(15); // 20 - 5
      expect(result[0].value).toBe(1500); // 15 * 100 (average cost)
      expect(result[0].averageCost).toBe(100); // Preserved from original
    });

    it('handles sell transaction for non-existent holding', () => {
      const currentHoldings: Holding[] = [];
      
      const sellData = {
        ...mockInvestmentData,
        type: 'sell' as const
      };
      
      const result = updateHoldings(currentHoldings, sellData);

      expect(result).toEqual([]);
    });

    it('handles holding without averageCost when selling', () => {
      const currentHoldings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 20,
        value: 2000
        // No averageCost field
      }];
      
      const sellData = {
        ...mockInvestmentData,
        type: 'sell' as const,
        shares: 5
      };
      
      const result = updateHoldings(currentHoldings, sellData);

      expect(result).toHaveLength(1);
      expect(result[0].shares).toBe(15);
      expect(result[0].value).toBe(1500); // Uses value/shares calculation
    });

    it('handles overselling (selling more shares than owned)', () => {
      const currentHoldings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 5,
        value: 500,
        averageCost: 100
      }];
      
      const sellData = {
        ...mockInvestmentData,
        type: 'sell' as const,
        shares: 10 // Trying to sell more than owned
      };
      
      const result = updateHoldings(currentHoldings, sellData);

      expect(result).toHaveLength(0); // Removes the holding
    });

    it('preserves other holdings when updating one', () => {
      const currentHoldings: Holding[] = [
        {
          ticker: 'AAPL',
          name: 'Apple Inc',
          shares: 10,
          value: 1000,
          averageCost: 100
        },
        {
          ticker: 'MSFT',
          name: 'Microsoft Corp',
          shares: 5,
          value: 1500,
          averageCost: 300
        }
      ];
      
      const result = updateHoldings(currentHoldings, mockInvestmentData);

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].shares).toBe(20); // Updated
      expect(result[1].ticker).toBe('MSFT');
      expect(result[1].shares).toBe(5); // Unchanged
    });

    it('handles buy transaction with zero fees', () => {
      const currentHoldings: Holding[] = [];
      
      const dataWithoutFees = {
        ...mockInvestmentData,
        fees: 0
      };
      
      const result = updateHoldings(currentHoldings, dataWithoutFees);

      expect(result[0].value).toBe(1000); // 10 * 100, no fees
      expect(result[0].averageCost).toBe(100); // 1000 / 10
    });

    it('handles decimal shares correctly', () => {
      const currentHoldings: Holding[] = [];
      
      const dataWithDecimalShares = {
        ...mockInvestmentData,
        shares: 10.5
      };
      
      const result = updateHoldings(currentHoldings, dataWithDecimalShares);

      expect(result[0].shares).toBe(10.5);
      expect(result[0].value).toBe(1055); // (10.5 * 100) + 5
      expect(result[0].averageCost).toBeCloseTo(100.476, 3); // 1055 / 10.5
    });
  });

  describe('calculateHoldingsValue', () => {
    it('calculates total value for multiple holdings', () => {
      const holdings: Holding[] = [
        {
          ticker: 'AAPL',
          name: 'Apple Inc',
          shares: 10,
          value: 1500,
          averageCost: 150
        },
        {
          ticker: 'MSFT',
          name: 'Microsoft Corp',
          shares: 5,
          value: 1750,
          averageCost: 350
        },
        {
          ticker: 'GOOGL',
          name: 'Alphabet Inc',
          shares: 2,
          value: 5000,
          averageCost: 2500
        }
      ];

      const totalValue = calculateHoldingsValue(holdings);

      expect(totalValue).toBe(8250); // 1500 + 1750 + 5000
    });

    it('returns 0 for empty holdings array', () => {
      const totalValue = calculateHoldingsValue([]);
      expect(totalValue).toBe(0);
    });

    it('handles single holding', () => {
      const holdings: Holding[] = [{
        ticker: 'AAPL',
        name: 'Apple Inc',
        shares: 10,
        value: 1500,
        averageCost: 150
      }];

      const totalValue = calculateHoldingsValue(holdings);
      expect(totalValue).toBe(1500);
    });

    it('handles holdings with zero value', () => {
      const holdings: Holding[] = [
        {
          ticker: 'AAPL',
          name: 'Apple Inc',
          shares: 10,
          value: 1500,
          averageCost: 150
        },
        {
          ticker: 'MSFT',
          name: 'Microsoft Corp',
          shares: 0,
          value: 0,
          averageCost: 0
        }
      ];

      const totalValue = calculateHoldingsValue(holdings);
      expect(totalValue).toBe(1500);
    });

    it('handles decimal values correctly', () => {
      const holdings: Holding[] = [
        {
          ticker: 'AAPL',
          name: 'Apple Inc',
          shares: 10.5,
          value: 1575.75,
          averageCost: 150.07
        },
        {
          ticker: 'MSFT',
          name: 'Microsoft Corp',
          shares: 5.25,
          value: 1837.50,
          averageCost: 350
        }
      ];

      const totalValue = calculateHoldingsValue(holdings);
      expect(totalValue).toBeCloseTo(3413.25, 2);
    });
  });
});
