import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../../icons';
import { RealTimePortfolioService } from '../../../services/realTimePortfolioService';
import type { PortfolioMetrics } from '../../../services/realTimePortfolioService';
import { logger } from '../../../services/loggingService';

interface PortfolioSummaryProps {
  metrics: PortfolioMetrics;
  formatCurrency: (value: number) => string;
}

export const PortfolioSummary = memo(function PortfolioSummary({
  metrics,
  formatCurrency
}: PortfolioSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('PortfolioSummary component initialized', {
        totalValue: metrics.totalValue?.toNumber?.() || 0,
        totalGain: metrics.totalGain?.toNumber?.() || 0,
        componentName: 'PortfolioSummary'
      });
    } catch (error) {
      logger.error('PortfolioSummary initialization failed:', error, 'PortfolioSummary');
    }
  }, [metrics.totalValue, metrics.totalGain]);

  const totalGainColor = (() => {
    try {
      return RealTimePortfolioService.getPerformanceColor(metrics.totalGain);
    } catch (error) {
      logger.error('Failed to get total gain color:', error, 'PortfolioSummary');
      return 'text-gray-500';
    }
  })();
  
  const dayChangeColor = (() => {
    try {
      return RealTimePortfolioService.getPerformanceColor(metrics.totalDayChange);
    } catch (error) {
      logger.error('Failed to get day change color:', error, 'PortfolioSummary');
      return 'text-gray-500';
    }
  })();

  try {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(() => {
              try {
                return formatCurrency(metrics.totalValue.toNumber());
              } catch (error) {
                logger.error('Failed to format total value:', error, 'PortfolioSummary');
                return 'Error';
              }
            })()}
          </p>
        </div>
      
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Gain/Loss</p>
          <div className={`flex items-center gap-2 ${totalGainColor}`}>
            {(() => {
              try {
                if (metrics.totalGain?.greaterThan?.(0)) {
                  return <TrendingUpIcon size={20} />;
                } else if (metrics.totalGain?.lessThan?.(0)) {
                  return <TrendingDownIcon size={20} />;
                }
                return null;
              } catch (error) {
                logger.error('Failed to determine gain trend icon:', error, 'PortfolioSummary');
                return null;
              }
            })()}
            <div>
              <p className="text-xl font-bold">
                {(() => {
                  try {
                    return formatCurrency(metrics.totalGain.toNumber());
                  } catch (error) {
                    logger.error('Failed to format total gain:', error, 'PortfolioSummary');
                    return 'Error';
                  }
                })()}
              </p>
              <p className="text-sm">
                ({(() => {
                  try {
                    return (metrics.totalGainPercent || 0).toFixed(2);
                  } catch (error) {
                    logger.error('Failed to format gain percentage:', error, 'PortfolioSummary');
                    return '0.00';
                  }
                })()}%)
              </p>
            </div>
          </div>
        </div>
      
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Day Change</p>
          <div className={`flex items-center gap-2 ${dayChangeColor}`}>
            {(() => {
              try {
                if (metrics.totalDayChange?.greaterThan?.(0)) {
                  return <TrendingUpIcon size={20} />;
                } else if (metrics.totalDayChange?.lessThan?.(0)) {
                  return <TrendingDownIcon size={20} />;
                }
                return null;
              } catch (error) {
                logger.error('Failed to determine day change trend icon:', error, 'PortfolioSummary');
                return null;
              }
            })()}
            <div>
              <p className="text-xl font-bold">
                {(() => {
                  try {
                    return formatCurrency(metrics.totalDayChange.toNumber());
                  } catch (error) {
                    logger.error('Failed to format day change:', error, 'PortfolioSummary');
                    return 'Error';
                  }
                })()}
              </p>
              <p className="text-sm">
                ({(() => {
                  try {
                    return (metrics.totalDayChangePercent || 0).toFixed(2);
                  } catch (error) {
                    logger.error('Failed to format day change percentage:', error, 'PortfolioSummary');
                    return '0.00';
                  }
                })()}%)
              </p>
            </div>
          </div>
        </div>
      
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cost Basis</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(() => {
              try {
                return formatCurrency(metrics.totalCost.toNumber());
              } catch (error) {
                logger.error('Failed to format total cost:', error, 'PortfolioSummary');
                return 'Error';
              }
            })()}
          </p>
        </div>
      </div>
    );
  } catch (error) {
    logger.error('Failed to render PortfolioSummary:', error, 'PortfolioSummary');
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm border border-red-200 dark:border-red-700">
          <p className="text-sm text-red-600 dark:text-red-400 mb-1">Error</p>
          <p className="text-xl font-bold text-red-900 dark:text-red-100">
            Failed to load portfolio summary
          </p>
        </div>
      </div>
    );
  }
});