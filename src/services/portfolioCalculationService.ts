import { BaseService } from './base/BaseService';
import Decimal from 'decimal.js';
import type { Account, Transaction } from '../types';

type DecimalType = InstanceType<typeof Decimal>;

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  value: number;
  costBasis: number;
  unrealizedGain: number;
  unrealizedGainPercentage: number;
  allocation: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercentage: number;
  totalRealizedGain: number;
  holdings: Holding[];
  allocation: AssetAllocation;
  performance: PortfolioPerformance;
}

export interface AssetAllocation {
  byAssetClass: Map<string, { value: number; percentage: number }>;
  bySector: Map<string, { value: number; percentage: number }>;
  byAccount: Map<string, { value: number; percentage: number }>;
}

export interface PortfolioPerformance {
  dayChange: number;
  dayChangePercentage: number;
  weekChange: number;
  weekChangePercentage: number;
  monthChange: number;
  monthChangePercentage: number;
  yearChange: number;
  yearChangePercentage: number;
  allTimeReturn: number;
  allTimeReturnPercentage: number;
}

export interface RebalanceRecommendation {
  symbol: string;
  currentAllocation: number;
  targetAllocation: number;
  difference: number;
  action: 'buy' | 'sell' | 'hold';
  shares: number;
  value: number;
}

class PortfolioCalculationService extends BaseService {
  constructor() {
    super('PortfolioCalculationService');
  }

  /**
   * Calculate portfolio summary from investment accounts and transactions
   */
  calculatePortfolioSummary(
    investmentAccounts: Account[],
    transactions: Transaction[],
    currentPrices: Map<string, number>
  ): PortfolioSummary {
    const holdings = this.calculateHoldings(transactions, currentPrices);
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const totalUnrealizedGain = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const totalRealizedGain = this.calculateRealizedGains(transactions);

    // Calculate allocations
    const allocation = this.calculateAssetAllocation(holdings, investmentAccounts);
    
    // Calculate performance (simplified - would need historical data)
    const performance = this.calculatePerformance(holdings, transactions);

    return {
      totalValue,
      totalCostBasis,
      totalUnrealizedGain,
      totalUnrealizedGainPercentage: totalCostBasis > 0 
        ? (totalUnrealizedGain / totalCostBasis) * 100 
        : 0,
      totalRealizedGain,
      holdings,
      allocation,
      performance
    };
  }

  /**
   * Calculate individual holdings from transactions
   */
  private calculateHoldings(
    transactions: Transaction[],
    currentPrices: Map<string, number>
  ): Holding[] {
    const holdingsMap = new Map<string, {
      quantity: DecimalType;
      totalCost: DecimalType;
      transactions: Transaction[];
    }>();

    // Process buy/sell transactions
    transactions
      .filter(t => t.tags?.includes('investment'))
      .forEach(transaction => {
        const symbol = this.extractSymbol(transaction);
        if (!symbol) return;

        let holding = holdingsMap.get(symbol);
        if (!holding) {
          holding = {
            quantity: new Decimal(0),
            totalCost: new Decimal(0),
            transactions: []
          };
          holdingsMap.set(symbol, holding);
        }

        // Assume positive amount is buy, negative is sell
        const shares = this.extractShares(transaction);
        const amount = new Decimal(transaction.amount);

        if (amount.gt(0)) {
          // Buy transaction
          holding.quantity = holding.quantity.plus(shares);
          holding.totalCost = holding.totalCost.plus(amount);
        } else {
          // Sell transaction
          holding.quantity = holding.quantity.minus(shares);
          // Adjust cost basis proportionally
          const sellRatio = shares.dividedBy(holding.quantity.plus(shares));
          const costReduction = holding.totalCost.times(sellRatio);
          holding.totalCost = holding.totalCost.minus(costReduction);
        }

        holding.transactions.push(transaction);
      });

    // Convert to Holding array
    const holdings: Holding[] = [];
    
    holdingsMap.forEach((data, symbol) => {
      if (data.quantity.lte(0)) return; // Skip if no shares held

      const currentPrice = currentPrices.get(symbol) || 0;
      const quantity = data.quantity.toNumber();
      const costBasis = data.totalCost.toNumber();
      const avgCostBasis = costBasis / quantity;
      const value = quantity * currentPrice;
      const unrealizedGain = value - costBasis;
      const unrealizedGainPercentage = costBasis > 0 
        ? (unrealizedGain / costBasis) * 100 
        : 0;

      holdings.push({
        symbol,
        name: symbol, // Would need a symbol-to-name mapping
        quantity,
        avgCostBasis,
        currentPrice,
        value,
        costBasis,
        unrealizedGain,
        unrealizedGainPercentage,
        allocation: 0 // Will be calculated after
      });
    });

    // Calculate allocation percentages
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    holdings.forEach(holding => {
      holding.allocation = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
    });

    return holdings.sort((a, b) => b.value - a.value);
  }

  /**
   * Calculate realized gains from sell transactions
   */
  private calculateRealizedGains(transactions: Transaction[]): number {
    // This is simplified - proper implementation would need to track
    // cost basis for each lot and calculate gains on FIFO/LIFO basis
    return transactions
      .filter(t => 
        t.tags?.includes('investment') && 
        t.amount < 0 && 
        t.tags?.includes('realized-gain')
      )
      .reduce((sum, t) => {
        // Extract gain amount from transaction metadata
        const gain = this.extractRealizedGain(t);
        return sum + gain;
      }, 0);
  }

  /**
   * Calculate asset allocation
   */
  private calculateAssetAllocation(
    holdings: Holding[],
    accounts: Account[]
  ): AssetAllocation {
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    
    // By asset class (simplified - would need asset class data)
    const byAssetClass = new Map<string, { value: number; percentage: number }>();
    // This would need real asset class mapping
    byAssetClass.set('Stocks', { 
      value: totalValue * 0.7, 
      percentage: 70 
    });
    byAssetClass.set('Bonds', { 
      value: totalValue * 0.2, 
      percentage: 20 
    });
    byAssetClass.set('Cash', { 
      value: totalValue * 0.1, 
      percentage: 10 
    });

    // By sector (would need sector data)
    const bySector = new Map<string, { value: number; percentage: number }>();

    // By account
    const byAccount = new Map<string, { value: number; percentage: number }>();
    accounts.forEach(account => {
      const accountValue = account.balance || 0;
      byAccount.set(account.name, {
        value: accountValue,
        percentage: totalValue > 0 ? (accountValue / totalValue) * 100 : 0
      });
    });

    return { byAssetClass, bySector, byAccount };
  }

  /**
   * Calculate portfolio performance
   */
  private calculatePerformance(
    holdings: Holding[],
    transactions: Transaction[]
  ): PortfolioPerformance {
    // Simplified - would need historical price data
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);

    return {
      dayChange: totalValue * 0.01, // 1% placeholder
      dayChangePercentage: 1,
      weekChange: totalValue * 0.02,
      weekChangePercentage: 2,
      monthChange: totalValue * 0.05,
      monthChangePercentage: 5,
      yearChange: totalValue * 0.15,
      yearChangePercentage: 15,
      allTimeReturn: totalValue - totalCostBasis,
      allTimeReturnPercentage: totalCostBasis > 0 
        ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 
        : 0
    };
  }

  /**
   * Calculate rebalancing recommendations
   */
  calculateRebalanceRecommendations(
    holdings: Holding[],
    targetAllocations: Map<string, number>,
    totalValue: number
  ): RebalanceRecommendation[] {
    const recommendations: RebalanceRecommendation[] = [];

    holdings.forEach(holding => {
      const targetAllocation = targetAllocations.get(holding.symbol) || 0;
      const currentAllocation = holding.allocation;
      const difference = targetAllocation - currentAllocation;

      if (Math.abs(difference) < 1) {
        // Within 1% of target, no action needed
        recommendations.push({
          symbol: holding.symbol,
          currentAllocation,
          targetAllocation,
          difference,
          action: 'hold',
          shares: 0,
          value: 0
        });
      } else {
        const targetValue = (targetAllocation / 100) * totalValue;
        const currentValue = holding.value;
        const valueDifference = targetValue - currentValue;
        const shares = Math.abs(valueDifference / holding.currentPrice);

        recommendations.push({
          symbol: holding.symbol,
          currentAllocation,
          targetAllocation,
          difference,
          action: valueDifference > 0 ? 'buy' : 'sell',
          shares: Math.round(shares * 100) / 100,
          value: Math.abs(valueDifference)
        });
      }
    });

    // Add recommendations for new positions
    targetAllocations.forEach((targetAllocation, symbol) => {
      if (!holdings.find(h => h.symbol === symbol)) {
        const targetValue = (targetAllocation / 100) * totalValue;
        
        recommendations.push({
          symbol,
          currentAllocation: 0,
          targetAllocation,
          difference: targetAllocation,
          action: 'buy',
          shares: 0, // Would need current price
          value: targetValue
        });
      }
    });

    return recommendations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  /**
   * Calculate dividend income
   */
  calculateDividendIncome(
    transactions: Transaction[],
    period?: { start: Date; end: Date }
  ): {
    total: number;
    bySymbol: Map<string, number>;
    byMonth: Map<string, number>;
  } {
    const dividendTransactions = transactions.filter(t => 
      t.type === 'income' && t.tags?.includes('dividend')
    );

    let filtered = dividendTransactions;
    if (period) {
      filtered = dividendTransactions.filter(t => {
        const date = new Date(t.date);
        return date >= period.start && date <= period.end;
      });
    }

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    
    const bySymbol = new Map<string, number>();
    const byMonth = new Map<string, number>();

    filtered.forEach(transaction => {
      const symbol = this.extractSymbol(transaction);
      if (symbol) {
        bySymbol.set(symbol, (bySymbol.get(symbol) || 0) + transaction.amount);
      }

      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + transaction.amount);
    });

    return { total, bySymbol, byMonth };
  }

  /**
   * Helper methods to extract data from transactions
   */
  private extractSymbol(transaction: Transaction): string | null {
    // Would need to parse from description or metadata
    return transaction.merchant || null;
  }

  private extractShares(transaction: Transaction): DecimalType {
    // Would need to parse from description or metadata
    return new Decimal(1);
  }

  private extractRealizedGain(transaction: Transaction): number {
    // Would need to parse from description or metadata
    return 0;
  }
}

export const portfolioCalculationService = new PortfolioCalculationService();