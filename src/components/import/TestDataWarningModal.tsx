/**
 * Test Data Warning Modal Component
 * Modal for warning about clearing test data
 */

import React, { useEffect } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { AlertCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface TestDataWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const TestDataWarningModal = React.memo(({
  isOpen,
  onClose,
  onConfirm
}: TestDataWarningModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clear Test Data?"
      size="sm"
    >
      <ModalBody>
        <div className="flex gap-3">
          <AlertCircleIcon size={24} className="text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-gray-700 dark:text-gray-300">
              You have test data in your account. Importing real transactions will clear all existing test data.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              This action cannot be undone.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Clear Test Data & Import
        </button>
      </ModalFooter>
    </Modal>
  );
});

TestDataWarningModal.displayName = 'TestDataWarningModal';

export default TestDataWarningModal;