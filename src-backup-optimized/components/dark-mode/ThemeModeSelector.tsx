import { memo, useEffect } from 'react';
import { SunIcon, MoonIcon, MonitorIcon, ClockIcon } from '../icons';
import type { DarkModeSettings } from '../../services/darkModeService';
import { useLogger } from '../services/ServiceProvider';

interface ThemeModeSelectorProps {
  mode: DarkModeSettings['mode'];
  onModeChange: (mode: DarkModeSettings['mode']) => void;
}

/**
 * Theme mode selector component
 * Allows selection between light, dark, system, and auto modes
 */
export const ThemeModeSelector = memo(function ThemeModeSelector({ mode,
  onModeChange
 }: ThemeModeSelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ThemeModeSelector component initialized', {
      componentName: 'ThemeModeSelector'
    });
  }, []);

  const options = [
    { value: 'light' as const, icon: <SunIcon size={16} />, label: 'Light' },
    { value: 'dark' as const, icon: <MoonIcon size={16} />, label: 'Dark' },
    { value: 'system' as const, icon: <MonitorIcon size={16} />, label: 'System' },
    { value: 'auto' as const, icon: <ClockIcon size={16} />, label: 'Auto' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Theme Mode
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(option => (
          <button
            key={option.value}
            onClick={() => onModeChange(option.value)}
            className={`
              flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${mode === option.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            {option.icon}
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});