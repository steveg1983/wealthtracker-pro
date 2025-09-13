import React, { useEffect, memo } from 'react';
import { MoonIcon, SunIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ThemeHeaderProps {
  currentTheme: 'light' | 'dark';
}

const ThemeHeader = memo(function ThemeHeader({ currentTheme }: ThemeHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ThemeHeader component initialized', {
      componentName: 'ThemeHeader'
    });
  }, []);

  return (
    <div className="bg-gradient-to-r from-purple-600 to-gray-600 dark:from-purple-800 dark:to-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Theme Settings</h1>
          <p className="text-purple-100">
            Customize appearance and automate theme switching
          </p>
        </div>
        <div className="flex items-center gap-4">
          {currentTheme === 'dark' ? (
            <MoonIcon size={48} className="text-white/80" />
          ) : (
            <SunIcon size={48} className="text-white/80" />
          )}
        </div>
      </div>
    </div>
  );
});

export default ThemeHeader;