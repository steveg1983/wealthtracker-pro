import { memo, useEffect } from 'react';
import { SunIcon, MoonIcon, SettingsIcon } from '../icons';
import type { Theme } from '../../services/darkModeService';
import { logger } from '../../services/loggingService';

interface ThemeToggleButtonProps {
  currentTheme: Theme;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

/**
 * Theme toggle button component
 * Provides quick theme switching and settings access
 */
export const ThemeToggleButton = memo(function ThemeToggleButton({
  currentTheme,
  onToggleTheme,
  onOpenSettings
}: ThemeToggleButtonProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ThemeToggleButton component initialized', {
      componentName: 'ThemeToggleButton'
    });
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
          aria-label="Toggle theme"
        >
          {currentTheme === 'light' ? (
            <MoonIcon size={20} className="text-gray-700 group-hover:text-primary transition-colors" />
          ) : (
            <SunIcon size={20} className="text-yellow-500 group-hover:text-yellow-400 transition-colors" />
          )}
        </button>
        
        <button
          onClick={onOpenSettings}
          className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          aria-label="Theme settings"
        >
          <SettingsIcon size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </div>
  );
});