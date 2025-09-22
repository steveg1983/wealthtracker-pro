import React, { useEffect, memo } from 'react';
import { getPresetRanges, type DateRange } from './dateRangePresets';
import { useLogger } from '../services/ServiceProvider';

interface PresetViewProps {
  fiscalYearStart: number;
  onChange: (range: DateRange) => void;
  onClose: () => void;
}

export const PresetView = memo(function PresetView({ fiscalYearStart,
  onChange,
  onClose
 }: PresetViewProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PresetView component initialized', {
      componentName: 'PresetView'
    });
  }, []);

  const presetRanges = getPresetRanges(fiscalYearStart);
  const popularPresets = presetRanges.filter(p => p.popular);
  const otherPresets = presetRanges.filter(p => !p.popular);

  return (
    <div>
      {/* Popular Presets */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Popular</p>
        <div className="grid grid-cols-3 gap-2">
          {popularPresets.map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                onChange(preset.getValue());
                onClose();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
            >
              {preset.icon}
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* All Presets */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">All Presets</p>
        <div className="grid grid-cols-3 gap-2">
          {otherPresets.map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                onChange(preset.getValue());
                onClose();
              }}
              className="px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});