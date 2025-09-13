import { memo, useEffect } from 'react';
import { RefreshCwIcon, WifiIcon, WifiOffIcon, ActivityIcon } from '../../icons';
import { RealTimePortfolioService } from '../../../services/realTimePortfolioService';
import { logger } from '../../../services/loggingService';

interface PortfolioHeaderProps {
  marketStatus?: { isOpen: boolean; session: string };
  lastUpdate?: Date;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const PortfolioHeader = memo(function PortfolioHeader({
  marketStatus,
  lastUpdate,
  isRefreshing,
  onRefresh
}: PortfolioHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioHeader component initialized', {
      componentName: 'PortfolioHeader'
    });
  }, []);

  const statusDisplay = RealTimePortfolioService.getMarketStatusDisplay(marketStatus);
  const lastUpdateText = RealTimePortfolioService.formatLastUpdate(lastUpdate);

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Real-Time Portfolio
        </h2>
        <div className="flex items-center gap-4 mt-1">
          <div className={`flex items-center gap-1 text-sm ${statusDisplay.color}`}>
            {statusDisplay.icon === 'WifiIcon' ? (
              <WifiIcon size={14} />
            ) : (
              <WifiOffIcon size={14} />
            )}
            <span>{statusDisplay.text}</span>
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <ActivityIcon size={14} />
              <span>Updated {lastUpdateText}</span>
            </div>
          )}
        </div>
      </div>
      
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`p-2 rounded-lg transition-all ${
          isRefreshing 
            ? 'bg-gray-100 dark:bg-gray-700' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <RefreshCwIcon 
          size={20} 
          className={`text-gray-600 dark:text-gray-400 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
        />
      </button>
    </div>
  );
});