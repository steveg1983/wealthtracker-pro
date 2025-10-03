import React from 'react';
import { ClockIcon } from '../icons';
import { appSettingsService } from '../../services/appSettingsService';
import ThemeSelection from './ThemeSelection';
import ColorThemeSelection from './ColorThemeSelection';
import ThemeScheduling from './ThemeScheduling';

interface AppearanceSettingsProps {
  theme: 'light' | 'dark' | 'auto' | 'scheduled';
  colorTheme: 'blue' | 'green' | 'red' | 'pink';
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string;
    darkStartTime: string;
  };
  onThemeChange: (theme: 'light' | 'dark' | 'auto' | 'scheduled') => void;
  onColorThemeChange: (colorTheme: 'blue' | 'green' | 'red' | 'pink') => void;
  onThemeScheduleChange: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string; }) => void;
}

export default function AppearanceSettings({
  theme,
  colorTheme,
  themeSchedule,
  onThemeChange,
  onColorThemeChange,
  onThemeScheduleChange
}: AppearanceSettingsProps): React.JSX.Element {
  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mb-6">
      <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Appearance</h2>
      
      {/* Theme Selection */}
      <ThemeSelection 
        theme={theme}
        onThemeChange={onThemeChange}
      />

      {/* Theme Scheduling */}
      {theme === 'scheduled' && (
        <ThemeScheduling
          themeSchedule={themeSchedule}
          onThemeScheduleChange={onThemeScheduleChange}
        />
      )}

      {/* Color Theme Palette */}
      <ColorThemeSelection
        colorTheme={colorTheme}
        onColorThemeChange={onColorThemeChange}
      />
    </div>
  );
}