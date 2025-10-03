import React from 'react';
import { appSettingsService } from '../../services/appSettingsService';

interface ColorThemeSelectionProps {
  colorTheme: 'blue' | 'green' | 'red' | 'pink';
  onColorThemeChange: (colorTheme: 'blue' | 'green' | 'red' | 'pink') => void;
}

export default function ColorThemeSelection({
  colorTheme,
  onColorThemeChange
}: ColorThemeSelectionProps): React.JSX.Element {
  const colorThemes = appSettingsService.getColorThemes();

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Color Theme
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {colorThemes.map(({ value, label, colors, description }) => (
          <button
            key={value}
            onClick={() => onColorThemeChange(value as 'blue' | 'green' | 'red' | 'pink')}
            className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all hover:shadow-md ${
              colorTheme === value
                ? 'border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 w-full">
              <div className="flex gap-1">
                {colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs opacity-70">{description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}