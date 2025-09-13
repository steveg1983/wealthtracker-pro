import React, { useEffect, memo } from 'react';
import { BanknoteIcon, TrendingUpIcon, TrendingDownIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface NetWorthSummaryProps {
  netWorth: number;
  netWorthChange: number;
  netWorthChangePercent: number;
  totalAssets: number;
  totalLiabilities: number;
  formatCurrency: (value: number, currency?: string) => string;
  displayCurrency?: string;
  t: (key: string, defaultValue: string) => string;
}

export const NetWorthSummary = memo(function NetWorthSummary({
  netWorth,
  netWorthChange,
  netWorthChangePercent,
  totalAssets,
  totalLiabilities,
  formatCurrency,
  displayCurrency,
  t
}: NetWorthSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NetWorthSummary component initialized', {
      componentName: 'NetWorthSummary'
    });
  }, []);

  return (
    <div 
      className="rounded-xl p-6 sm:p-8 text-white shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1 opacity-90">
            {t('dashboard.totalNetWorth', 'Total Net Worth')}
          </h2>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-bold">
              {formatCurrency(netWorth, displayCurrency)}
            </span>
            {netWorthChange !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${
                netWorthChange > 0 ? 'text-green-200' : 'text-red-200'
              }`}>
                {netWorthChange > 0 ? (
                  <TrendingUpIcon size={16} />
                ) : (
                  <TrendingDownIcon size={16} />
                )}
                <span>{Math.abs(netWorthChangePercent).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
        <BanknoteIcon size={64} className="opacity-20" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
        <div>
          <p className="text-sm opacity-75 mb-1">
            {t('dashboard.totalAssets', 'Total Assets')}
          </p>
          <p className="text-xl font-semibold">
            {formatCurrency(totalAssets, displayCurrency)}
          </p>
        </div>
        <div>
          <p className="text-sm opacity-75 mb-1">
            {t('dashboard.totalLiabilities', 'Total Liabilities')}
          </p>
          <p className="text-xl font-semibold">
            {formatCurrency(totalLiabilities, displayCurrency)}
          </p>
        </div>
      </div>
    </div>
  );
});