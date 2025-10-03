import { memo, useEffect } from 'react';
import { PaletteIcon } from '../icons';
import type { DarkModeSettings } from '../../services/darkModeService';
import { useLogger } from '../services/ServiceProvider';

interface ContrastSettingsProps {
  contrastMode: DarkModeSettings['contrastMode'];
  onContrastChange: (mode: DarkModeSettings['contrastMode']) => void;
}

/**
 * Contrast settings component
 * Allows selection of contrast levels for accessibility
 */
export const ContrastSettings = memo(function ContrastSettings({ contrastMode,
  onContrastChange
 }: ContrastSettingsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ContrastSettings component initialized', {
      componentName: 'ContrastSettings'
    });
  }, []);

  const options = [
    { value: 'normal' as const, label: 'Normal', desc: 'WCAG AA compliant' },
    { value: 'high' as const, label: 'High', desc: 'Enhanced contrast' },
    { value: 'highest' as const, label: 'Highest', desc: 'Maximum contrast' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        <PaletteIcon size={16} className="inline mr-1" />
        Contrast Level
      </label>
      <div className="space-y-2">
        {options.map(option => (
          <label
            key={option.value}
            className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
          >
            <input
              type="radio"
              name="contrast"
              value={option.value}
              checked={contrastMode === option.value}
              onChange={() => onContrastChange(option.value)}
              className="text-primary"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {option.desc}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
});
