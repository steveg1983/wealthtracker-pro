import React from 'react';
import { appSettingsService } from '../../services/appSettingsService';

interface ThemeSelectionProps {
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  onThemeChange: (theme: 'light' | 'dark' | 'auto' | 'scheduled') => void;
}

export default function ThemeSelection({
  theme,
  onThemeChange
}: ThemeSelectionProps): React.JSX.Element {
  const themeOptions = appSettingsService.getThemeOptions();

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Theme
      </label>
      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onThemeChange(value as 'light' | 'dark' | 'auto' | 'scheduled')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
              theme === value
                ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}