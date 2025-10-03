import React from 'react';
import { ClockIcon } from '../icons';

interface ThemeSchedulingProps {
  themeSchedule: {
    enabled: boolean;
    lightStartTime: string;
    darkStartTime: string;
  };
  onThemeScheduleChange: (schedule: { enabled: boolean; lightStartTime: string; darkStartTime: string; }) => void;
}

export default function ThemeScheduling({
  themeSchedule,
  onThemeScheduleChange
}: ThemeSchedulingProps): React.JSX.Element {
  const handleScheduleChange = (updates: Partial<typeof themeSchedule>) => {
    onThemeScheduleChange({ ...themeSchedule, ...updates });
  };

  return (
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
            onChange={(e) => handleScheduleChange({ enabled: e.target.checked })}
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
                onChange={(e) => handleScheduleChange({ lightStartTime: e.target.value })}
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
                onChange={(e) => handleScheduleChange({ darkStartTime: e.target.value })}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}