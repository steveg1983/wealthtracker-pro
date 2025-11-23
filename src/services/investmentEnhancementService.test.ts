/**
 * InvestmentEnhancementService Tests
 * Tests for the investment enhancement service including rebalancing, risk analysis, dividends
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { investmentEnhancementService } from './investmentEnhancementService';
import type { Investment, Transaction } from '../types';

// Mock decimal utility
const createMockDecimal = (value: number) => ({
  plus: (other: any) => createMockDecimal(value + (typeof other === 'number' ? other : other.toNumber())),
  minus: (other: any) => createMockDecimal(value - (typeof other === 'number' ? other : other.toNumber())),
  times: (other: number | any) => createMockDecimal(value * (typeof other === 'number' ? other : other.toNumber())),
  dividedBy: (other: any) => createMockDecimal(value / (typeof other === 'number' ? other : other.toNumber())),
  abs: () => createMockDecimal(Math.abs(value)),
  greaterThan: (other: number) => value > other,
  greaterThanOrEqualTo: (other: number) => value >= other,
  lessThan: (other: number) => value < other,
  isZero: () => value === 0,
  isNegative: () => value < 0,
  toDecimalPlaces: (decimals: number) => {
    const factor = 10 ** decimals;
    const rounded = Math.round(value * factor) / factor;
    return createMockDecimal(Number(rounded.toFixed(decimals)));
  },
  toNumber: () => value,
  toFixed: (decimals: number) => value.toFixed(decimals),
  toString: () => value.toString(),
  valueOf: () => value
});

vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => createMockDecimal(value),
  Decimal: {}
}));

// Test data
const mockInvestments: Investment[] = [
  {
    id: 'inv1',
    accountId: 'acc1',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    quantity: 100,
    purchasePrice: 350,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 400,
    currentValue: 40000,
    averageCost: 350,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'inv2',
    accountId: 'acc1',
    symbol: 'VEA',
    name: 'Vanguard FTSE Developed Markets ETF',
    quantity: 200,
    purchasePrice: 45,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 50,
    currentValue: 10000,
    averageCost: 45,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'inv3',
    accountId: 'acc1',
    symbol: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    quantity: 150,
    purchasePrice: 80,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 75,
    currentValue: 11250,
    averageCost: 80,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'inv4',
    accountId: 'acc1',
    symbol: 'VNQ',
    name: 'Vanguard Real Estate ETF',
    quantity: 50,
    purchasePrice: 85,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 90,
    currentValue: 4500,
    averageCost: 85,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'inv5',
    accountId: 'acc1',
    symbol: 'GLD',
    name: 'SPDR Gold Shares',
    quantity: 20,
    purchasePrice: 180,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 190,
    currentValue: 3800,
    averageCost: 180,
    createdAt: new Date('2024-01-01')
  }
];

const mockTransactions: Transaction[] = [
  {
    id: 't1',
    accountId: 'acc1',
    amount: 100,
    type: 'income',
    date: new Date('2024-03-15'),
    description: 'VOO Dividend',
    category: 'investment-income'
  },
  {
    id: 't2',
    accountId: 'acc1',
    amount: 50,
    type: 'income',
    date: new Date('2024-06-15'),
    description: 'VOO Dividend',
    category: 'investment-income'
  },
  {
    id: 't3',
    accountId: 'acc1',
    amount: 30,
    type: 'income',
    date: new Date('2024-03-15'),
    description: 'VEA Dividend',
    category: 'investment-income'
  },
  {
    id: 't4',
    accountId: 'acc1',
    amount: 75,
    type: 'income',
    date: new Date('2024-03-15'),
    description: 'BND Dividend Payment',
    category: 'investment-income'
  }
];

// Test for high concentration
const mockConcentratedPortfolio: Investment[] = [
  {
    id: 'inv1',
    accountId: 'acc1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 1000,
    purchasePrice: 150,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 175,
    currentValue: 175000, // 87.5% of portfolio
    averageCost: 150,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'inv2',
    accountId: 'acc1',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    quantity: 100,
    purchasePrice: 300,
    purchaseDate: new Date('2024-01-01'),
    currentPrice: 350,
    currentValue: 25000, // 12.5% of portfolio
    averageCost: 300,
    createdAt: new Date('2024-01-01')
  }
];

describe('InvestmentEnhancementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRebalancingSuggestions', () => {
    it('identifies underweight categories', () => {
      const suggestions = investmentEnhancementService.getRebalancingSuggestions(mockInvestments);
      
      // US Stocks: 57.97% (target 40%) - overweight
      // International: 14.49% (target 20%) - slightly underweight
      // Bonds: 16.30% (target 25%) - underweight
      // Real Estate: 6.52% (target 10%) - slightly underweight
      // Commodities: 5.51% (target 5%) - on target
      
      const bondSuggestion = suggestions.find(s => s.symbol === 'Bonds');
      expect(bondSuggestion).toBeDefined();
      expect(bondSuggestion?.action).toBe('buy');
      expect(bondSuggestion?.reason).toContain('Underweight in Bonds');
    });

    it('identifies overweight categories', () => {
      const suggestions = investmentEnhancementService.getRebalancingSuggestions(mockInvestments);
      
      const usStocksSuggestion = suggestions.find(s => s.symbol === 'VOO');
      expect(usStocksSuggestion).toBeDefined();
      expect(usStocksSuggestion?.action).toBe('sell');
      expect(usStocksSuggestion?.reason).toContain('Overweight in US Stocks');
    });

    it('returns empty array for empty portfolio', () => {
      const suggestions = investmentEnhancementService.getRebalancingSuggestions([]);
      expect(suggestions).toEqual([]);
    });

    it('respects 5% threshold', () => {
      // Create a well-balanced portfolio
      const balancedPortfolio: Investment[] = [
        { ...mockInvestments[0], currentValue: 40000 }, // 40% US Stocks
        { ...mockInvestments[1], currentValue: 20000 }, // 20% International
        { ...mockInvestments[2], currentValue: 25000 }, // 25% Bonds
        { ...mockInvestments[3], currentValue: 10000 }, // 10% Real Estate
        { ...mockInvestments[4], currentValue: 5000 }   // 5% Commodities
      ];
      
      const suggestions = investmentEnhancementService.getRebalancingSuggestions(balancedPortfolio);
      expect(suggestions).toHaveLength(0); // All within 5% threshold
    });

    it('calculates rebalance amounts correctly', () => {
      const suggestions = investmentEnhancementService.getRebalancingSuggestions(mockInvestments);
      
      suggestions.forEach(suggestion => {
        expect(suggestion.amount.toNumber()).toBeGreaterThan(0);
        expect(suggestion.shares).toBeGreaterThan(0);
      });
    });

    it('uses custom target allocations', () => {
      const customTargets = {
        'US Stocks': 60,
        'International Stocks': 10,
        'Bonds': 30,
        'Real Estate': 0,
        'Commodities': 0
      };
      
      const suggestions = investmentEnhancementService.getRebalancingSuggestions(
        mockInvestments,
        customTargets
      );
      
      // Should suggest selling real estate and commodities
      const realEstateSuggestion = suggestions.find(s => s.symbol === 'VNQ');
      expect(realEstateSuggestion?.action).toBe('sell');
    });
  });

  describe('calculateRiskMetrics', () => {
    it('calculates concentration risk correctly', () => {
      const metrics = investmentEnhancementService.calculateRiskMetrics(mockConcentratedPortfolio);
      
      expect(metrics.concentrationRisk).toHaveLength(2);
      expect(metrics.concentrationRisk[0]).toMatchObject({
        symbol: 'AAPL',
        percent: 87.5,
        risk: 'high'
      });
      expect(metrics.concentrationRisk[1]).toMatchObject({
        symbol: 'MSFT',
        percent: 12.5,
        risk: 'medium'
      });
    });

    it('identifies high risk for >20% positions', () => {
      const metrics = investmentEnhancementService.calculateRiskMetrics(mockConcentratedPortfolio);
      
      const highRisk = metrics.concentrationRisk.filter(r => r.risk === 'high');
      expect(highRisk).toHaveLength(1);
      expect(highRisk[0].percent).toBeGreaterThan(20);
    });

    it('calculates diversification score based on holdings count', () => {
      const metrics = investmentEnhancementService.calculateRiskMetrics(mockInvestments);
      
      // 5 holdings * 10 = 50
      expect(metrics.diversificationScore).toBe(50);
    });

    it('caps diversification score at 100', () => {
      const manyHoldings = Array(15).fill(null).map((_, i) => ({
        ...mockInvestments[0],
        id: `inv${i}`,
        symbol: `STOCK${i}`,
        currentValue: 1000
      }));
      
      const metrics = investmentEnhancementService.calculateRiskMetrics(manyHoldings);
      expect(metrics.diversificationScore).toBe(100);
    });

    it('includes mock risk metrics', () => {
      const metrics = investmentEnhancementService.calculateRiskMetrics(mockInvestments);
      
      expect(metrics.portfolioBeta).toBe(1.05);
      expect(metrics.sharpeRatio).toBe(0.85);
      expect(metrics.standardDeviation).toBe(12.5);
    });

    it('only includes positions >5% in concentration risk', () => {
      const metrics = investmentEnhancementService.calculateRiskMetrics(mockInvestments);
      
      metrics.concentrationRisk.forEach(risk => {
        expect(risk.percent).toBeGreaterThan(5);
      });
    });
  });

  describe('trackDividends', () => {
    it('matches dividend transactions to investments', () => {
      const dividends = investmentEnhancementService.trackDividends(
        mockInvestments,
        mockTransactions
      );
      
      const vooDividend = dividends.find(d => d.symbol === 'VOO');
      expect(vooDividend).toBeDefined();
      expect(vooDividend?.totalReceived.toNumber()).toBe(150); // t1 + t2
    });

    it('calculates projected annual dividends', () => {
      const dividends = investmentEnhancementService.trackDividends(
        mockInvestments,
        mockTransactions
      );
      
      dividends.forEach(dividend => {
        // 2% yield on current value
        const expected = mockInvestments.find(i => i.symbol === dividend.symbol)!.currentValue * 0.02;
        expect(dividend.annualDividend.toNumber()).toBe(expected);
        expect(dividend.yield).toBe(2.0);
      });
    });

    it('sets dividend frequency and dates', () => {
      const dividends = investmentEnhancementService.trackDividends(
        mockInvestments,
        mockTransactions
      );
      
      dividends.forEach(dividend => {
        expect(dividend.frequency).toBe('quarterly');
        expect(dividend.exDividendDate).toBeInstanceOf(Date);
        expect(dividend.paymentDate).toBeInstanceOf(Date);
        expect(dividend.paymentDate!.getTime()).toBeGreaterThan(dividend.exDividendDate!.getTime());
      });
    });

    it('handles investments with no dividend history', () => {
      const dividends = investmentEnhancementService.trackDividends(
        mockInvestments,
        []
      );
      
      dividends.forEach(dividend => {
        expect(dividend.totalReceived.toNumber()).toBe(0);
        expect(dividend.projectedAnnual.toNumber()).toBeGreaterThan(0);
      });
    });

    it('filters dividend transactions correctly', () => {
      const nonDividendTransactions: Transaction[] = [
        {
          id: 't5',
          accountId: 'acc1',
          amount: 100,
          type: 'income',
          date: new Date(),
          description: 'Interest payment',
          category: 'investment-income'
        },
        {
          id: 't6',
          accountId: 'acc1',
          amount: 200,
          type: 'income',
          date: new Date(),
          description: 'VOO Sale proceeds',
          category: 'investment'
        }
      ];
      
      const dividends = investmentEnhancementService.trackDividends(
        mockInvestments,
        nonDividendTransactions
      );
      
      const vooDividend = dividends.find(d => d.symbol === 'VOO');
      expect(vooDividend?.totalReceived.toNumber()).toBe(0);
    });
  });

  describe('compareWithBenchmarks', () => {
    it('calculates portfolio returns correctly', () => {
      const comparison = investmentEnhancementService.compareWithBenchmarks(mockInvestments);
      
      // Total current value: 69,550
      // Total purchase value: 100*350 + 200*45 + 150*80 + 50*85 + 20*180 = 63,850
      // Return: (69,550 - 63,850) / 63,850 * 100 = 8.93%
      
      expect(comparison.portfolio.return).toBeCloseTo(8.93, 1);
      expect(comparison.portfolio.totalValue.toNumber()).toBe(69550);
      expect(comparison.portfolio.startValue.toNumber()).toBe(63850);
    });

    it('calculates annualized returns', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const comparison = investmentEnhancementService.compareWithBenchmarks(
        mockInvestments,
        oneYearAgo
      );
      
      // For exactly one year, annualized return equals total return
      expect(comparison.portfolio.annualizedReturn).toBeCloseTo(comparison.portfolio.return, 1);
    });

    it('includes all benchmark indices', () => {
      const comparison = investmentEnhancementService.compareWithBenchmarks(mockInvestments);
      
      expect(comparison.benchmarks).toHaveLength(4);
      expect(comparison.benchmarks.map(b => b.name)).toContain('S&P 500');
      expect(comparison.benchmarks.map(b => b.name)).toContain('FTSE All-World');
      expect(comparison.benchmarks.map(b => b.name)).toContain('US Total Bond');
      expect(comparison.benchmarks.map(b => b.name)).toContain('60/40 Portfolio');
    });

    it('calculates outperformance correctly', () => {
      const comparison = investmentEnhancementService.compareWithBenchmarks(mockInvestments);
      
      comparison.benchmarks.forEach(benchmark => {
        const expected = comparison.portfolio.annualizedReturn - benchmark.annualizedReturn;
        expect(benchmark.outperformance).toBeCloseTo(expected, 5);
      });
    });

    it('handles different time periods', () => {
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      const comparison = investmentEnhancementService.compareWithBenchmarks(
        mockInvestments,
        twoYearsAgo
      );
      
      // Annualized return should be roughly half of total return for 2 years
      expect(comparison.portfolio.annualizedReturn).toBeLessThan(comparison.portfolio.return);
    });
  });

  describe('getESGScores', () => {
    it('generates ESG scores for all investments', () => {
      const scores = investmentEnhancementService.getESGScores(mockInvestments);
      
      expect(scores).toHaveLength(mockInvestments.length);
      scores.forEach((score, index) => {
        expect(score.symbol).toBe(mockInvestments[index].symbol);
        expect(score.name).toBe(mockInvestments[index].name);
      });
    });

    it('generates scores in valid range', () => {
      const scores = investmentEnhancementService.getESGScores(mockInvestments);
      
      scores.forEach(score => {
        expect(score.environmental).toBeGreaterThanOrEqual(60);
        expect(score.environmental).toBeLessThanOrEqual(100);
        expect(score.social).toBeGreaterThanOrEqual(60);
        expect(score.social).toBeLessThanOrEqual(100);
        expect(score.governance).toBeGreaterThanOrEqual(60);
        expect(score.governance).toBeLessThanOrEqual(100);
      });
    });

    it('calculates overall score as average', () => {
      // Mock Math.random for predictable results
      let counter = 0;
      const mockRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
        // Return values that give us E:70, S:80, G:90
        const values = [0.25, 0.5, 0.75];
        return values[counter++ % 3];
      });
      
      const scores = investmentEnhancementService.getESGScores([mockInvestments[0]]);
      
      const score = scores[0];
      const expectedOverall = Math.floor((score.environmental + score.social + score.governance) / 3);
      expect(score.overall).toBe(expectedOverall);
      
      mockRandom.mockRestore();
    });

    it('assigns correct ratings based on overall score', () => {
      const scores = investmentEnhancementService.getESGScores(mockInvestments);
      
      scores.forEach(score => {
        if (score.overall >= 80) expect(score.rating).toBe('AAA');
        else if (score.overall >= 70) expect(score.rating).toBe('AA');
        else if (score.overall >= 60) expect(score.rating).toBe('A');
        else if (score.overall >= 50) expect(score.rating).toBe('BBB');
        else if (score.overall >= 40) expect(score.rating).toBe('BB');
        else if (score.overall >= 30) expect(score.rating).toBe('B');
        else expect(score.rating).toBe('CCC');
      });
    });

    it('adds controversies for low scores', () => {
      // Mock to get low scores
      vi.spyOn(Math, 'random').mockReturnValue(0); // Will give score of 60
      
      const scores = investmentEnhancementService.getESGScores([mockInvestments[0]]);
      
      scores.forEach(score => {
        if (score.overall < 60) {
          expect(score.controversies).toContain('Environmental concerns reported');
        } else {
          expect(score.controversies).toHaveLength(0);
        }
      });
      
      vi.restoreAllMocks();
    });
  });

  describe('generateInsights', () => {
    it('generates diversification insight for low diversity', () => {
      const lowDiversityPortfolio = [mockInvestments[0], mockInvestments[1]]; // Only 2 holdings
      
      const insights = investmentEnhancementService.generateInsights(
        lowDiversityPortfolio,
        mockTransactions
      );
      
      expect(insights).toContain('🎯 Your portfolio needs more diversification. Consider adding different asset classes.');
    });

    it('generates concentration risk insight', () => {
      const insights = investmentEnhancementService.generateInsights(
        mockConcentratedPortfolio,
        mockTransactions
      );
      
      expect(insights).toContain('⚠️ High concentration risk detected. No single holding should exceed 20% of your portfolio.');
    });

    it('generates rebalancing insight when needed', () => {
      const insights = investmentEnhancementService.generateInsights(
        mockInvestments,
        mockTransactions
      );
      
      const rebalancingInsight = insights.find(i => i.includes('Portfolio rebalancing recommended'));
      expect(rebalancingInsight).toBeDefined();
    });

    it('generates dividend income insight', () => {
      const insights = investmentEnhancementService.generateInsights(
        mockInvestments,
        mockTransactions
      );
      
      const dividendInsight = insights.find(i => i.includes('Projected annual dividend income'));
      expect(dividendInsight).toBeDefined();
      expect(dividendInsight).toMatch(/\$\d+\.\d{2}/);
    });

    it('returns empty insights for perfect portfolio', () => {
      // Create a well-diversified, balanced portfolio
      const perfectPortfolio = Array(10).fill(null).map((_, i) => ({
        ...mockInvestments[0],
        id: `inv${i}`,
        symbol: `ETF${i}`,
        currentValue: 10000 // Each 10% of portfolio
      }));
      
      const insights = investmentEnhancementService.generateInsights(
        perfectPortfolio,
        []
      );
      
      // Should have no risk warnings, might have dividend insight
      const riskInsights = insights.filter(i => 
        i.includes('concentration risk') || i.includes('diversification')
      );
      expect(riskInsights).toHaveLength(0);
    });
  });

  describe('helper methods', () => {
    it('categorizes investments correctly', () => {
      const testCases = [
        { symbol: 'VOO', expected: 'US Stocks' },
        { symbol: 'SPY', expected: 'US Stocks' },
        { symbol: 'VEA', expected: 'International Stocks' },
        { symbol: 'BND', expected: 'Bonds' },
        { symbol: 'VNQ', expected: 'Real Estate' },
        { symbol: 'GLD', expected: 'Commodities' },
        { symbol: 'AAPL', expected: 'US Stocks' }, // Default
        { symbol: 'unknown', expected: 'US Stocks' } // Default
      ];
      
      testCases.forEach(test => {
        const investment = { ...mockInvestments[0], symbol: test.symbol };
        const category = investmentEnhancementService['getInvestmentCategory'](investment);
        expect(category).toBe(test.expected);
      });
    });

    it('handles case-insensitive symbols', () => {
      const investment = { ...mockInvestments[0], symbol: 'voo' };
      const category = investmentEnhancementService['getInvestmentCategory'](investment);
      expect(category).toBe('US Stocks');
    });
  });
});
