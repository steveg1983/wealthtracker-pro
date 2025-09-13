import { memo, useEffect } from 'react';
import type { DarkModeSettings } from '../../services/darkModeService';
import { logger } from '../../services/loggingService';

interface AutoScheduleSettingsProps {
  autoSchedule: DarkModeSettings['autoSchedule'];
  onScheduleChange: (schedule: DarkModeSettings['autoSchedule']) => void;
}

/**
 * Auto schedule settings component
 * Configures automatic theme switching based on time
 */
export const AutoScheduleSettings = memo(function AutoScheduleSettings({
  autoSchedule,
  onScheduleChange
}: AutoScheduleSettingsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AutoScheduleSettings component initialized', {
      componentName: 'AutoScheduleSettings'
    });
  }, []);

  if (!autoSchedule) return null;

  return (
    <div>
      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={autoSchedule.enabled}
          onChange={(e) => onScheduleChange({
            ...autoSchedule,
            enabled: e.target.checked
          })}
          className="rounded"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Schedule theme changes
        </span>
      </label>
      
      {autoSchedule.enabled && (
        <div className="grid grid-cols-2 gap-3 ml-6">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Light theme at
            </label>
            <input
              type="time"
              value={autoSchedule.lightStart}
              onChange={(e) => onScheduleChange({
                ...autoSchedule,
                lightStart: e.target.value
              })}
              className="w-full px-2 py-1 text-sm bg-blue-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Dark theme at
            </label>
            <input
              type="time"
              value={autoSchedule.darkStart}
              onChange={(e) => onScheduleChange({
                ...autoSchedule,
                darkStart: e.target.value
              })}
              className="w-full px-2 py-1 text-sm bg-blue-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
});
