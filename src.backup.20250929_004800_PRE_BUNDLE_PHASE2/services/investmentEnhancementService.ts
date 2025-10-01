import type { Investment, Account, Transaction } from '../types';
import { toDecimal, Decimal } from '../utils/decimal';
import type { DecimalInstance } from '../utils/decimal';

export interface AssetAllocation {
  category: string;
  currentPercent: number;
  targetPercent: number;
  currentValue: DecimalInstance;
  targetValue: DecimalInstance;
  difference: DecimalInstance;
  action: 'buy' | 'sell' | 'hold';
}

export interface RebalancingSuggestion {
  symbol: string;
  name: string;
  action: 'buy' | 'sell';
  amount: DecimalInstance;
  shares: number;
  reason: string;
}

export interface RiskMetrics {
  portfolioBeta: number;
  sharpeRatio: number;
  standardDeviation: number;
  diversificationScore: number;
  concentrationRisk: {
    symbol: string;
    percent: number;
    risk: 'high' | 'medium' | 'low';
  }[];
}

export interface DividendInfo {
  symbol: string;
  name: string;
  annualDividend: DecimalInstance;
  yield: number;
  exDividendDate?: Date;
  paymentDate?: Date;
  frequency: 'quarterly' | 'monthly' | 'annual';
  totalReceived: DecimalInstance;
  projectedAnnual: DecimalInstance;
}

export interface BenchmarkComparison {
  portfolio: {
    return: number;
    annualizedReturn: number;
    totalValue: DecimalInstance;
    startValue: DecimalInstance;
  };
  benchmarks: {
    name: string;
    symbol: string;
    return: number;
    annualizedReturn: number;
    outperformance: number;
  }[];
}

export interface ESGScore {
  symbol: string;
  name: string;
  environmental: number;
  social: number;
  governance: number;
  overall: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  controversies: string[];
}

const TARGET_ALLOCATIONS = {
  'US Stocks': 40,
  'International Stocks': 20,
  'Bonds': 25,
  'Real Estate': 10,
  'Commodities': 5
};

const BENCHMARK_INDICES = [
  { name: 'S&P 500', symbol: 'SPY', annualReturn: 10.5 },
  { name: 'FTSE All-World', symbol: 'VT', annualReturn: 8.2 },
  { name: 'US Total Bond', symbol: 'BND', annualReturn: 3.5 },
  { name: '60/40 Portfolio', symbol: 'BALANCED', annualReturn: 7.8 }
];

class InvestmentEnhancementService {
  // Portfolio Rebalancing
  getRebalancingSuggestions(
    investments: Investment[],
    targetAllocations: Record<string, number> = TARGET_ALLOCATIONS
  ): RebalancingSuggestion[] {
    const suggestions: RebalancingSuggestion[] = [];
    const totalValue = this.calculateTotalPortfolioValue(investments);
    
    if (totalValue.isZero()) return suggestions;

    // Calculate current allocations
    const currentAllocations = this.calculateCurrentAllocations(investments);
    
    // Compare with target allocations
    Object.entries(targetAllocations).forEach(([category, targetPercent]) => {
      const currentPercent = currentAllocations[category] || 0;
      const difference = targetPercent - currentPercent;
      
      if (Math.abs(difference) > 5) { // 5% threshold
        const targetValue = totalValue.times(targetPercent).dividedBy(100);
        const currentValue = totalValue.times(currentPercent).dividedBy(100);
        const rebalanceAmount = targetValue.minus(currentValue);
        
        // Find investments in this category
        const categoryInvestments = investments.filter(inv => 
          this.getInvestmentCategory(inv) === category
        );
        
        if (difference > 0) {
          // Need to buy more
          suggestions.push({
            symbol: category,
            name: `${category} ETF`,
            action: 'buy',
            amount: rebalanceAmount.abs(),
            shares: Math.ceil(rebalanceAmount.abs().dividedBy(toDecimal(100)).toNumber()),
            reason: `Underweight in ${category} by ${Math.abs(difference).toFixed(1)}%`
          });
        } else if (categoryInvestments.length > 0) {
          // Need to sell - pick the largest holding
          const largestHolding = categoryInvestments.reduce((a, b) => 
            toDecimal(a.currentValue).greaterThan(toDecimal(b.currentValue)) ? a : b
          );
          
          suggestions.push({
            symbol: largestHolding.symbol,
            name: largestHolding.name,
            action: 'sell',
            amount: rebalanceAmount.abs(),
            shares: Math.ceil(rebalanceAmount.abs().dividedBy(toDecimal(largestHolding.currentPrice || 100)).toNumber()),
            reason: `Overweight in ${category} by ${Math.abs(difference).toFixed(1)}%`
          });
        }
      }
    });
    
    return suggestions;
  }

  // Risk Analysis
  calculateRiskMetrics(investments: Investment[]): RiskMetrics {
    const totalValue = this.calculateTotalPortfolioValue(investments);
    const concentrationRisk: RiskMetrics['concentrationRisk'] = [];
    
    // Calculate concentration risk
    investments.forEach(inv => {
      const percent = toDecimal(inv.currentValue).dividedBy(totalValue).times(100).toNumber();
      if (percent > 5) {
        concentrationRisk.push({
          symbol: inv.symbol,
          percent,
          risk: percent > 20 ? 'high' : percent > 10 ? 'medium' : 'low'
        });
      }
    });
    
    // Mock calculations for demo
    const diversificationScore = Math.min(100, investments.length * 10);
    const portfolioBeta = 1.05;
    const sharpeRatio = 0.85;
    const standardDeviation = 12.5;
    
    return {
      portfolioBeta,
      sharpeRatio,
      standardDeviation,
      diversificationScore,
      concentrationRisk: concentrationRisk.sort((a, b) => b.percent - a.percent)
    };
  }

  // Dividend Tracking
  trackDividends(
    investments: Investment[],
    transactions: Transaction[]
  ): DividendInfo[] {
    const dividendInfo: DividendInfo[] = [];
    
    investments.forEach(inv => {
      // Find dividend transactions for this investment
      const dividendTransactions = transactions.filter(t => 
        t.type === 'income' && 
        t.category === 'investment-income' &&
        t.description.toLowerCase().includes(inv.symbol.toLowerCase()) &&
        t.description.toLowerCase().includes('dividend')
      );
      
      const totalReceived = dividendTransactions.reduce(
        (sum, t) => sum.plus(toDecimal(t.amount)),
        toDecimal(0)
      );
      
      // Mock dividend data for demo
      const annualDividend = toDecimal(inv.currentValue).times(0.02); // 2% yield
      const yield_ = 2.0;
      
      dividendInfo.push({
        symbol: inv.symbol,
        name: inv.name,
        annualDividend,
        yield: yield_,
        frequency: 'quarterly',
        totalReceived,
        projectedAnnual: annualDividend,
        exDividendDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
      });
    });
    
    return dividendInfo;
  }

  // Benchmark Comparison
  compareWithBenchmarks(
    investments: Investment[],
    startDate: Date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  ): BenchmarkComparison {
    const currentValue = this.calculateTotalPortfolioValue(investments);
    const startValue = investments.reduce(
      (sum, inv) => sum.plus(toDecimal(inv.purchasePrice).times(inv.quantity)),
      toDecimal(0)
    );
    
    const portfolioReturn = currentValue.minus(startValue).dividedBy(startValue).times(100).toNumber();
    const yearsDiff = (Date.now() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    const annualizedReturn = portfolioReturn / yearsDiff;
    
    const benchmarks = BENCHMARK_INDICES.map(benchmark => ({
      name: benchmark.name,
      symbol: benchmark.symbol,
      return: benchmark.annualReturn * yearsDiff,
      annualizedReturn: benchmark.annualReturn,
      outperformance: annualizedReturn - benchmark.annualReturn
    }));
    
    return {
      portfolio: {
        return: portfolioReturn,
        annualizedReturn,
        totalValue: currentValue,
        startValue
      },
      benchmarks
    };
  }

  // ESG Scoring
  getESGScores(investments: Investment[]): ESGScore[] {
    // Mock ESG data for demo
    const esgRatings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'] as const;
    
    return investments.map(inv => {
      const environmental = Math.floor(Math.random() * 40) + 60;
      const social = Math.floor(Math.random() * 40) + 60;
      const governance = Math.floor(Math.random() * 40) + 60;
      const overall = Math.floor((environmental + social + governance) / 3);
      
      const rating = overall >= 80 ? 'AAA' : 
                     overall >= 70 ? 'AA' :
                     overall >= 60 ? 'A' :
                     overall >= 50 ? 'BBB' :
                     overall >= 40 ? 'BB' :
                     overall >= 30 ? 'B' : 'CCC';
      
      return {
        symbol: inv.symbol,
        name: inv.name,
        environmental,
        social,
        governance,
        overall,
        rating,
        controversies: overall < 60 ? ['Environmental concerns reported'] : []
      };
    });
  }

  // Helper methods
  private calculateTotalPortfolioValue(investments: Investment[]): DecimalInstance {
    return investments.reduce(
      (sum, inv) => sum.plus(toDecimal(inv.currentValue)),
      toDecimal(0)
    );
  }

  private calculateCurrentAllocations(investments: Investment[]): Record<string, number> {
    const totalValue = this.calculateTotalPortfolioValue(investments);
    const allocations: Record<string, number> = {};
    
    investments.forEach(inv => {
      const category = this.getInvestmentCategory(inv);
      const percent = toDecimal(inv.currentValue).dividedBy(totalValue).times(100).toNumber();
      allocations[category] = (allocations[category] || 0) + percent;
    });
    
    return allocations;
  }

  private getInvestmentCategory(investment: Investment): string {
    const symbol = investment.symbol.toUpperCase();
    
    // Simple categorization based on symbol
    if (['VOO', 'SPY', 'VTI', 'IVV'].includes(symbol)) return 'US Stocks';
    if (['VEA', 'IEFA', 'VWO', 'IEMG'].includes(symbol)) return 'International Stocks';
    if (['BND', 'AGG', 'TLT', 'IEF'].includes(symbol)) return 'Bonds';
    if (['VNQ', 'IYR', 'XLRE'].includes(symbol)) return 'Real Estate';
    if (['GLD', 'SLV', 'DBC', 'PDBC'].includes(symbol)) return 'Commodities';
    
    // Default to US Stocks for individual stocks
    return 'US Stocks';
  }

  // Generate insights
  generateInsights(
    investments: Investment[],
    transactions: Transaction[]
  ): string[] {
    const insights: string[] = [];
    const riskMetrics = this.calculateRiskMetrics(investments);
    const rebalancing = this.getRebalancingSuggestions(investments);
    const dividends = this.trackDividends(investments, transactions);
    
    // Risk insights
    if (riskMetrics.diversificationScore < 50) {
      insights.push('🎯 Your portfolio needs more diversification. Consider adding different asset classes.');
    }
    
    if (riskMetrics.concentrationRisk.some(r => r.risk === 'high')) {
      insights.push('⚠️ High concentration risk detected. No single holding should exceed 20% of your portfolio.');
    }
    
    // Rebalancing insights
    if (rebalancing.length > 0) {
      insights.push(`🔄 Portfolio rebalancing recommended: ${rebalancing.length} adjustments needed.`);
    }
    
    // Dividend insights
    const totalDividends = dividends.reduce((sum, d) => sum.plus(d.projectedAnnual), toDecimal(0));
    if (totalDividends.greaterThan(0)) {
      insights.push(`💰 Projected annual dividend income: $${totalDividends.toFixed(2)}`);
    }
    
    return insights;
  }
}

export const investmentEnhancementService = new InvestmentEnhancementService();