import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';

export interface StockHolding {
  symbol: string;
  shares: DecimalInstance;
  averageCost: DecimalInstance;
  costBasis: DecimalInstance;
}

export interface EnhancedHolding extends StockHolding {
  quote?: any;
  currentPrice: DecimalInstance;
  marketValue: DecimalInstance;
  gain: DecimalInstance;
  gainPercent: DecimalInstance;
  dayChange: DecimalInstance;
  dayChangePercent: DecimalInstance;
  allocation: DecimalInstance;
}

export interface PortfolioMetrics {
  totalValue: DecimalInstance;
  totalCost: DecimalInstance;
  totalGain: DecimalInstance;
  totalGainPercent: DecimalInstance;
  totalDayChange: DecimalInstance;
  totalDayChangePercent: DecimalInstance;
  topGainer?: EnhancedHolding;
  topLoser?: EnhancedHolding;
  enhancedHoldings: EnhancedHolding[];
}

export class RealTimePortfolioService {
  /**
   * Calculate portfolio metrics from holdings and quotes
   */
  static calculatePortfolioMetrics(
    holdings: StockHolding[],
    quotes: Map<string, any>
  ): PortfolioMetrics {
    let totalValue = toDecimal(0);
    let totalCost = toDecimal(0);
    let totalDayChange = toDecimal(0);
    
    // Calculate enhanced holdings
    const enhancedHoldings = holdings.map(holding => {
      const quote = quotes.get(holding.symbol);
      const currentPrice = quote?.price || holding.averageCost;
      const dayChange = quote?.change || toDecimal(0);
      const dayChangePercent = quote?.changePercent || toDecimal(0);
      
      const marketValue = currentPrice.times(holding.shares);
      const gain = marketValue.minus(holding.costBasis);
      const gainPercent = holding.costBasis.greaterThan(0) 
        ? gain.dividedBy(holding.costBasis).times(100) 
        : toDecimal(0);
      
      totalValue = totalValue.plus(marketValue);
      totalCost = totalCost.plus(holding.costBasis);
      totalDayChange = totalDayChange.plus(dayChange.times(holding.shares));
      
      return {
        ...holding,
        quote,
        currentPrice,
        marketValue,
        gain,
        gainPercent,
        dayChange,
        dayChangePercent,
        allocation: toDecimal(0) // Will be calculated after
      };
    });
    
    // Calculate allocations
    enhancedHoldings.forEach(holding => {
      holding.allocation = totalValue.greaterThan(0)
        ? holding.marketValue.dividedBy(totalValue).times(100)
        : toDecimal(0);
    });
    
    // Calculate total metrics
    const totalGain = totalValue.minus(totalCost);
    const totalGainPercent = totalCost.greaterThan(0)
      ? totalGain.dividedBy(totalCost).times(100)
      : toDecimal(0);
    const totalDayChangePercent = totalValue.greaterThan(0)
      ? totalDayChange.dividedBy(totalValue.minus(totalDayChange)).times(100)
      : toDecimal(0);
    
    // Find top gainers and losers
    const sortedByDayChange = [...enhancedHoldings].sort((a, b) => 
      b.dayChangePercent.minus(a.dayChangePercent).toNumber()
    );
    
    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      totalDayChange,
      totalDayChangePercent,
      topGainer: sortedByDayChange[0],
      topLoser: sortedByDayChange[sortedByDayChange.length - 1],
      enhancedHoldings
    };
  }

  /**
   * Get market status display
   */
  static getMarketStatusDisplay(marketStatus?: { isOpen: boolean; session: string }) {
    if (!marketStatus) return { text: 'Unknown', color: 'text-gray-500' };
    
    if (marketStatus.isOpen) {
      return {
        text: `Market Open (${marketStatus.session})`,
        color: 'text-green-500',
        icon: 'WifiIcon'
      };
    }
    
    return {
      text: 'Market Closed',
      color: 'text-gray-500',
      icon: 'WifiOffIcon'
    };
  }

  /**
   * Format time since last update
   */
  static formatLastUpdate(lastUpdate?: Date): string {
    if (!lastUpdate) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return lastUpdate.toLocaleDateString();
  }

  /**
   * Get performance indicator color
   */
  static getPerformanceColor(value: DecimalInstance): string {
    const num = value.toNumber();
    if (num > 0) return 'text-green-600';
    if (num < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  /**
   * Get performance background color
   */
  static getPerformanceBackground(value: DecimalInstance): string {
    const num = value.toNumber();
    if (num > 0) return 'bg-green-50 dark:bg-green-900/20';
    if (num < 0) return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-gray-50 dark:bg-gray-900/20';
  }

  /**
   * Sort holdings by various criteria
   */
  static sortHoldings(
    holdings: EnhancedHolding[],
    sortBy: 'symbol' | 'value' | 'gain' | 'dayChange' | 'allocation'
  ): EnhancedHolding[] {
    const sorted = [...holdings];
    
    switch (sortBy) {
      case 'symbol':
        return sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
      case 'value':
        return sorted.sort((a, b) => b.marketValue.minus(a.marketValue).toNumber());
      case 'gain':
        return sorted.sort((a, b) => b.gainPercent.minus(a.gainPercent).toNumber());
      case 'dayChange':
        return sorted.sort((a, b) => b.dayChangePercent.minus(a.dayChangePercent).toNumber());
      case 'allocation':
        return sorted.sort((a, b) => b.allocation.minus(a.allocation).toNumber());
      default:
        return sorted;
    }
  }

  /**
   * Filter holdings by search query
   */
  static filterHoldings(holdings: EnhancedHolding[], query: string): EnhancedHolding[] {
    if (!query) return holdings;
    
    const lowerQuery = query.toLowerCase();
    return holdings.filter(h => 
      h.symbol.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Calculate portfolio risk metrics
   */
  static calculateRiskMetrics(holdings: EnhancedHolding[]) {
    // Calculate concentration risk
    const maxAllocation = Math.max(...holdings.map(h => h.allocation.toNumber()));
    const concentrationRisk = maxAllocation > 25 ? 'High' : maxAllocation > 15 ? 'Medium' : 'Low';
    
    // Calculate volatility (simplified)
    const avgDayChange = holdings.reduce((sum, h) => 
      sum + Math.abs(h.dayChangePercent.toNumber()), 0
    ) / holdings.length;
    
    const volatility = avgDayChange > 3 ? 'High' : avgDayChange > 1.5 ? 'Medium' : 'Low';
    
    return {
      concentrationRisk,
      volatility,
      maxAllocation,
      avgDayChange
    };
  }
}