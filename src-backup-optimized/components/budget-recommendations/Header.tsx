/**
 * @component Header
 * @description Header for budget recommendations component
 */

import { memo, useEffect } from 'react';
import { DownloadIcon, SettingsIcon } from '../icons';
import type { HeaderProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const Header = memo(function Header({ onExport, 
  onToggleSettings 
 }: HeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Header component initialized', {
      componentName: 'Header'
    });
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Budget Recommendations
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered suggestions to optimize your spending
        </p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onExport} 
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          aria-label="Export recommendations"
        >
          <DownloadIcon size={20} />
        </button>
        <button 
          onClick={onToggleSettings} 
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          aria-label="Settings"
        >
          <SettingsIcon size={20} />
        </button>
      </div>
    </div>
  );
});