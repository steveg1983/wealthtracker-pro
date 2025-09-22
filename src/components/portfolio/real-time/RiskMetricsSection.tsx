/**
 * @component RiskMetricsSection
 * @description Display portfolio risk metrics with visual indicators
 */

import { memo, useEffect } from 'react';
import { InfoIcon } from '../../icons';
import type { RiskMetricsSectionProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const RiskMetricsSection = memo(function RiskMetricsSection({ riskMetrics 
 }: RiskMetricsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RiskMetricsSection component initialized', {
      componentName: 'RiskMetricsSection'
    });
  }, []);

  const getRiskLevel = (volatility: number): { label: string; color: string } => {
    if (volatility < 10) return { label: 'Low', color: 'text-green-600' };
    if (volatility < 20) return { label: 'Moderate', color: 'text-yellow-600' };
    return { label: 'High', color: 'text-red-600' };
  };

  const riskLevel = getRiskLevel(riskMetrics.volatility);

  return (
    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Risk Metrics
        </h3>
        <span className={`text-sm font-medium ${riskLevel.color}`}>
          {riskLevel.label} Risk
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Volatility</span>
            <InfoIcon size={14} className="text-gray-400" title="Portfolio volatility (annualized)" />
          </div>
          <div className="text-lg font-semibold">
            {riskMetrics.volatility.toFixed(2)}%
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Beta</span>
            <InfoIcon size={14} className="text-gray-400" title="Market sensitivity" />
          </div>
          <div className="text-lg font-semibold">
            {riskMetrics.beta.toFixed(2)}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Sharpe Ratio</span>
            <InfoIcon size={14} className="text-gray-400" title="Risk-adjusted returns" />
          </div>
          <div className="text-lg font-semibold">
            {riskMetrics.sharpeRatio.toFixed(2)}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Max Drawdown</span>
            <InfoIcon size={14} className="text-gray-400" title="Largest peak-to-trough decline" />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {riskMetrics.maxDrawdown.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
});