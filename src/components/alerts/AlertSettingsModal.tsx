import React, { useEffect, memo } from 'react';
import type { AlertConfig } from './types';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface AlertSettingsModalProps {
  isOpen: boolean;
  alertConfigs: AlertConfig[];
  categories: Category[];
  mutedCategories: string[];
  onClose: () => void;
  onUpdateConfig: (configId: string, updates: Partial<AlertConfig>) => void;
  onToggleMuteCategory: (category: string) => void;
  setAlertConfigs: (configs: AlertConfig[]) => void;
}

export const AlertSettingsModal = memo(function AlertSettingsModal({ isOpen,
  alertConfigs,
  categories,
  mutedCategories,
  onClose,
  onUpdateConfig,
  onToggleMuteCategory,
  setAlertConfigs
 }: AlertSettingsModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AlertSettingsModal component initialized', {
      componentName: 'AlertSettingsModal'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl p-6 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Alert Configuration
        </h3>
        
        <div className="space-y-4">
          {alertConfigs.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              onUpdate={(updates) => {
                setAlertConfigs(alertConfigs.map(c => 
                  c.id === config.id ? { ...c, ...updates } : c
                ));
              }}
            />
          ))}
        </div>
        
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Mute Categories</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {categories.map(category => (
              <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mutedCategories.includes(category.name)}
                  onChange={() => onToggleMuteCategory(category.name)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
});

interface ConfigCardProps {
  config: AlertConfig;
  onUpdate: (updates: Partial<AlertConfig>) => void;
}

const ConfigCard = memo(function ConfigCard({ config, onUpdate }: ConfigCardProps) {
  const logger = useLogger();
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 dark:text-white">{config.name}</h4>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="rounded text-primary focus:ring-primary"
        />
      </div>
      
      {config.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Warning Threshold (%)
              </label>
              <input
                type="number"
                value={config.thresholds.warning}
                onChange={(e) => onUpdate({
                  thresholds: { ...config.thresholds, warning: parseInt(e.target.value) || 0 }
                })}
                min="0"
                max="100"
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Critical Threshold (%)
              </label>
              <input
                type="number"
                value={config.thresholds.critical}
                onChange={(e) => onUpdate({
                  thresholds: { ...config.thresholds, critical: parseInt(e.target.value) || 0 }
                })}
                min="0"
                max="100"
                className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notificationTypes.inApp}
                onChange={(e) => onUpdate({
                  notificationTypes: { ...config.notificationTypes, inApp: e.target.checked }
                })}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.sound}
                onChange={(e) => onUpdate({ sound: e.target.checked })}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Sound</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.vibrate}
                onChange={(e) => onUpdate({ vibrate: e.target.checked })}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Vibrate</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
});
