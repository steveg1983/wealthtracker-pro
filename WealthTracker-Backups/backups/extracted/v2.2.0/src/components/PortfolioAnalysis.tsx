import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { logger } from '../services/loggingService';
import { useMarketData } from '../hooks/useMarketData';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import type { Account, Transaction } from '../types';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  AlertTriangleIcon,
  PieChartIcon,
  ActivityIcon,
  DollarSignIcon,
  TargetIcon,
  ShieldIcon
} from './icons';

interface PortfolioMetrics {
  totalValue: DecimalInstance;
  totalCost: DecimalInstance;
  totalGain: DecimalInstance;
  totalGainPercent: number;
  dayChange: DecimalInstance;
  dayChangePercent: number;
  beta: number;
  sharpeRatio: number;
  volatility: number;
  diversificationScore: number;
}

interface AssetAllocation {
  category: string;
  value: DecimalInstance;
  percentage: number;
  targetPercentage: number;
  difference: number;
  color: string;
}

interface HoldingAnalysis {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: DecimalInstance;
  totalValue: DecimalInstance;
  costBasis: DecimalInstance;
  gain: DecimalInstance;
  gainPercent: number;
  allocation: number;
  risk: 'low' | 'medium' | 'high';
  recommendation?: string;
}

interface RebalancingSuggestion {
  action: 'buy' | 'sell';
  symbol: string;
  shares: number;
  amount: DecimalInstance;
  reason: string;
}

export default function PortfolioAnalysis() {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
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

    // Parse holdings from transactions (simplified - in real app would have proper investment tracking)
    const holdingsMap = new Map<string, { shares: number; costBasis: DecimalInstance }>();
    
    transactions
      .filter(t => t.category === 'Investment' || t.category === 'Securities')
      .forEach(t => {
        // Extract symbol from description (simplified parsing)
        const symbolMatch = t.description.match(/\b([A-Z]{1,5})\b/);
        if (symbolMatch) {
          const symbol = symbolMatch[1];
          const current = holdingsMap.get(symbol) || { shares: 0, costBasis: toDecimal(0) };
          
          if (t.type === 'expense') {
            // Buy transaction
            const shareMatch = t.description.match(/(\d+)\s*shares?/i);
            const shares = shareMatch ? parseInt(shareMatch[1]) : 1;
            current.shares += shares;
            current.costBasis = current.costBasis.plus(toDecimal(Math.abs(t.amount)));
          } else if (t.type === 'income') {
            // Sell transaction
            const shareMatch = t.description.match(/(\d+)\s*shares?/i);
            const shares = shareMatch ? parseInt(shareMatch[1]) : 1;
            current.shares -= shares;
            // Adjust cost basis proportionally
            if (current.shares > 0) {
              const sellRatio = shares / (current.shares + shares);
              current.costBasis = current.costBasis.times(1 - sellRatio);
            }
          }
          
          if (current.shares > 0) {
            holdingsMap.set(symbol, current);
          }
        }
      });

    return { investmentAccounts, holdingsMap };
  }, [accounts, transactions]);

  // Analyze portfolio
  const analyzePortfolio = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      const { investmentAccounts, holdingsMap } = getInvestmentData();
      
      // Fetch current prices for all holdings
      const symbols = Array.from(holdingsMap.keys());
      if (symbols.length > 0) {
        await getQuotes(symbols);
      }

      // Calculate portfolio metrics
      let totalValue = toDecimal(0);
      let totalCost = toDecimal(0);
      let totalDayChange = toDecimal(0);
      const holdingsList: HoldingAnalysis[] = [];
      
      holdingsMap.forEach((holding, symbol) => {
        const quote = quotes.get(symbol);
        if (quote) {
          const value = quote.price.times(holding.shares);
          const gain = value.minus(holding.costBasis);
          const gainPercent = holding.costBasis.greaterThan(0) 
            ? gain.dividedBy(holding.costBasis).times(100).toNumber()
            : 0;
          
          totalValue = totalValue.plus(value);
          totalCost = totalCost.plus(holding.costBasis);
          totalDayChange = totalDayChange.plus(quote.change.times(holding.shares));
          
          holdingsList.push({
            symbol,
            name: symbol, // In real app, would look up company name
            shares: holding.shares,
            currentPrice: quote.price,
            totalValue: value,
            costBasis: holding.costBasis,
            gain,
            gainPercent,
            allocation: 0, // Will calculate after total
            risk: calculateRisk(quote.changePercent, gainPercent),
            recommendation: generateRecommendation(symbol, gainPercent, quote.changePercent)
          });
        }
      });

      // Add cash from investment accounts
      const cashValue = investmentAccounts.reduce(
        (sum, acc) => sum.plus(toDecimal(acc.balance)),
        toDecimal(0)
      );
      totalValue = totalValue.plus(cashValue);
      totalCost = totalCost.plus(cashValue); // Cash has 1:1 cost basis

      // Calculate allocations
      holdingsList.forEach(holding => {
        holding.allocation = totalValue.greaterThan(0)
          ? holding.totalValue.dividedBy(totalValue).times(100).toNumber()
          : 0;
      });

      // Sort by value
      holdingsList.sort((a, b) => b.totalValue.minus(a.totalValue).toNumber());

      // Calculate portfolio metrics
      const totalGain = totalValue.minus(totalCost);
      const totalGainPercent = totalCost.greaterThan(0)
        ? totalGain.dividedBy(totalCost).times(100).toNumber()
        : 0;
      const dayChangePercent = totalValue.greaterThan(0)
        ? totalDayChange.dividedBy(totalValue).times(100).toNumber()
        : 0;

      // Calculate risk metrics (simplified)
      const beta = calculatePortfolioBeta(holdingsList);
      const sharpeRatio = calculateSharpeRatio(totalGainPercent, 2.5); // Assume 2.5% risk-free rate
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

      // Calculate asset allocations
      const allocs = calculateAssetAllocations(holdingsList, cashValue, totalValue);
      setAllocations(allocs);

      // Generate rebalancing suggestions
      const rebalanceSuggestions = generateRebalancingSuggestions(holdingsList, allocs, totalValue);
      setSuggestions(rebalanceSuggestions);

    } catch (error) {
      logger.error('Error analyzing portfolio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [getInvestmentData, getQuotes, quotes]);

  // Calculate risk level
  const calculateRisk = (changePercent: number, gainPercent: number): 'low' | 'medium' | 'high' => {
    const volatility = Math.abs(changePercent);
    if (volatility > 5 || Math.abs(gainPercent) > 50) return 'high';
    if (volatility > 2 || Math.abs(gainPercent) > 20) return 'medium';
    return 'low';
  };

  // Generate recommendations
  const generateRecommendation = (symbol: string, gainPercent: number, changePercent: number): string | undefined => {
    if (gainPercent > 50) {
      return 'Consider taking some profits';
    }
    if (gainPercent < -20) {
      return 'Review position for tax-loss harvesting';
    }
    if (Math.abs(changePercent) > 5) {
      return 'High volatility - monitor closely';
    }
    return undefined;
  };

  // Calculate portfolio beta (simplified)
  const calculatePortfolioBeta = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 1;
    
    // Weighted average of individual betas (simplified - assume 1.0 for each)
    const totalValue = holdings.reduce((sum, h) => sum.plus(h.totalValue), toDecimal(0));
    let weightedBeta = 0;
    
    holdings.forEach(h => {
      const weight = totalValue.greaterThan(0) 
        ? h.totalValue.dividedBy(totalValue).toNumber()
        : 0;
      const estimatedBeta = 1 + (Math.abs(h.gainPercent) / 100) * 0.5; // Simplified estimation
      weightedBeta += estimatedBeta * weight;
    });
    
    return Math.round(weightedBeta * 100) / 100;
  };

  // Calculate Sharpe ratio
  const calculateSharpeRatio = (returnRate: number, riskFreeRate: number): number => {
    const excessReturn = returnRate - riskFreeRate;
    const stdDev = 15; // Assumed standard deviation
    return Math.round((excessReturn / stdDev) * 100) / 100;
  };

  // Calculate portfolio volatility
  const calculateVolatility = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 0;
    
    const changes = holdings.map(h => Math.abs(h.gainPercent));
    const avg = changes.reduce((sum, c) => sum + c, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / changes.length;
    
    return Math.round(Math.sqrt(variance) * 100) / 100;
  };

  // Calculate diversification score
  const calculateDiversification = (holdings: HoldingAnalysis[]): number => {
    if (holdings.length === 0) return 0;
    if (holdings.length === 1) return 20;
    
    // Score based on number of holdings and concentration
    const numHoldings = Math.min(holdings.length, 20);
    const baseScore = (numHoldings / 20) * 50;
    
    // Check concentration
    const topHolding = holdings[0]?.allocation || 0;
    const concentrationPenalty = topHolding > 30 ? (topHolding - 30) : 0;
    
    return Math.round(Math.max(0, Math.min(100, baseScore + 50 - concentrationPenalty)));
  };

  // Calculate asset allocations
  const calculateAssetAllocations = (
    holdings: HoldingAnalysis[],
    cash: DecimalInstance,
    total: DecimalInstance
  ): AssetAllocation[] => {
    // Simplified categorization
    const categories = new Map<string, DecimalInstance>();
    
    // Add cash
    categories.set('Cash', cash);
    
    // Categorize holdings (simplified - in real app would use proper categorization)
    holdings.forEach(h => {
      const category = getAssetCategory(h.symbol);
      const current = categories.get(category) || toDecimal(0);
      categories.set(category, current.plus(h.totalValue));
    });

    // Define target allocations
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
      const target = targets[category] || 0;
      
      allocations.push({
        category,
        value,
        percentage: Math.round(percentage * 10) / 10,
        targetPercentage: target,
        difference: percentage - target,
        color: colors[category] || '#6B7280'
      });
    });

    return allocations.sort((a, b) => b.percentage - a.percentage);
  };

  // Get asset category (simplified)
  const getAssetCategory = (symbol: string): string => {
    // In real app, would use proper categorization based on asset type
    if (['BND', 'AGG', 'TLT'].includes(symbol)) return 'Bonds';
    if (['VNQ', 'REIT'].includes(symbol)) return 'Real Estate';
    if (['VXUS', 'VEA', 'VWO'].includes(symbol)) return 'International';
    return 'US Stocks';
  };

  // Generate rebalancing suggestions
  const generateRebalancingSuggestions = (
    holdings: HoldingAnalysis[],
    allocations: AssetAllocation[],
    totalValue: DecimalInstance
  ): RebalancingSuggestion[] => {
    const suggestions: RebalancingSuggestion[] = [];
    
    // Check for overweight positions
    holdings.forEach(h => {
      if (h.allocation > 15) {
        suggestions.push({
          action: 'sell',
          symbol: h.symbol,
          shares: Math.floor(h.shares * 0.2),
          amount: h.currentPrice.times(Math.floor(h.shares * 0.2)),
          reason: `Position is ${h.allocation.toFixed(1)}% of portfolio (recommended max: 15%)`
        });
      }
    });

    // Check asset allocation differences
    allocations.forEach(alloc => {
      if (Math.abs(alloc.difference) > 10) {
        const targetValue = totalValue.times(alloc.targetPercentage / 100);
        const adjustmentNeeded = targetValue.minus(alloc.value);
        
        if (adjustmentNeeded.greaterThan(0)) {
          suggestions.push({
            action: 'buy',
            symbol: alloc.category,
            shares: 0, // Category level suggestion
            amount: adjustmentNeeded,
            reason: `${alloc.category} is underweight by ${Math.abs(alloc.difference).toFixed(1)}%`
          });
        } else {
          suggestions.push({
            action: 'sell',
            symbol: alloc.category,
            shares: 0,
            amount: adjustmentNeeded.abs(),
            reason: `${alloc.category} is overweight by ${Math.abs(alloc.difference).toFixed(1)}%`
          });
        }
      }
    });

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  };

  useEffect(() => {
    if (accounts.length > 0 && transactions.length > 0) {
      analyzePortfolio();
    }
  }, [accounts, transactions, analyzePortfolio]);

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ActivityIcon size={48} className="mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">
            {isAnalyzing ? 'Analyzing portfolio...' : 'No investment data available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="bg-gradient-to-r from-gray-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-blue-100 text-sm mb-1">Total Portfolio Value</p>
            <p className="text-3xl font-bold">{formatCurrency(metrics.totalValue)}</p>
            <div className="flex items-center gap-2 mt-2">
              {metrics.dayChange.greaterThanOrEqualTo(0) ? (
                <TrendingUpIcon size={20} className="text-green-300" />
              ) : (
                <TrendingDownIcon size={20} className="text-red-300" />
              )}
              <span className={metrics.dayChange.greaterThanOrEqualTo(0) ? 'text-green-300' : 'text-red-300'}>
                {formatCurrency(metrics.dayChange)} ({metrics.dayChangePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          
          <div>
            <p className="text-blue-100 text-sm mb-1">Total Gain/Loss</p>
            <p className="text-2xl font-bold">{formatCurrency(metrics.totalGain)}</p>
            <p className={`text-sm mt-1 ${metrics.totalGain.greaterThanOrEqualTo(0) ? 'text-green-300' : 'text-red-300'}`}>
              {metrics.totalGainPercent.toFixed(2)}% return
            </p>
          </div>
          
          <div>
            <p className="text-blue-100 text-sm mb-1">Risk Metrics</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-200">Beta:</span> {metrics.beta.toFixed(2)}
              </div>
              <div>
                <span className="text-blue-200">Sharpe:</span> {metrics.sharpeRatio.toFixed(2)}
              </div>
              <div>
                <span className="text-blue-200">Volatility:</span> {metrics.volatility.toFixed(1)}%
              </div>
              <div>
                <span className="text-blue-200">Diversity:</span> {metrics.diversificationScore}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {(['overview', 'allocation', 'holdings', 'rebalance'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg capitalize transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-primary shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Portfolio Health Check
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Diversification Score */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-700 dark:text-gray-300">Diversification</span>
                  <span className={`text-2xl font-bold ${getScoreColor(metrics.diversificationScore)}`}>
                    {metrics.diversificationScore}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metrics.diversificationScore >= 80 ? 'bg-green-500' :
                      metrics.diversificationScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${metrics.diversificationScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {metrics.diversificationScore >= 80 ? 'Well diversified portfolio' :
                   metrics.diversificationScore >= 60 ? 'Moderate diversification' :
                   'Consider diversifying your holdings'}
                </p>
              </div>

              {/* Risk Assessment */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-700 dark:text-gray-300">Risk Level</span>
                  <ShieldIcon size={24} className={
                    metrics.beta > 1.2 ? 'text-red-500' :
                    metrics.beta > 0.8 ? 'text-yellow-500' : 'text-green-500'
                  } />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Beta: {metrics.beta} • Volatility: {metrics.volatility}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {metrics.beta > 1.2 ? 'High risk - More volatile than market' :
                   metrics.beta > 0.8 ? 'Moderate risk - Aligned with market' :
                   'Low risk - Less volatile than market'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Asset Allocation
            </h3>
            
            {allocations.map(alloc => (
              <div key={alloc.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {alloc.category}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(alloc.value)}
                    </span>
                    <span className="font-semibold" style={{ color: alloc.color }}>
                      {alloc.percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${alloc.percentage}%`,
                        backgroundColor: alloc.color
                      }}
                    />
                  </div>
                  {alloc.targetPercentage > 0 && (
                    <div
                      className="absolute top-0 h-3 w-0.5 bg-gray-900 dark:bg-white"
                      style={{ left: `${alloc.targetPercentage}%` }}
                      title={`Target: ${alloc.targetPercentage}%`}
                    />
                  )}
                </div>
                
                {Math.abs(alloc.difference) > 5 && (
                  <p className={`text-xs ${
                    alloc.difference > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-500'
                  }`}>
                    {alloc.difference > 0 ? 'Overweight' : 'Underweight'} by {Math.abs(alloc.difference).toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'holdings' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Individual Holdings
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                    <th className="pb-2">Symbol</th>
                    <th className="pb-2 text-right">Shares</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2 text-right">Gain/Loss</th>
                    <th className="pb-2 text-right">Allocation</th>
                    <th className="pb-2 text-center">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(holding => (
                    <tr key={holding.symbol} className="border-b dark:border-gray-700">
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {holding.symbol}
                          </p>
                          {holding.recommendation && (
                            <p className="text-xs text-gray-600 dark:text-gray-500">
                              {holding.recommendation}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-900 dark:text-white">
                        {holding.shares}
                      </td>
                      <td className="py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(holding.currentPrice)}
                      </td>
                      <td className="py-3 text-right text-gray-900 dark:text-white">
                        {formatCurrency(holding.totalValue)}
                      </td>
                      <td className="py-3 text-right">
                        <div>
                          <p className={holding.gain.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatCurrency(holding.gain)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {holding.gainPercent.toFixed(2)}%
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-900 dark:text-white">
                        {holding.allocation.toFixed(1)}%
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-xs font-medium ${getRiskColor(holding.risk)}`}>
                          {holding.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rebalance' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Rebalancing Suggestions
            </h3>
            
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        suggestion.action === 'buy' 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {suggestion.action === 'buy' ? (
                          <TrendingUpIcon size={20} className="text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDownIcon size={20} className="text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {suggestion.action === 'buy' ? 'Buy' : 'Sell'} {suggestion.symbol}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(suggestion.amount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <TargetIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>Your portfolio is well-balanced!</p>
                <p className="text-sm mt-1">No rebalancing needed at this time.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}