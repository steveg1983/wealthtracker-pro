import React, { useEffect, memo } from 'react';
import { XIcon, CheckIcon } from '../icons';
import type { Anomaly, AnomalyDetectionConfig } from '../../services/anomalyDetectionService';
import { logger } from '../../services/loggingService';

interface AnomalySettingsProps {
  isOpen: boolean;
  config: AnomalyDetectionConfig;
  onClose: () => void;
  onToggleType: (type: Anomaly['type']) => void;
  onSensitivityChange: (level: 'low' | 'medium' | 'high') => void;
  onRefresh: () => void;
}

export const AnomalySettings = memo(function AnomalySettings({
  isOpen,
  config,
  onClose,
  onToggleType,
  onSensitivityChange,
  onRefresh
}: AnomalySettingsProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AnomalySettings component initialized', {
      componentName: 'AnomalySettings'
    });
  }, []);

  if (!isOpen) return null;

  const anomalyTypes: Array<{ type: Anomaly['type']; label: string; description: string }> = [
    { type: 'unusual_amount', label: 'Unusual Amounts', description: 'Detect transactions with amounts significantly different from normal' },
    { type: 'frequency_spike', label: 'Frequency Spikes', description: 'Identify unusual spending patterns or frequency changes' },
    { type: 'new_merchant', label: 'New Merchants', description: 'Alert for transactions from new or unfamiliar merchants' },
    { type: 'category_overspend', label: 'Category Overspending', description: 'Warn when spending exceeds typical patterns in categories' },
    { type: 'time_pattern', label: 'Time Anomalies', description: 'Detect transactions at unusual times' },
    { type: 'duplicate_charge', label: 'Duplicate Charges', description: 'Find potential duplicate or recurring charges' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Anomaly Detection Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sensitivity Level */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Sensitivity Level
            </h4>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => onSensitivityChange(level)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    config.sensitivityLevel === level
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-primary'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Detection Types */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Detection Types
            </h4>
            <div className="space-y-3">
              {anomalyTypes.map(({ type, label, description }) => (
                <label
                  key={type}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <div
                    onClick={() => onToggleType(type)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      config.enabledTypes.has(type)
                        ? 'bg-primary border-primary'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {config.enabledTypes.has(type) && (
                      <CheckIcon size={12} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Save & Refresh
          </button>
        </div>
      </div>
    </div>
  );
});
