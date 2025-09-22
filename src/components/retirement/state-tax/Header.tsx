/**
 * @component Header
 * @description Header for the state tax calculator
 */

import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

export const Header = memo(function Header(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Header component initialized', {
      componentName: 'Header'
    });
  }, []);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        State Tax Calculator for Retirement Income
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Calculate your state tax liability based on retirement income sources
      </p>
    </div>
  );
});