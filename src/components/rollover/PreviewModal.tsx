import React, { useEffect, memo } from 'react';
import { Modal } from '../common/Modal';
import { RolloverDetails } from './RolloverDetails';
import { CheckIcon, XIcon } from '../icons';
import type { RolloverPreview } from './types';
import { useLogger } from '../services/ServiceProvider';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: RolloverPreview;
  onApply: () => void;
  saving: boolean;
}

export const PreviewModal = memo(function PreviewModal({ isOpen,
  onClose,
  preview,
  onApply,
  saving
 }: PreviewModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PreviewModal component initialized', {
      componentName: 'PreviewModal'
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Budget Rollover"
      size="lg"
    >
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Review the budget amounts that will be rolled over from the previous month.
          </p>
        </div>

        <RolloverDetails 
          categories={preview.rollovers}
          totalRollover={preview.totalAmount}
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 
                     hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XIcon size={20} />
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={saving || preview.totalAmount.isZero()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg
                     hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon size={20} />
            {saving ? 'Applying...' : 'Apply Rollover'}
          </button>
        </div>
      </div>
    </Modal>
  );
});