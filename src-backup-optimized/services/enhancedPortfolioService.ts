import { toDecimal } from '../utils/decimal';
import { convertStockPrice } from './stockPriceService';
import type { Holding } from '../types';
import Decimal from 'decimal.js';

export interface EnhancedHolding extends Holding {
  currentPrice?: number;
  marketValue?: number;
  gain?: number;
  gainPercent?: number;
  currency?: string;
  lastUpdated?: Date;
}

export interface PortfolioMetrics {
  totalMarketValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  holdingsCount: number;
  livePricesCount: number;
}

export type SortBy = 'value' | 'shares' | 'name' | 'gain';

/**
 * Service for managing enhanced portfolio calculations and operations
 */
export class EnhancedPortfolioService {
  /**
   * Calculate enhanced holdings with live prices
   */
  static async calculateEnhancedHoldings(
    holdings: Holding[],
    prices: Map<string, any>,
    currency: string
  ): Promise<{
    holdings: EnhancedHolding[];
    metrics: PortfolioMetrics;
  }> {
    const enhanced: EnhancedHolding[] = [];
    let marketValue = 0;
    let cost = 0;

    for (const holding of holdings) {
      const livePrice = prices.get(holding.ticker);
      
      if (livePrice) {
        // Convert live price to account currency
        const convertedPrice = await convertStockPrice(
          toDecimal(livePrice.price),
          livePrice.currency,
          currency
        );
        
        const holdingMarketValue = convertedPrice.times(holding.shares).toNumber();
        const holdingCost = (holding.averageCost || holding.value / holding.shares) * holding.shares;
        const gain = holdingMarketValue - holdingCost;
        const gainPercent = holdingCost > 0 ? (gain / holdingCost) * 100 : 0;

        enhanced.push({
          ...holding,
          currentPrice: convertedPrice.toNumber(),
          marketValue: holdingMarketValue,
          gain: gain,
          gainPercent: gainPercent,
          currency: livePrice.currency,
          lastUpdated: livePrice.lastUpdated,
          name: livePrice.name || holding.name
        });

        marketValue += holdingMarketValue;
        cost += holdingCost;
      } else {
        // Fallback to static data if no live price
        const staticValue = holding.value;
        enhanced.push({
          ...holding,
          marketValue: staticValue,
          currentPrice: holding.shares > 0 ? staticValue / holding.shares : 0
        });
        marketValue += staticValue;
        cost += staticValue;
      }
    }

    const totalGain = marketValue - cost;
    const totalGainPercent = cost > 0 ? (totalGain / cost) * 100 : 0;

    return {
      holdings: enhanced,
      metrics: {
        totalMarketValue: marketValue,
        totalCost: cost,
        totalGain: totalGain,
        totalGainPercent: totalGainPercent,
        holdingsCount: holdings.length,
        livePricesCount: prices.size
      }
    };
  }

  /**
   * Sort holdings by specified criteria
   */
  static sortHoldings(holdings: EnhancedHolding[], sortBy: SortBy): EnhancedHolding[] {
    return [...holdings].sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return (b.marketValue || 0) - (a.marketValue || 0);
        case 'shares':
          return b.shares - a.shares;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'gain':
          return (b.gain || 0) - (a.gain || 0);
        default:
          return 0;
      }
    });
  }

  /**
   * Calculate portfolio percentage for a holding
   */
  static getPortfolioPercentage(holdingValue: number, totalValue: number): string {
    return totalValue > 0 ? ((holdingValue / totalValue) * 100).toFixed(1) : '0';
  }

  /**
   * Format percentage with sign
   */
  static formatPercent(value: number): string {
    const formatted = value.toFixed(2);
    return value >= 0 ? `+${formatted}%` : `${formatted}%`;
  }

  /**
   * Get holding cost basis
   */
  static getHoldingCost(holding: Holding): number {
    return (holding.averageCost || holding.value / holding.shares) * holding.shares;
  }

  /**
   * Calculate holding gain/loss
   */
  static calculateHoldingGain(marketValue: number, cost: number): {
    gain: number;
    gainPercent: number;
  } {
    const gain = marketValue - cost;
    const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
    return { gain, gainPercent };
  }

  /**
   * Check if price is live
   */
  static isPriceLive(ticker: string, prices: Map<string, any>): boolean {
    return prices.has(ticker);
  }

  /**
   * Get price currency symbol
   */
  static getPriceCurrency(holding: EnhancedHolding, accountCurrency: string): string | null {
    return holding.currency && holding.currency !== accountCurrency ? holding.currency : null;
  }

  /**
   * Format shares display
   */
  static formatShares(shares: number): string {
    return shares.toLocaleString();
  }

  /**
   * Get last update time
   */
  static getLastUpdateTime(): string {
    return new Date().toLocaleTimeString();
  }
}