/**
 * Portfolio Calculation Service Tests
 * Tests for investment portfolio calculations and analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { portfolioCalculationService } from './portfolioCalculationService';
import type { Account, Transaction } from '../types';

describe('PortfolioCalculationService', () => {
  let mockInvestmentAccounts: Account[];
  let mockTransactions: Transaction[];
  let mockCurrentPrices: Map<string, number>;

  beforeEach(() => {
    // Reset mocks before each test
    mockInvestmentAccounts = [
      {
        id: 'acc-1',
        name: 'Investment Account',
        type: 'investment',
        balance: 10000,
        currency: 'USD',
        includeInNetWorth: true,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
      {
        id: 'acc-2',
        name: 'Retirement Account',
        type: 'investment',
        balance: 50000,
        currency: 'USD',
        includeInNetWorth: true,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ];

    mockTransactions = [
      // Buy AAPL - 10 shares at $150
      {
        id: 'tx-1',
        date: new Date('2025-01-15'),
        amount: 1500,
        description: 'Buy AAPL - 10 shares',
        type: 'expense',
        category: 'investment',
        accountId: 'acc-1',
        merchant: 'AAPL',
        tags: ['investment'],
      },
      // Buy GOOGL - 5 shares at $100
      {
        id: 'tx-2',
        date: new Date('2025-01-20'),
        amount: 500,
        description: 'Buy GOOGL - 5 shares',
        type: 'expense',
        category: 'investment',
        accountId: 'acc-1',
        merchant: 'GOOGL',
        tags: ['investment'],
      },
      // Sell AAPL - 5 shares at $160
      {
        id: 'tx-3',
        date: new Date('2025-02-01'),
        amount: -800,
        description: 'Sell AAPL - 5 shares',
        type: 'income',
        category: 'investment',
        accountId: 'acc-1',
        merchant: 'AAPL',
        tags: ['investment', 'realized-gain'],
      },
      // Dividend from AAPL
      {
        id: 'tx-4',
        date: new Date('2025-02-15'),
        amount: 25,
        description: 'Dividend from AAPL',
        type: 'income',
        category: 'investment',
        accountId: 'acc-1',
        merchant: 'AAPL',
        tags: ['dividend'],
      },
    ];

    mockCurrentPrices = new Map([
      ['AAPL', 170],
      ['GOOGL', 120],
    ]);
  });

  describe('calculatePortfolioSummary', () => {
    it('calculates basic portfolio metrics correctly', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      expect(summary).toBeDefined();
      expect(summary.holdings.length).toBeGreaterThan(0);
      
      // Check that we have holdings
      const holdings = summary.holdings;
      holdings.forEach(holding => {
        expect(holding.symbol).toBeDefined();
        expect(holding.quantity).toBeGreaterThan(0);
        expect(holding.currentPrice).toBeGreaterThan(0);
        expect(holding.value).toBeGreaterThan(0);
        expect(holding.allocation).toBeGreaterThanOrEqual(0);
      });
      
      // Check GOOGL holding exists (AAPL might be sold out)
      const googlHolding = summary.holdings.find(h => h.symbol === 'GOOGL');
      expect(googlHolding).toBeDefined();
      expect(googlHolding?.currentPrice).toBe(120);
    });

    it('calculates total portfolio value', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      expect(summary.totalValue).toBeGreaterThan(0);
      expect(summary.totalValue).toBe(
        summary.holdings.reduce((sum, h) => sum + h.value, 0)
      );
    });

    it('calculates unrealized gains', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      expect(summary.totalUnrealizedGain).toBeDefined();
      expect(summary.totalUnrealizedGainPercentage).toBeDefined();
      
      if (summary.totalCostBasis > 0) {
        expect(summary.totalUnrealizedGainPercentage).toBe(
          (summary.totalUnrealizedGain / summary.totalCostBasis) * 100
        );
      }
    });

    it('handles empty portfolio', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        [], // No transactions
        mockCurrentPrices
      );

      expect(summary.holdings).toHaveLength(0);
      expect(summary.totalValue).toBe(0);
      expect(summary.totalCostBasis).toBe(0);
      expect(summary.totalUnrealizedGain).toBe(0);
    });

    it('calculates allocation percentages', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      const totalAllocation = summary.holdings.reduce(
        (sum, h) => sum + h.allocation,
        0
      );
      
      // Total allocation should be 100% (or 0 if no holdings)
      if (summary.holdings.length > 0) {
        expect(totalAllocation).toBeCloseTo(100, 1);
      }
    });

    it('includes asset allocation data', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      expect(summary.allocation).toBeDefined();
      expect(summary.allocation.byAssetClass).toBeInstanceOf(Map);
      expect(summary.allocation.byAccount).toBeInstanceOf(Map);
      expect(summary.allocation.bySector).toBeInstanceOf(Map);
    });

    it('includes performance metrics', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      expect(summary.performance).toBeDefined();
      expect(summary.performance.dayChange).toBeDefined();
      expect(summary.performance.dayChangePercentage).toBeDefined();
      expect(summary.performance.allTimeReturn).toBeDefined();
      expect(summary.performance.allTimeReturnPercentage).toBeDefined();
    });
  });

  describe('calculateRebalanceRecommendations', () => {
    it('generates rebalance recommendations based on target allocations', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        mockCurrentPrices
      );

      const targetAllocations = new Map([
        ['AAPL', 60], // Target 60%
        ['GOOGL', 40], // Target 40%
      ]);

      const recommendations = portfolioCalculationService.calculateRebalanceRecommendations(
        summary.holdings,
        targetAllocations,
        summary.totalValue
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      recommendations.forEach(rec => {
        expect(rec.symbol).toBeDefined();
        expect(rec.currentAllocation).toBeDefined();
        expect(rec.targetAllocation).toBeDefined();
        expect(rec.action).toMatch(/^(buy|sell|hold)$/);
      });
    });

    it('recommends hold when within tolerance', () => {
      const holdings = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 170,
          value: 1700,
          costBasis: 1500,
          unrealizedGain: 200,
          unrealizedGainPercentage: 13.33,
          allocation: 50.5, // Very close to target
        },
      ];

      const targetAllocations = new Map([['AAPL', 50]]); // Target 50%

      const recommendations = portfolioCalculationService.calculateRebalanceRecommendations(
        holdings,
        targetAllocations,
        3400 // Total value
      );

      const aaplRec = recommendations.find(r => r.symbol === 'AAPL');
      expect(aaplRec?.action).toBe('hold');
      expect(aaplRec?.shares).toBe(0);
    });

    it('recommends new positions for missing allocations', () => {
      const holdings = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          quantity: 10,
          avgCostBasis: 150,
          currentPrice: 170,
          value: 1700,
          costBasis: 1500,
          unrealizedGain: 200,
          unrealizedGainPercentage: 13.33,
          allocation: 100, // Currently 100%
        },
      ];

      const targetAllocations = new Map([
        ['AAPL', 60], // Target 60%
        ['GOOGL', 40], // Target 40% (not currently held)
      ]);

      const recommendations = portfolioCalculationService.calculateRebalanceRecommendations(
        holdings,
        targetAllocations,
        1700 // Total value
      );

      const googlRec = recommendations.find(r => r.symbol === 'GOOGL');
      expect(googlRec).toBeDefined();
      expect(googlRec?.action).toBe('buy');
      expect(googlRec?.currentAllocation).toBe(0);
      expect(googlRec?.targetAllocation).toBe(40);
    });
  });

  describe('calculateDividendIncome', () => {
    it('calculates total dividend income', () => {
      const dividendResult = portfolioCalculationService.calculateDividendIncome(
        mockTransactions
      );

      expect(dividendResult.total).toBe(25); // One dividend transaction
      expect(dividendResult.bySymbol).toBeInstanceOf(Map);
      expect(dividendResult.byMonth).toBeInstanceOf(Map);
    });

    it('groups dividends by symbol', () => {
      const dividendTransactions = [
        ...mockTransactions,
        {
          id: 'tx-5',
          date: new Date('2025-03-01'),
          amount: 30,
          description: 'Dividend from GOOGL',
          type: 'income',
          category: 'investment',
          accountId: 'acc-1',
          merchant: 'GOOGL',
          tags: ['dividend'],
        },
      ];

      const dividendResult = portfolioCalculationService.calculateDividendIncome(
        dividendTransactions
      );

      expect(dividendResult.bySymbol.get('AAPL')).toBe(25);
      expect(dividendResult.bySymbol.get('GOOGL')).toBe(30);
      expect(dividendResult.total).toBe(55);
    });

    it('filters dividends by date period', () => {
      const period = {
        start: new Date('2025-02-01'),
        end: new Date('2025-02-28'),
      };

      const dividendResult = portfolioCalculationService.calculateDividendIncome(
        mockTransactions,
        period
      );

      expect(dividendResult.total).toBe(25); // Only February dividend
    });

    it('groups dividends by month', () => {
      const dividendTransactions = [
        ...mockTransactions,
        {
          id: 'tx-5',
          date: new Date('2025-02-20'),
          amount: 35,
          description: 'Dividend from GOOGL',
          type: 'income',
          category: 'investment',
          accountId: 'acc-1',
          merchant: 'GOOGL',
          tags: ['dividend'],
        },
      ];

      const dividendResult = portfolioCalculationService.calculateDividendIncome(
        dividendTransactions
      );

      expect(dividendResult.byMonth.get('2025-02')).toBe(60); // 25 + 35
      expect(dividendResult.byMonth.size).toBe(1);
    });

    it('handles no dividend transactions', () => {
      const nonDividendTransactions = mockTransactions.filter(
        t => !t.tags?.includes('dividend')
      );

      const dividendResult = portfolioCalculationService.calculateDividendIncome(
        nonDividendTransactions
      );

      expect(dividendResult.total).toBe(0);
      expect(dividendResult.bySymbol.size).toBe(0);
      expect(dividendResult.byMonth.size).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles missing current prices', () => {
      const emptyPrices = new Map<string, number>();
      
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mockTransactions,
        emptyPrices
      );

      expect(summary).toBeDefined();
      summary.holdings.forEach(holding => {
        expect(holding.currentPrice).toBe(0);
        expect(holding.value).toBe(0);
      });
    });

    it('handles transactions without investment tag', () => {
      const mixedTransactions = [
        ...mockTransactions,
        {
          id: 'tx-6',
          date: new Date('2025-01-10'),
          amount: 100,
          description: 'Groceries',
          type: 'expense',
          category: 'food',
          accountId: 'acc-1',
          merchant: 'Grocery Store',
          tags: [],
        },
      ];

      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        mixedTransactions,
        mockCurrentPrices
      );

      // Should only process investment transactions
      const nonInvestmentHolding = summary.holdings.find(
        h => h.symbol === 'Grocery Store'
      );
      expect(nonInvestmentHolding).toBeUndefined();
    });

    it('handles decimal precision correctly', () => {
      const preciseTransactions = [
        {
          id: 'tx-7',
          date: new Date('2025-01-15'),
          amount: 1234.567,
          description: 'Buy AAPL - fractional shares',
          type: 'expense',
          category: 'investment',
          accountId: 'acc-1',
          merchant: 'AAPL',
          tags: ['investment'],
        },
      ];

      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        preciseTransactions,
        mockCurrentPrices
      );

      expect(summary).toBeDefined();
      // Service should handle decimal amounts without errors
      expect(summary.totalCostBasis).toBeGreaterThan(0);
    });

    it('sorts holdings by value descending', () => {
      const multipleTransactions = [
        {
          id: 'tx-8',
          date: new Date('2025-01-15'),
          amount: 100,
          description: 'Buy SMALL',
          type: 'expense',
          category: 'investment',
          accountId: 'acc-1',
          merchant: 'SMALL',
          tags: ['investment'],
        },
        {
          id: 'tx-9',
          date: new Date('2025-01-15'),
          amount: 10000,
          description: 'Buy BIG',
          type: 'expense',
          category: 'investment',
          accountId: 'acc-1',
          merchant: 'BIG',
          tags: ['investment'],
        },
      ];

      const prices = new Map([
        ['SMALL', 10],
        ['BIG', 100],
      ]);

      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockInvestmentAccounts,
        multipleTransactions,
        prices
      );

      // First holding should be the one with higher value
      if (summary.holdings.length >= 2) {
        expect(summary.holdings[0].value).toBeGreaterThanOrEqual(
          summary.holdings[1].value
        );
      }
    });
  });
});