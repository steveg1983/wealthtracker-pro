import { memo, useEffect } from 'react';
import { BanknoteIcon, ArrowUpIcon, ArrowDownIcon } from '../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DashboardMetrics } from '../../../services/improvedDashboardService';
import { useLogger } from '../services/ServiceProvider';

interface NetWorthHeroProps {
  metrics: DashboardMetrics;
  formatCurrency: (amount: number) => string;
}

/**
 * Net worth hero card component
 */
export const NetWorthHero = memo(function NetWorthHero({ metrics,
  formatCurrency
 }: NetWorthHeroProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('NetWorthHero component initialized', {
      componentName: 'NetWorthHero'
    });
  }, []);

  const { t } = useTranslation();

  return (
    <div 
      className="rounded-2xl p-6 sm:p-8 text-gray-600 dark:text-gray-300 shadow-lg"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(59, 130, 246, 0.1)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-200">
            {t('dashboard.yourNetWorth', 'Your Net Worth')}
          </h2>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(metrics.netWorth)}
            </span>
            {metrics.netWorthChange !== 0 && (
              metrics.netWorthChange > 0 ? (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm sm:text-base">
                  <ArrowUpIcon size={16} />
                  +{metrics.netWorthChangePercent.toFixed(1)}%
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm sm:text-base">
                  <ArrowDownIcon size={16} />
                  {metrics.netWorthChangePercent.toFixed(1)}%
                </span>
              )
            )}
          </div>
          {metrics.netWorthChange !== 0 && (
            <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              {t('dashboard.vsLastMonth', 'vs last month')}: {formatCurrency(metrics.netWorthChange)}
            </p>
          )}
        </div>
        <BanknoteIcon size={48} className="text-gray-500 dark:text-gray-400 opacity-50 hidden sm:block" />
      </div>
      
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200/20 dark:border-gray-700/20">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.assets', 'Assets')}</p>
          <p className="text-xl font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(metrics.totalAssets)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboard.liabilities', 'Liabilities')}</p>
          <p className="text-xl font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(metrics.totalLiabilities)}
          </p>
        </div>
      </div>
    </div>
  );
});