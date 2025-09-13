import { memo, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from '../../icons';
import { logger } from '../../../services/loggingService';

interface PortfolioHeaderProps {
  accountName: string;
  refreshing: boolean;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * Portfolio Header component
 * Displays portfolio title and refresh button
 */
export const PortfolioHeader = memo(function PortfolioHeader({
  accountName,
  refreshing,
  loading,
  onClose,
  onRefresh
}: PortfolioHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioHeader component initialized', {
      componentName: 'PortfolioHeader'
    });
  }, []);

  return (
    <div className="p-6 border-b-2 border-[#5A729A] dark:border-gray-700 bg-secondary dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white dark:text-white">
              {accountName} Portfolio
            </h1>
            <p className="text-sm text-white/80 dark:text-gray-300 mt-1">
              Real-time portfolio valuation
            </p>
          </div>
        </div>
        
        <button
          onClick={onRefresh}
          className={`flex items-center gap-2 px-4 py-2 text-sm border border-white/30 dark:border-gray-600 rounded-lg hover:bg-white/10 dark:hover:bg-gray-700 text-white dark:text-gray-200 ${
            refreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={refreshing || loading}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh Prices
        </button>
      </div>
    </div>
  );
});