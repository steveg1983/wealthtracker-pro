import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { investmentEnhancementService } from '../../services/investmentEnhancementService';
import { 
  TrendingUpIcon,
  ShieldIcon,
  RefreshCwIcon,
  ArrowRightIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, Decimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';
import { useNavigate } from 'react-router-dom';
import type { BaseWidgetProps } from '../../types/widget-types';

type InvestmentEnhancementWidgetProps = BaseWidgetProps;

export default function InvestmentEnhancementWidget({ size = 'medium' }: InvestmentEnhancementWidgetProps) {
  const { investments, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  
  const [metrics, setMetrics] = useState({
    needsRebalancing: false,
    riskScore: 0,
    projectedDividends: toDecimal(0),
    outperformance: 0
  });

  const formatPercentage = React.useCallback((value: DecimalInstance | number, decimals: number = 1) => {
    const decimalValue = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);

    if (decimals <= 0) {
      return decimalValue.toString();
    }

    const raw = decimalValue.toString();
    const isNegative = raw.startsWith('-');
    const unsignedRaw = isNegative ? raw.slice(1) : raw;
    const [integerPart, fractionalPart = ''] = unsignedRaw.split('.');
    const paddedFraction = fractionalPart.padEnd(decimals, '0');
    return `${isNegative ? '-' : ''}${integerPart}.${paddedFraction}`;
  }, []);

  const riskScoreDecimal = toDecimal(metrics.riskScore);
  const riskScoreDisplay = formatPercentage(riskScoreDecimal, 0);
  const riskScoreWidth = riskScoreDecimal.toNumber();
  const outperformanceDecimal = toDecimal(metrics.outperformance);
  const outperformanceDisplay = `${outperformanceDecimal.greaterThanOrEqualTo(0) ? '+' : '-'}${formatPercentage(outperformanceDecimal.abs(), 2)}%`;

  const calculateMetrics = React.useCallback(() => {
    const rebalancing = investmentEnhancementService.getRebalancingSuggestions(investments || []);
    const riskMetrics = investmentEnhancementService.calculateRiskMetrics(investments || []);
    const dividends = investmentEnhancementService.trackDividends(investments || [], transactions);
    const benchmarks = investmentEnhancementService.compareWithBenchmarks(investments || []);
    
    const totalDividends = dividends.reduce(
      (sum, d) => sum.plus(d.projectedAnnual), 
      toDecimal(0)
    );
    
    // Average outperformance against benchmarks
    const avgOutperformance = benchmarks.benchmarks.reduce((sum, b) => sum + b.outperformance, 0) / benchmarks.benchmarks.length;
    
    setMetrics({
      needsRebalancing: rebalancing.length > 0,
      riskScore: riskMetrics.diversificationScore,
      projectedDividends: totalDividends,
      outperformance: avgOutperformance
    });
  }, [investments, transactions]);

  useEffect(() => {
    if (investments && investments.length > 0) {
      calculateMetrics();
    }
  }, [calculateMetrics, investments]);

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
        {investments && investments.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {investments.length} holdings
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {!investments || investments.length === 0 ? (
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
                  {riskScoreDisplay}%
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                  <div 
                    className="bg-purple-500 h-1 rounded-full" 
                    style={{ width: `${riskScoreWidth}%` }}
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
                {outperformanceDisplay}
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
