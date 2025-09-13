import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useMarketData } from './useMarketData';
import { toDecimal } from '../utils/decimal';
import { logger } from '../services/loggingService';
import type { DecimalInstance } from '../types/decimal-types';
import type { PortfolioMetrics } from '../components/portfolio/PortfolioMetricsCard';
import type { HoldingAnalysis } from '../components/portfolio/HoldingsTable';
import type { AssetAllocation } from '../components/portfolio/AssetAllocationChart';
import type { RebalancingSuggestion } from '../components/portfolio/RebalancingSuggestions';

export function usePortfolioAnalysis() {
  const { accounts, transactions } = useApp();
  const { getQuotes, quotes, isLoading: marketLoading } = useMarketData(true);
  
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [holdings, setHoldings] = useState<HoldingAnalysis[]>([]);
  const [suggestions, setSuggestions] = useState<RebalancingSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'allocation' | 'holdings' | 'rebalance'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Extract investment accounts and holdings
  const getInvestmentData = useCallback(() => {
    const investmentAccounts = accounts.filter(a => 
      a.type === 'investment' || a.name.toLowerCase().includes('401k') || 
      a.name.toLowerCase().includes('ira') || a.name.toLowerCase().includes('brokerage')
    );

    // Parse holdings from transactions (simplified)
    const holdingsMap = new Map<string, { shares: number; costBasis: DecimalInstance }>();
    
    transactions
      .filter(t => t.category === 'Investment' || t.category === 'Securities')
      .forEach(t => {
        const symbolMatch = t.description.match(/\b([A-Z]{1,5})\b/);
        if (symbolMatch) {
          const symbol = symbolMatch[1];
          const current = holdingsMap.get(symbol) || { shares: 0, costBasis: toDecimal(0) };
          
          if (t.type === 'expense') {
            const shareMatch = t.description.match(/(\d+)\s*shares?/i);
            const shares = shareMatch ? parseInt(shareMatch[1]) : 1;
            current.shares += shares;
            current.costBasis = current.costBasis.plus(toDecimal(Math.abs(t.amount)));
          } else if (t.type === 'income') {
            const shareMatch = t.description.match(/(\d+)\s*shares?/i);
            const shares = shareMatch ? parseInt(shareMatch[1]) : 1;
            current.shares = Math.max(0, current.shares - shares);
            const avgCost = current.shares > 0 
              ? current.costBasis.dividedBy(current.shares + shares).times(shares)
              : toDecimal(0);
            current.costBasis = current.costBasis.minus(avgCost);
          }
          
          holdingsMap.set(symbol, current);
        }
      });

    const cashValue = investmentAccounts.reduce((sum, acc) => {
      if (acc.name.toLowerCase().includes('cash') || acc.type === 'cash') {
        return sum.plus(toDecimal(acc.balance));
      }
      return sum;
    }, toDecimal(0));

    return { holdingsMap, cashValue, investmentAccounts };
  }, [accounts, transactions]);

  // Analyze portfolio
  const analyzePortfolio = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const { holdingsMap, cashValue } = getInvestmentData();
      
      if (holdingsMap.size === 0) {
        setIsAnalyzing(false);
        return;
      }

      const symbols = Array.from(holdingsMap.keys());
      await getQuotes(symbols);

      const holdingsList: HoldingAnalysis[] = [];
      let totalValue = cashValue;
      let totalCost = toDecimal(0);

      symbols.forEach(symbol => {
        const holding = holdingsMap.get(symbol)!;
        if (holding.shares === 0) return;

        const quote = quotes?.get(symbol);
        if (!quote) return;

        const currentPrice = toDecimal(quote.price || 0);
        const value = currentPrice.times(holding.shares);
        const gain = value.minus(holding.costBasis);
        const gainPercent = holding.costBasis.greaterThan(0)
          ? gain.dividedBy(holding.costBasis).times(100).toNumber()
          : 0;

        holdingsList.push({
          symbol,
          name: quote.name || symbol,
          shares: holding.shares,
          currentPrice,
          totalValue: value,
          costBasis: holding.costBasis,
          gain,
          gainPercent,
          allocation: 0,
          risk: calculateRisk(quote.changePercent || 0, gainPercent),
          recommendation: generateRecommendation(symbol, gainPercent, quote.changePercent || 0)
        });

        totalValue = totalValue.plus(value);
        totalCost = totalCost.plus(holding.costBasis);
      });

      // Update allocations
      holdingsList.forEach(h => {
        h.allocation = totalValue.greaterThan(0)
          ? h.totalValue.dividedBy(totalValue).times(100).toNumber()
          : 0;
      });

      holdingsList.sort((a, b) => b.totalValue.minus(a.totalValue).toNumber());

      // Calculate metrics
      const totalGain = totalValue.minus(totalCost);
      const totalGainPercent = totalCost.greaterThan(0)
        ? totalGain.dividedBy(totalCost).times(100).toNumber()
        : 0;

      const totalDayChange = holdingsList.reduce((sum, h) => {
        const quote = quotes?.get(h.symbol);
        if (quote && quote.change) {
          return sum.plus(toDecimal(quote.change).times(h.shares));
        }
        return sum;
      }, toDecimal(0));

      const dayChangePercent = totalValue.greaterThan(0)
        ? totalDayChange.dividedBy(totalValue).times(100).toNumber()
        : 0;

      const beta = calculatePortfolioBeta(holdingsList);
      const sharpeRatio = calculateSharpeRatio(totalGainPercent, 3);
      const volatility = calculateVolatility(holdingsList);
      const diversificationScore = calculateDiversification(holdingsList);

      setMetrics({
        totalValue,
        totalCost,
        totalGain,
        totalGainPercent,
        dayChange: totalDayChange,
        dayChangePercent,
        beta,
        sharpeRatio,
        volatility,
        diversificationScore
      });

      setHoldings(holdingsList);

      const allocs = calculateAssetAllocations(holdingsList, cashValue, totalValue);
      setAllocations(allocs);

      const rebalanceSuggestions = generateRebalancingSuggestions(holdingsList, allocs, totalValue);
      setSuggestions(rebalanceSuggestions);

    } catch (error) {
      logger.error('Error analyzing portfolio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [getInvestmentData, getQuotes, quotes]);

  // Calculation functions
  const calculateRisk = (changePercent: number, gainPercent: number): 'low' | 'medium' | 'high' => {
    const volatility = Math.abs(changePercent);
    if (volatility > 5 || Math.abs(gainPercent) > 50) return 'high';
    if (volatility > 2 || Math.abs(gainPercent) > 20) return 'medium';
    return 'low';
  };

  const generateRecommendation = (symbol: string, gainPercent: number, changePercent: number): string | undefined => {
    if (gainPercent > 50) return 'Consider taking some profits';
    if (gainPercent < -20) return 'Review position for tax-loss harvesting';
    if (Math.abs(changePercent) > 5) return 'High volatility - monitor closely';
    return undefined;
  };

  const calculatePortfolioBeta = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 1;
    const totalValue = holdings.reduce((sum, h) => sum.plus(h.totalValue), toDecimal(0));
    let weightedBeta = 0;
    
    holdings.forEach(h => {
      const weight = totalValue.greaterThan(0) 
        ? h.totalValue.dividedBy(totalValue).toNumber()
        : 0;
      const estimatedBeta = 1 + (Math.abs(h.gainPercent) / 100) * 0.5;
      weightedBeta += estimatedBeta * weight;
    });
    
    return Math.round(weightedBeta * 100) / 100;
  };

  const calculateSharpeRatio = (returnRate: number, riskFreeRate: number): number => {
    const excessReturn = returnRate - riskFreeRate;
    const stdDev = 15;
    return Math.round((excessReturn / stdDev) * 100) / 100;
  };

  const calculateVolatility = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 0;
    const changes = holdings.map(h => Math.abs(h.gainPercent));
    const avg = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / changes.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  };

  const calculateDiversification = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 0;
    if (holdings.length === 1) return 20;
    const numHoldings = Math.min(holdings.length, 20);
    const baseScore = (numHoldings / 20) * 50;
    const topHolding = holdings[0]?.allocation || 0;
    const concentrationPenalty = topHolding > 30 ? (topHolding - 30) : 0;
    return Math.round(Math.max(0, Math.min(100, baseScore + 50 - concentrationPenalty)));
  };

  const getAssetCategory = (symbol: string): string => {
    if (['BND', 'AGG', 'TLT'].includes(symbol)) return 'Bonds';
    if (['VNQ', 'REIT'].includes(symbol)) return 'Real Estate';
    if (['VXUS', 'VEA', 'VWO'].includes(symbol)) return 'International';
    return 'US Stocks';
  };

  const calculateAssetAllocations = (
    holdings: HoldingAnalysis[],
    cash: DecimalInstance,
    total: DecimalInstance
  ): AssetAllocation[] => {
    const categories = new Map<string, DecimalInstance>();
    categories.set('Cash', cash);
    
    holdings.forEach(h => {
      const category = getAssetCategory(h.symbol);
      const current = categories.get(category) || toDecimal(0);
      categories.set(category, current.plus(h.totalValue));
    });

    const targets: Record<string, number> = {
      'Cash': 10,
      'US Stocks': 40,
      'International': 20,
      'Bonds': 20,
      'Real Estate': 10
    };

    const colors: Record<string, string> = {
      'Cash': '#10B981',
      'US Stocks': '#3B82F6',
      'International': '#8B5CF6',
      'Bonds': '#F59E0B',
      'Real Estate': '#EF4444'
    };

    const allocations: AssetAllocation[] = [];
    
    categories.forEach((value, category) => {
      const percentage = total.greaterThan(0)
        ? value.dividedBy(total).times(100).toNumber()
        : 0;
      
      allocations.push({
        category,
        value,
        percentage,
        targetPercentage: targets[category] || 0,
        difference: percentage - (targets[category] || 0),
        color: colors[category] || '#6B7280'
      });
    });

    return allocations.sort((a, b) => b.percentage - a.percentage);
  };

  const generateRebalancingSuggestions = (
    holdings: HoldingAnalysis[],
    allocations: AssetAllocation[],
    totalValue: DecimalInstance
  ): RebalancingSuggestion[] => {
    const suggestions: RebalancingSuggestion[] = [];
    
    allocations.forEach(alloc => {
      if (Math.abs(alloc.difference) > 5) {
        const targetValue = totalValue.times(alloc.targetPercentage / 100);
        const diffValue = targetValue.minus(alloc.value);
        
        if (diffValue.greaterThan(1000)) {
          suggestions.push({
            action: 'buy',
            symbol: alloc.category === 'US Stocks' ? 'VOO' : 
                    alloc.category === 'International' ? 'VXUS' :
                    alloc.category === 'Bonds' ? 'BND' : 'VNQ',
            shares: Math.round(diffValue.dividedBy(100).toNumber()),
            amount: diffValue,
            reason: `${alloc.category} is ${Math.abs(alloc.difference).toFixed(1)}% below target allocation`
          });
        } else if (diffValue.lessThan(-1000)) {
          const sellCategory = holdings.find(h => getAssetCategory(h.symbol) === alloc.category);
          if (sellCategory) {
            suggestions.push({
              action: 'sell',
              symbol: sellCategory.symbol,
              shares: Math.min(sellCategory.shares, Math.round(diffValue.abs().dividedBy(sellCategory.currentPrice).toNumber())),
              amount: diffValue.abs(),
              reason: `${alloc.category} is ${Math.abs(alloc.difference).toFixed(1)}% above target allocation`
            });
          }
        }
      }
    });

    return suggestions.slice(0, 5);
  };

  useEffect(() => {
    analyzePortfolio();
  }, [analyzePortfolio]);

  return {
    metrics,
    allocations,
    holdings,
    suggestions,
    activeTab,
    setActiveTab,
    isAnalyzing,
    marketLoading,
    analyzePortfolio
  };
}