import React, { useEffect, memo } from 'react';
import { toDecimal } from '../../utils/decimal';
import type { RiskMetrics } from '../../services/investmentEnhancementService';
import { useLogger } from '../services/ServiceProvider';

interface RiskAnalysisTabProps {
  riskMetrics: RiskMetrics | null;
  getRiskLevelClass: (risk: 'high' | 'medium' | 'low') => string;
}

const RiskAnalysisTab = memo(function RiskAnalysisTab({ riskMetrics,
  getRiskLevelClass
 }: RiskAnalysisTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RiskAnalysisTab component initialized', {
      componentName: 'RiskAnalysisTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Risk Analysis</h3>
        <p className="text-sm text-purple-700 dark:text-purple-200">
          Understanding your portfolio's risk profile and diversification.
        </p>
      </div>

      {riskMetrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Portfolio Beta"
              value={toDecimal(riskMetrics.portfolioBeta).toFixed(2)}
              description={riskMetrics.portfolioBeta > 1 ? 'More volatile than market' : 'Less volatile than market'}
            />
            
            <MetricCard
              label="Sharpe Ratio"
              value={toDecimal(riskMetrics.sharpeRatio).toFixed(2)}
              description="Risk-adjusted returns"
            />
            
            <MetricCard
              label="Volatility"
              value={`${toDecimal(riskMetrics.standardDeviation).toFixed(1)}%`}
              description="Annual standard deviation"
            />
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Diversification Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {riskMetrics.diversificationScore}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${riskMetrics.diversificationScore}%` }}
                />
              </div>
            </div>
          </div>

          {riskMetrics.concentrationRisk.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Concentration Risk</h4>
              <div className="space-y-2">
                {riskMetrics.concentrationRisk.map((risk, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{risk.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        {toDecimal(risk.percent).toFixed(1)}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getRiskLevelClass(risk.risk)}`}>
                        {risk.risk.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

const MetricCard = memo(function MetricCard({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
});

export default RiskAnalysisTab;