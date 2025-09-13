import React, { useEffect, memo } from 'react';
import { PlusIcon, EyeIcon, EyeOffIcon } from '../../icons';
import type { WidgetConfig } from '../../DashboardWidget';
import { logger } from '../../../services/loggingService';

interface DashboardSettingsModalProps {
  isOpen: boolean;
  widgets: WidgetConfig[];
  onClose: () => void;
  onToggleVisibility: (widgetId: string) => void;
  onResetToDefault: () => void;
}

const DashboardSettingsModal = memo(function DashboardSettingsModal({
  isOpen,
  widgets,
  onClose,
  onToggleVisibility,
  onResetToDefault
}: DashboardSettingsModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardSettingsModal component initialized', {
      componentName: 'DashboardSettingsModal'
    });
  }, []);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Dashboard Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <PlusIcon size={20} className="rotate-45" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Widget Visibility
            </h4>
            <div className="space-y-2">
              {widgets.map((widget) => (
                <div key={widget.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {widget.title}
                  </span>
                  <button
                    onClick={() => onToggleVisibility(widget.id)}
                    className={`p-1 rounded ${
                      widget.isVisible 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-400'
                    }`}
                  >
                    {widget.isVisible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onResetToDefault}
              className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              Reset to Default Layout
            </button>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});

export default DashboardSettingsModal;
