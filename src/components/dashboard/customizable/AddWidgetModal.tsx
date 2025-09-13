import React, { useEffect, memo } from 'react';
import { PlusIcon } from '../../icons';
import { AVAILABLE_WIDGETS } from '../../../services/customizableDashboardService';
import { logger } from '../../../services/loggingService';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: string) => void;
}

const AddWidgetModal = memo(function AddWidgetModal({
  isOpen,
  onClose,
  onAddWidget
}: AddWidgetModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AddWidgetModal component initialized', {
      componentName: 'AddWidgetModal'
    });
  }, []);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Widget
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <PlusIcon size={20} className="rotate-45" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_WIDGETS.map((widget) => (
            <button
              key={widget.type}
              onClick={() => onAddWidget(widget.type)}
              className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                {widget.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {widget.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default AddWidgetModal;
