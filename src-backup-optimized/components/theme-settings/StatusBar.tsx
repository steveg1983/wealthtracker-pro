import React, { useEffect, memo } from 'react';
import { MoonIcon, SunIcon, ClockIcon, RefreshCwIcon } from '../icons';
import type { ThemeSchedule } from '../../services/themeSchedulingService';
import { useLogger } from '../services/ServiceProvider';

interface StatusBarProps {
  currentTheme: 'light' | 'dark';
  currentSchedule: ThemeSchedule | null;
  nextThemeChange: { time: string; theme: 'light' | 'dark' } | null;
  formatTime: (time: string) => string;
}

const StatusBar = memo(function StatusBar({ currentTheme,
  currentSchedule,
  nextThemeChange,
  formatTime
 }: StatusBarProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StatusBar component initialized', {
      componentName: 'StatusBar'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-3">
          {currentTheme === 'dark' ? (
            <MoonIcon size={20} className="text-gray-600 dark:text-gray-500" />
          ) : (
            <SunIcon size={20} className="text-yellow-600 dark:text-yellow-400" />
          )}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Theme</p>
            <p className="font-semibold text-gray-900 dark:text-white capitalize">
              {currentTheme} Mode
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-3">
          <ClockIcon size={20} className="text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Schedule</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {currentSchedule ? currentSchedule.name : 'None'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-3">
          <RefreshCwIcon size={20} className="text-purple-600 dark:text-purple-400" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Next Change</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {nextThemeChange ? `${formatTime(nextThemeChange.time)} (${nextThemeChange.theme})` : 'None'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StatusBar;