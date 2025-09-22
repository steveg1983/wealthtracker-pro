/**
 * TestDataWarningModal Component - Warning about test data usage
 *
 * Features:
 * - Warning about test/demo data
 * - Option to continue or create real account
 * - One-time dismissal
 */

import React from 'react';
import Modal from './common/Modal';

interface TestDataWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithTestData: () => void;
  onCreateRealAccount: () => void;
}

export default function TestDataWarningModal({
  isOpen,
  onClose,
  onContinueWithTestData,
  onCreateRealAccount
}: TestDataWarningModalProps): React.JSX.Element {
  const handleContinue = () => {
    onContinueWithTestData();
    onClose();
  };

  const handleCreateAccount = () => {
    onCreateRealAccount();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Test Data Warning"
      size="md"
      closeOnBackdrop={false}
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              You're viewing test data
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              This data is for demonstration purposes only
            </p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p>
              <strong>Important:</strong> The financial data you're seeing is sample data used for testing and demonstration purposes.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Changes you make will not be saved permanently</li>
              <li>This data does not reflect your real financial situation</li>
              <li>Create a real account to start tracking your actual finances</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
            onClick={handleCreateAccount}
          >
            Create Real Account
          </button>
          <button
            type="button"
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 font-medium"
            onClick={handleContinue}
          >
            Continue with Test Data
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          You can change this setting anytime in your account preferences
        </div>
      </div>
    </Modal>
  );
}