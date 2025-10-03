import React, { useEffect, memo } from 'react';
import { Modal } from '../common/Modal';
import { SettingsIcon, InfoIcon } from '../icons';
import type { RolloverSettings } from './types';
import { useLogger } from '../services/ServiceProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RolloverSettings;
  onUpdate: (settings: Partial<RolloverSettings>) => void;
  categories: Array<{ name: string; id: string }>;
}

export const SettingsModal = memo(function SettingsModal({ isOpen,
  onClose,
  settings,
  onUpdate,
  categories
 }: SettingsModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SettingsModal component initialized', {
      componentName: 'SettingsModal'
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rollover Settings"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Enable/Disable Rollover */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium">Enable Budget Rollover</label>
            <p className="text-sm text-gray-500">
              Automatically carry forward unused budget from previous month
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            className="toggle"
          />
        </div>

        {/* Rollover Method */}
        <div>
          <label className="block font-medium mb-2">Rollover Method</label>
          <select
            value={settings.mode}
            onChange={(e) => onUpdate({ mode: e.target.value as RolloverSettings['mode'] })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800"
            disabled={!settings.enabled}
          >
            <option value="percentage">Percentage of Available</option>
            <option value="fixed">Fixed Amount</option>
            <option value="category">Per Category Settings</option>
          </select>
        </div>

        {/* Method-specific settings */}
        {settings.mode === 'percentage' && (
          <div>
            <label className="block font-medium mb-2">
              Rollover Percentage
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.percentage || 100}
                onChange={(e) => onUpdate({ percentage: Number(e.target.value) })}
                className="flex-1"
                disabled={!settings.enabled}
              />
              <span className="w-12 text-center font-medium">
                {settings.percentage || 100}%
              </span>
            </div>
          </div>
        )}

        {settings.mode === 'fixed' && (
          <div>
            <label className="block font-medium mb-2">
              Maximum Rollover Amount
            </label>
            <input
              type="number"
              value={settings.maxAmount || ''}
              onChange={(e) => onUpdate({ maxAmount: Number(e.target.value) })}
              placeholder="Enter amount"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800"
              disabled={!settings.enabled}
            />
          </div>
        )}

        {/* Excluded Categories */}
        <div>
          <label className="block font-medium mb-2">
            Exclude Categories
          </label>
          <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 
                        dark:border-gray-700 rounded-lg p-3">
            {categories.map(cat => (
              <label key={cat.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.excludeCategories?.includes(cat.name) || false}
                  onChange={() => {
                    const excluded = settings.excludeCategories || [];
                    const newExcluded = excluded.includes(cat.name)
                      ? excluded.filter(c => c !== cat.name)
                      : [...excluded, cat.name];
                    onUpdate({ excludeCategories: newExcluded });
                  }}
                  disabled={!settings.enabled}
                  className="rounded"
                />
                <span className="text-sm">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-approve */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium">Auto-approve Rollovers</label>
            <p className="text-sm text-gray-500">
              Apply rollovers automatically without confirmation
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoApprove || false}
            onChange={(e) => onUpdate({ autoApprove: e.target.checked })}
            disabled={!settings.enabled}
            className="toggle"
          />
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium">Notify on Rollover</label>
            <p className="text-sm text-gray-500">
              Send notification when budget is rolled over
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifyOnRollover || false}
            onChange={(e) => onUpdate({ notifyOnRollover: e.target.checked })}
            disabled={!settings.enabled}
            className="toggle"
          />
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex gap-3">
            <InfoIcon size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p>
                Rollover will be calculated at the beginning of each month based on your 
                previous month's unused budget. You can review and approve each rollover 
                before it's applied.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                     dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Modal>
  );
});