import React, { useEffect, memo } from 'react';
import { ClockIcon } from '../icons';
import type { ThemeOption, ColorTheme } from '../../services/appSettingsService';
import { useLogger } from '../services/ServiceProvider';

interface AppearanceSectionProps {
  theme: string;
  colorTheme: string;
  themeSchedule: any;
  themeOptions: ThemeOption[];
  colorThemes: ColorTheme[];
  onThemeChange: (theme: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  onColorThemeChange: (theme: 'blue' | 'green' | 'red' | 'pink') => void;
  onThemeScheduleChange: (schedule: any) => void;
}

const AppearanceSection = memo(function AppearanceSection({ theme,
  colorTheme,
  themeSchedule,
  themeOptions,
  colorThemes,
  onThemeChange,
  onColorThemeChange,
  onThemeScheduleChange
 }: AppearanceSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AppearanceSection component initialized', {
      componentName: 'AppearanceSection'
    });
  }, []);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Appearance</h2>
      
      {/* Theme Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Theme
        </label>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onThemeChange(value as any)}
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

      {/* Theme Scheduling */}
      {theme === 'scheduled' && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <ClockIcon size={20} className="text-primary" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Schedule Settings
            </h3>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={themeSchedule.enabled}
                onChange={(e) => onThemeScheduleChange({ ...themeSchedule, enabled: e.target.checked })}
                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable scheduling</span>
            </label>
            
            {themeSchedule.enabled && (
              <div className="grid grid-cols-2 gap-4 ml-7">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Light theme starts at
                  </label>
                  <input
                    type="time"
                    value={themeSchedule.lightStartTime}
                    onChange={(e) => onThemeScheduleChange({ ...themeSchedule, lightStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Dark theme starts at
                  </label>
                  <input
                    type="time"
                    value={themeSchedule.darkStartTime}
                    onChange={(e) => onThemeScheduleChange({ ...themeSchedule, darkStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Color Theme Palette */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Color Theme
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {colorThemes.map(({ value, label, colors, description }) => (
            <button
              key={value}
              onClick={() => onColorThemeChange(value as any)}
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
    </div>
  );
});

export default AppearanceSection;