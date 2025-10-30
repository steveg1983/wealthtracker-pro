import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { investmentEnhancementService } from '../../services/investmentEnhancementService';
import { 
  TrendingUpIcon,
  ShieldIcon,
  RefreshCwIcon,
  ArrowRightIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { Decimal, toDecimal } from '@wealthtracker/utils';
import { useNavigate } from 'react-router-dom';
import type { BaseWidgetProps } from '../../types/widget-types';
import type { Investment } from '../../types';

export default function InvestmentEnhancementWidget({ size = 'medium' }: BaseWidgetProps) {
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  
  const investments = useMemo<Investment[]>(() => {
    const derived: Investment[] = [];

    accounts.forEach((account) => {
      if (account.type !== 'investment' || !account.holdings) {
        return;
      }

      account.holdings.forEach((holding, index) => {
        const quantity = holding.shares ?? 0;
        const averageCost = holding.averageCost ?? 0;
        const marketValue = holding.marketValue ?? holding.value ?? quantity * (holding.currentPrice ?? 0);
        const currentPrice = holding.currentPrice ?? (quantity > 0 ? marketValue / quantity : undefined);
        const symbol = holding.ticker ?? `Unknown-${index}`;
        const name = holding.name ?? symbol;
        const purchaseDate = account.openingBalanceDate ?? account.lastUpdated ?? new Date();
        const base: Investment = {
          id: `${account.id}-${symbol}`,
          accountId: account.id,
          symbol,
          name,
          quantity,
          purchasePrice: averageCost,
          purchaseDate,
          currentValue: marketValue,
          averageCost,
          costBasis: quantity * averageCost,
          createdAt: account.lastUpdated ?? new Date(),
        };

        if (currentPrice !== undefined) {
          base.currentPrice = currentPrice;
        }

        const lastUpdated = holding.lastUpdated ?? account.lastUpdated;
        if (lastUpdated) {
          base.lastUpdated = lastUpdated;
        }

        if (account.notes) {
          base.notes = account.notes;
        }

        derived.push(base);
      });
    });

    return derived;
  }, [accounts]);

  const [metrics, setMetrics] = useState({
    needsRebalancing: false,
    riskScore: 0,
    projectedDividends: toDecimal(0),
    outperformance: 0
  });

  const calculateMetrics = useCallback(() => {
    if (investments.length === 0) {
      setMetrics({
        needsRebalancing: false,
        riskScore: 0,
        projectedDividends: toDecimal(0),
        outperformance: 0
      });
      return;
    }

    const rebalancing = investmentEnhancementService.getRebalancingSuggestions(investments);
    const riskMetrics = investmentEnhancementService.calculateRiskMetrics(investments);
    const dividends = investmentEnhancementService.trackDividends(investments, transactions);
    const benchmarks = investmentEnhancementService.compareWithBenchmarks(investments);

    const totalDividends = dividends.reduce(
      (sum, d) => sum.plus(d.projectedAnnual),
      toDecimal(0)
    );

    // Average outperformance against benchmarks
    const avgOutperformance = benchmarks.benchmarks.length > 0
      ? benchmarks.benchmarks.reduce((sum, b) => sum + b.outperformance, 0) / benchmarks.benchmarks.length
      : 0;

    setMetrics({
      needsRebalancing: rebalancing.length > 0,
      riskScore: riskMetrics.diversificationScore,
      projectedDividends: totalDividends,
      outperformance: avgOutperformance
    });
  }, [investments, transactions]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  const handleViewDetails = () => {
    navigate('/enhanced-investments');
  };

  if (size === 'small') {
    return (
      <div 
        className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3"
        onClick={handleViewDetails}
      >
        <div className="flex items-center justify-between mb-2">
          <TrendingUpIcon size={20} className="text-purple-600 dark:text-purple-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Enhanced</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {metrics.riskScore}%
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Diversification
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUpIcon size={20} className="text-purple-600 dark:text-purple-400" />
          Investment Enhancement
        </h3>
        {investments.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {investments.length} holdings
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {investments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <TrendingUpIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No investments to analyze</p>
            </div>
          </div>
        ) : (
          <>
            {/* Rebalancing Alert */}
            {metrics.needsRebalancing && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <RefreshCwIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Portfolio rebalancing recommended
                  </p>
                </div>
              </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldIcon size={14} className="text-purple-600 dark:text-purple-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {metrics.riskScore}%
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                  <div 
                    className="bg-purple-500 h-1 rounded-full" 
                    style={{ width: `${metrics.riskScore}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Annual Dividends</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(metrics.projectedDividends)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Projected
                </p>
              </div>
            </div>

            {/* Performance vs Benchmarks */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">vs Benchmarks</p>
              <p className={`text-lg font-bold ${
                metrics.outperformance >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {metrics.outperformance >= 0 ? '+' : ''}
                {new Decimal(metrics.outperformance ?? 0)
                  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                  .toNumber()}%
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {metrics.outperformance >= 0 ? 'Outperforming' : 'Underperforming'}
              </p>
            </div>

            {/* View Details Button */}
            <button
              onClick={handleViewDetails}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              View Analytics
              <ArrowRightIcon size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
