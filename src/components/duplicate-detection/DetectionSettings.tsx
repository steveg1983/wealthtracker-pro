import { memo } from 'react';
import { FilterIcon } from '../icons';
import type { DetectionSettings } from '../../services/duplicateDetectionService';
import { lazyLogger as logger } from '../../services/serviceFactory';

interface DetectionSettingsProps {
  settings: DetectionSettings;
  autoSelectHighConfidence: boolean;
  isImport: boolean;
  onSettingsChange: (settings: DetectionSettings) => void;
  onAutoSelectChange: (value: boolean) => void;
}

/**
 * Detection settings component
 * Controls for adjusting duplicate detection parameters
 */
export const DetectionSettingsPanel = memo(function DetectionSettingsPanel({
  settings,
  autoSelectHighConfidence,
  isImport,
  onSettingsChange,
  onAutoSelectChange
}: DetectionSettingsProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
      <h3 className="font-medium mb-3 flex items-center gap-2">
        <FilterIcon size={18} />
        Detection Settings
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Date Threshold (days)
          </label>
          <input
            type="number"
            value={settings.dateThreshold}
            onChange={(e) => onSettingsChange({
              ...settings,
              dateThreshold: parseInt(e.target.value) || 0
            })}
            min="0"
            max="30"
            className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                     bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Amount Threshold (£)
          </label>
          <input
            type="number"
            value={settings.amountThreshold}
            onChange={(e) => onSettingsChange({
              ...settings,
              amountThreshold: parseFloat(e.target.value) || 0
            })}
            min="0"
            step="0.01"
            className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded
                     bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Similarity Threshold (%)
          </label>
          <input
            type="range"
            value={settings.similarityThreshold}
            onChange={(e) => onSettingsChange({
              ...settings,
              similarityThreshold: parseInt(e.target.value)
            })}
            min="50"
            max="100"
            className="w-full"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {settings.similarityThreshold}%
          </span>
        </div>
      </div>
      {isImport && (
        <label className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            checked={autoSelectHighConfidence}
            onChange={(e) => onAutoSelectChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Auto-select very likely duplicates (90%+)</span>
        </label>
      )}
    </div>
  );
});