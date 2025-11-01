import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { advancedAnalyticsService } from '../../services/advancedAnalyticsService';
import { 
  MagicWandIcon, 
  AlertTriangleIcon, 
  LightbulbIcon,
  PiggyBankIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal, Decimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../utils/decimal';
import { getCurrencySymbol } from '../../utils/currency-decimal';
import { useNavigate } from 'react-router-dom';
import type { BaseWidgetProps } from '../../types/widget-types';
import type { FinancialInsight } from '../../services/advancedAnalyticsService';

type AIAnalyticsWidgetProps = BaseWidgetProps;

export default function AIAnalyticsWidget({ size = 'medium' }: AIAnalyticsWidgetProps) {
  const { transactions, accounts, budgets } = useApp();
  const { formatCurrency, displayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    anomalies: 0,
    insights: 0,
    savingsOpportunities: toDecimal(0),
    topInsight: null as FinancialInsight | null
  });

  const analyzeSummary = React.useCallback(() => {
    const anomalies = advancedAnalyticsService.detectSpendingAnomalies(transactions);
    const insights = advancedAnalyticsService.generateInsights(transactions, accounts, budgets);
    const opportunities = advancedAnalyticsService.identifySavingsOpportunities(transactions, accounts);
    
    const totalSavings = opportunities.reduce(
      (sum, opp) => sum.plus(opp.potentialSavings), 
      toDecimal(0)
    );

    setSummary({
      anomalies: anomalies.length,
      insights: insights.filter(i => i.priority === 'high').length,
      savingsOpportunities: totalSavings,
      topInsight: insights[0] || null
    });
  }, [transactions, accounts, budgets]);

  useEffect(() => {
    analyzeSummary();
  }, [analyzeSummary]);

  const formatWholeCurrency = React.useCallback((value: DecimalInstance | number | string) => {
    const decimalValue = toDecimal(value);
    const floored = decimalValue.toDecimalPlaces(0, Decimal.ROUND_DOWN);
    const absValue = floored.abs().toNumber();
    const symbol = getCurrencySymbol(displayCurrency);
    const formattedNumber = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absValue);
    const isNegative = floored.isNegative();

    if (displayCurrency === 'CHF') {
      return isNegative ? `-${formattedNumber} ${symbol}` : `${formattedNumber} ${symbol}`;
    }
    return isNegative ? `-${symbol}${formattedNumber}` : `${symbol}${formattedNumber}`;
  }, [displayCurrency]);

  const handleViewDetails = () => {
    navigate('/ai-analytics');
  };

  if (size === 'small') {
    return (
      <div 
        className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3"
        onClick={handleViewDetails}
      >
        <div className="flex items-center justify-between mb-2">
          <MagicWandIcon size={20} className="text-purple-600 dark:text-purple-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">AI Insights</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {summary.insights}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              New insights
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-t-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <MagicWandIcon size={20} />
            AI Analytics
          </h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs">Active</span>
          </div>
        </div>
        <p className="text-sm text-purple-100">
          Powered by advanced machine learning
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangleIcon size={16} className="text-red-600 dark:text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {summary.anomalies}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Anomalies</p>
          </div>
          
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <LightbulbIcon size={16} className="text-blue-600 dark:text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {summary.insights}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Insights</p>
          </div>
          
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <PiggyBankIcon size={16} className="text-green-600 dark:text-green-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatWholeCurrency(summary.savingsOpportunities)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Savings</p>
          </div>
        </div>

        {/* Top Insight */}
        {summary.topInsight && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Latest Insight</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {summary.topInsight.title}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {summary.topInsight.description}
            </p>
          </div>
        )}

        {/* View Details Button */}
        <button
          onClick={handleViewDetails}
          className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          View AI Analytics
        </button>
      </div>
    </div>
  );
}
