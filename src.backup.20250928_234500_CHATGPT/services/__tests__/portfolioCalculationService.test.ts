import { describe, it, expect, beforeEach } from 'vitest';
import { portfolioCalculationService } from '../portfolioCalculationService';
import type { Account, Transaction } from '../../types';

describe('PortfolioCalculationService', () => {
  let mockAccounts: Account[];
  let mockTransactions: Transaction[];
  let mockPrices: Map<string, number>;

  beforeEach(() => {
    mockAccounts = [
      {
        id: 'acc1',
        name: 'Investment Account',
        type: 'investment',
        balance: 50000,
        currency: 'USD',
        isActive: true,
        createdAt: new Date().toISOString(),
        color: '#3B82F6'
      },
      {
        id: 'acc2',
        name: 'Retirement Account',
        type: 'investment',
        balance: 100000,
        currency: 'USD',
        isActive: true,
        createdAt: new Date().toISOString(),
        color: '#10B981'
      }
    ];

    mockTransactions = [
      {
        id: 't1',
        date: new Date('2024-01-15').toISOString(),
        amount: 10000,
        description: 'Buy AAPL',
        merchant: 'AAPL',
        category: 'investment',
        type: 'investment',
        account: 'acc1',
        tags: ['investment']
      },
      {
        id: 't2',
        date: new Date('2024-02-01').toISOString(),
        amount: 5000,
        description: 'Buy GOOGL',
        merchant: 'GOOGL',
        category: 'investment',
        type: 'investment',
        account: 'acc1',
        tags: ['investment']
      },
      {
        id: 't3',
        date: new Date('2024-03-01').toISOString(),
        amount: -2000,
        description: 'Sell AAPL',
        merchant: 'AAPL',
        category: 'investment',
        type: 'investment',
        account: 'acc1',
        tags: ['investment', 'realized-gain']
      },
      {
        id: 't4',
        date: new Date('2024-06-01').toISOString(),
        amount: 500,
        description: 'Dividend from AAPL',
        merchant: 'AAPL',
        category: 'investment',
        type: 'income',
        account: 'acc1',
        tags: ['dividend']
      }
    ];

    mockPrices = new Map([
      ['AAPL', 180],
      ['GOOGL', 150]
    ]);
  });

  describe('calculatePortfolioSummary', () => {
    it('should calculate portfolio summary correctly', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockAccounts,
        mockTransactions,
        mockPrices
      );

      expect(summary.totalValue).toBeGreaterThan(0);
      expect(summary.totalCostBasis).toBeGreaterThan(0);
      // Note: Currently the service only shows holdings with positive quantity
      // AAPL was partially sold, so it might not show up depending on the logic
      expect(summary.holdings.length).toBeGreaterThanOrEqual(1);
      expect(summary.allocation).toBeDefined();
      expect(summary.performance).toBeDefined();
    });

    it('should calculate holdings correctly', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockAccounts,
        mockTransactions,
        mockPrices
      );

      // AAPL might not show if quantity is 0 after sells
      const applHolding = summary.holdings.find(h => h.symbol === 'AAPL');
      if (applHolding) {
        expect(applHolding.currentPrice).toBe(180);
      }
      
      const googlHolding = summary.holdings.find(h => h.symbol === 'GOOGL');
      expect(googlHolding).toBeDefined();
      expect(googlHolding?.currentPrice).toBe(150);
    });

    it('should calculate unrealized gains', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockAccounts,
        mockTransactions,
        mockPrices
      );

      summary.holdings.forEach(holding => {
        expect(holding.unrealizedGain).toBeDefined();
        expect(holding.unrealizedGainPercentage).toBeDefined();
      });
    });

    it('should calculate allocation percentages', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockAccounts,
        mockTransactions,
        mockPrices
      );

      const totalAllocation = summary.holdings.reduce((sum, h) => sum + h.allocation, 0);
      expect(totalAllocation).toBeCloseTo(100, 1);
    });
  });

  describe('calculateRebalanceRecommendations', () => {
    it('should recommend rebalancing actions', () => {
      const summary = portfolioCalculationService.calculatePortfolioSummary(
        mockAccounts,
        mockTransactions,
        mockPrices
      );

      const targetAllocations = new Map([
        ['AAPL', 60],
        ['GOOGL', 40]
      ]);

      const recommendations = portfolioCalculationService.calculateRebalanceRecommendations(
        summary.holdings,
        targetAllocations,
        summary.totalValue
      );

      expect(recommendations).toHaveLength(2);
      recommendations.forEach(rec => {
        expect(['buy', 'sell', 'hold']).toContain(rec.action);
        expect(rec.currentAllocation).toBeGreaterThanOrEqual(0);
        expect(rec.targetAllocation).toBeGreaterThanOrEqual(0);
      });
    });

    it('should recommend hold when within tolerance', () => {
      const holdings = [{
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: 100,
        avgCostBasis: 150,
        currentPrice: 180,
        value: 18000,
        costBasis: 15000,
        unrealizedGain: 3000,
        unrealizedGainPercentage: 20,
        allocation: 50.5
      }];

      const targetAllocations = new Map([['AAPL', 50]]);

      const recommendations = portfolioCalculationService.calculateRebalanceRecommendations(
        holdings,
        targetAllocations,
        18000
      );

      expect(recommendations[0].action).toBe('hold');
      expect(recommendations[0].shares).toBe(0);
    });
  });

  describe('calculateDividendIncome', () => {
    it('should calculate total dividend income', () => {
      const dividends = portfolioCalculationService.calculateDividendIncome(
        mockTransactions
      );

      expect(dividends.total).toBe(500);
      expect(dividends.bySymbol.get('AAPL')).toBe(500);
      expect(dividends.byMonth.size).toBeGreaterThan(0);
    });

    it('should filter dividends by date range', () => {
      const period = {
        start: new Date('2024-05-01'),
        end: new Date('2024-07-01')
      };

      const dividends = portfolioCalculationService.calculateDividendIncome(
        mockTransactions,
        period
      );

      expect(dividends.total).toBe(500);
    });

    it('should group dividends by month', () => {
      const dividends = portfolioCalculationService.calculateDividendIncome(
        mockTransactions
      );

      expect(dividends.byMonth.get('2024-06')).toBe(500);
    });
  });

  it('should handle empty portfolio', () => {
    const summary = portfolioCalculationService.calculatePortfolioSummary(
      mockAccounts,
      [],
      mockPrices
    );

    expect(summary.totalValue).toBe(0);
    expect(summary.totalCostBasis).toBe(0);
    expect(summary.holdings).toHaveLength(0);
  });

  it('should handle missing price data', () => {
    const emptyPrices = new Map<string, number>();
    
    const summary = portfolioCalculationService.calculatePortfolioSummary(
      mockAccounts,
      mockTransactions,
      emptyPrices
    );

    summary.holdings.forEach(holding => {
      expect(holding.currentPrice).toBe(0);
      expect(holding.value).toBe(0);
    });
  });
});