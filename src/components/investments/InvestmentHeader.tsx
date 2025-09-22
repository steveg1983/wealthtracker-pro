import React, { useEffect, memo } from 'react';
import { TrendingUpIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

const InvestmentHeader = memo(function InvestmentHeader(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InvestmentHeader component initialized', {
      componentName: 'InvestmentHeader'
    });
  }, []);
  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Enhanced Investment Analytics</h1>
          <p className="text-purple-100">
            Advanced tools for portfolio optimization and analysis
          </p>
        </div>
        <TrendingUpIcon size={48} className="text-white/80" />
      </div>
    </div>
  );
});

export default InvestmentHeader;
