import { memo, useEffect } from 'react';
import { TrendingUpIcon, TrendingDownIcon } from '../../icons';
import { RealTimePortfolioService } from '../../../services/realTimePortfolioService';
import { Skeleton } from '../../loading/Skeleton';
import type { EnhancedHolding } from '../../../services/realTimePortfolioService';
import { logger } from '../../../services/loggingService';

interface HoldingRowProps {
  holding: EnhancedHolding;
  formatCurrency: (value: number) => string;
  isLoading?: boolean;
}

export const HoldingRow = memo(function HoldingRow({
  holding,
  formatCurrency,
  isLoading = false
}: HoldingRowProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('HoldingRow component initialized', {
        symbol: holding.symbol,
        marketValue: holding.marketValue?.toNumber?.() || 0,
        isLoading,
        componentName: 'HoldingRow'
      });
    } catch (error) {
      logger.error('HoldingRow initialization failed:', error, 'HoldingRow');
    }
  }, [holding.symbol, holding.marketValue, isLoading]);

  const gainColor = (() => {
    try {
      return RealTimePortfolioService.getPerformanceColor(holding.gain);
    } catch (error) {
      logger.error('Failed to get gain color:', error, 'HoldingRow');
      return 'text-gray-500';
    }
  })();
  
  const dayChangeColor = (() => {
    try {
      return RealTimePortfolioService.getPerformanceColor(holding.dayChange);
    } catch (error) {
      logger.error('Failed to get day change color:', error, 'HoldingRow');
      return 'text-gray-500';
    }
  })();
  
  const rowBackground = (() => {
    try {
      return RealTimePortfolioService.getPerformanceBackground(holding.dayChange);
    } catch (error) {
      logger.error('Failed to get row background:', error, 'HoldingRow');
      return '';
    }
  })();

  if (isLoading) {
    try {
      return (
        <tr>
          <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
        </tr>
      );
    } catch (error) {
      logger.error('Failed to render loading skeleton:', error, 'HoldingRow');
      return (
        <tr>
          <td className="px-4 py-3 text-red-600 dark:text-red-400">Loading error</td>
        </tr>
      );
    }
  }

  try {
    return (
      <tr className={`border-b border-gray-200 dark:border-gray-700 ${rowBackground}`}>
        <td className="px-4 py-3">
          <span className="font-medium text-gray-900 dark:text-white">
            {holding.symbol || 'Unknown'}
          </span>
        </td>
      
        <td className="px-4 py-3 text-right">
          <span className="text-gray-600 dark:text-gray-400">
            {(() => {
              try {
                return (holding.shares || 0).toFixed(2);
              } catch (error) {
                logger.error('Failed to format shares:', error, 'HoldingRow');
                return '0.00';
              }
            })()}
          </span>
        </td>
        
        <td className="px-4 py-3 text-right">
          <span className="text-gray-900 dark:text-white">
            {(() => {
              try {
                return formatCurrency(holding.currentPrice.toNumber());
              } catch (error) {
                logger.error('Failed to format current price:', error, 'HoldingRow');
                return 'Error';
              }
            })()}
          </span>
        </td>
        
        <td className="px-4 py-3 text-right">
          <span className="text-gray-900 dark:text-white">
            {(() => {
              try {
                return formatCurrency(holding.averageCost.toNumber());
              } catch (error) {
                logger.error('Failed to format average cost:', error, 'HoldingRow');
                return 'Error';
              }
            })()}
          </span>
        </td>
        
        <td className="px-4 py-3 text-right">
          <span className="font-medium text-gray-900 dark:text-white">
            {(() => {
              try {
                return formatCurrency(holding.marketValue.toNumber());
              } catch (error) {
                logger.error('Failed to format market value:', error, 'HoldingRow');
                return 'Error';
              }
            })()}
          </span>
        </td>
      
        <td className="px-4 py-3 text-right">
          <div className={`flex items-center justify-end gap-1 ${gainColor}`}>
            {(() => {
              try {
                if (holding.gain?.greaterThan?.(0)) {
                  return <TrendingUpIcon size={16} />;
                } else if (holding.gain?.lessThan?.(0)) {
                  return <TrendingDownIcon size={16} />;
                }
                return null;
              } catch (error) {
                logger.error('Failed to determine gain trend icon:', error, 'HoldingRow');
                return null;
              }
            })()}
            <div className="text-right">
              <div className="font-medium">
                {(() => {
                  try {
                    return formatCurrency(holding.gain.toNumber());
                  } catch (error) {
                    logger.error('Failed to format gain:', error, 'HoldingRow');
                    return 'Error';
                  }
                })()}
              </div>
              <div className="text-xs">
                {(() => {
                  try {
                    return (holding.gainPercent || 0).toFixed(2);
                  } catch (error) {
                    logger.error('Failed to format gain percentage:', error, 'HoldingRow');
                    return '0.00';
                  }
                })()}%
              </div>
            </div>
          </div>
        </td>
      
        <td className="px-4 py-3 text-right">
          <div className={`flex items-center justify-end gap-1 ${dayChangeColor}`}>
            {(() => {
              try {
                if (holding.dayChange?.greaterThan?.(0)) {
                  return <TrendingUpIcon size={14} />;
                } else if (holding.dayChange?.lessThan?.(0)) {
                  return <TrendingDownIcon size={14} />;
                }
                return null;
              } catch (error) {
                logger.error('Failed to determine day change trend icon:', error, 'HoldingRow');
                return null;
              }
            })()}
            <div className="text-right">
              <div className="font-medium text-sm">
                {(() => {
                  try {
                    return formatCurrency(holding.dayChange.toNumber());
                  } catch (error) {
                    logger.error('Failed to format day change:', error, 'HoldingRow');
                    return 'Error';
                  }
                })()}
              </div>
              <div className="text-xs">
                {(() => {
                  try {
                    return (holding.dayChangePercent || 0).toFixed(2);
                  } catch (error) {
                    logger.error('Failed to format day change percentage:', error, 'HoldingRow');
                    return '0.00';
                  }
                })()}%
              </div>
            </div>
          </div>
        </td>
      
        <td className="px-4 py-3 text-right">
          <div className="text-gray-600 dark:text-gray-400">
            <div className="font-medium">
              {(() => {
                try {
                  return (holding.allocation || 0).toFixed(1);
                } catch (error) {
                  logger.error('Failed to format allocation percentage:', error, 'HoldingRow');
                  return '0.0';
                }
              })()}%
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
              <div 
                className="bg-gray-500 h-1.5 rounded-full" 
                style={{
                  width: `${(() => {
                    try {
                      return Math.min(100, Math.max(0, holding.allocation?.toNumber?.() || 0));
                    } catch (error) {
                      logger.error('Failed to calculate allocation width:', error, 'HoldingRow');
                      return 0;
                    }
                  })()}%`
                }}
              />
            </div>
          </div>
        </td>
      </tr>
    );
  } catch (error) {
    logger.error('Failed to render HoldingRow:', error, 'HoldingRow');
    return (
      <tr className="border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
        <td className="px-4 py-3 text-red-600 dark:text-red-400" colSpan={8}>
          Error displaying holding: {holding?.symbol || 'Unknown'}
        </td>
      </tr>
    );
  }
});