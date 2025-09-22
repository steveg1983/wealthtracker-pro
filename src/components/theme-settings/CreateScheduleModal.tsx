import React, { useEffect, memo } from 'react';
import type { ThemeSchedule } from '../../services/themeSchedulingService';
import { useLogger } from '../services/ServiceProvider';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (scheduleData: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>) => void;
}

const CreateScheduleModal = memo(function CreateScheduleModal({ isOpen,
  onClose,
  onCreate
 }: CreateScheduleModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('CreateScheduleModal component initialized', {
      componentName: 'CreateScheduleModal'
    });
  }, []);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create Theme Schedule
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Schedule creation modal would be implemented here with full form controls.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
});

export default CreateScheduleModal;
