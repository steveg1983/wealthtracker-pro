import React, { useEffect, memo } from 'react';
import { AlertCircleIcon, DatabaseIcon } from '../icons';
import type { DataStats } from '../../services/dataManagementService';
import { useLogger } from '../services/ServiceProvider';

interface ConfirmationModalProps {
  type: 'delete' | 'testData';
  isOpen: boolean;
  dataStats?: DataStats;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal = memo(function ConfirmationModal({ type,
  isOpen,
  dataStats,
  onConfirm,
  onCancel
 }: ConfirmationModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('ConfirmationModal component initialized', {
      componentName: 'ConfirmationModal'
    });
  }, []);
  if (!isOpen) return null;

  const isDelete = type === 'delete';
  const Icon = isDelete ? AlertCircleIcon : DatabaseIcon;
  const iconColor = isDelete ? 'text-red-500' : 'text-purple-500';
  const title = isDelete ? 'Confirm Delete All Data' : 'Load Test Data';
  const buttonColor = isDelete ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600';
  const buttonText = isDelete ? 'Delete All Data' : 'Load Test Data';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <Icon className={iconColor} size={24} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>

        {isDelete ? (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete all data? This will permanently remove:
            </p>
            {dataStats && (
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6">
                <li>{dataStats.accountsCount} accounts</li>
                <li>{dataStats.transactionsCount} transactions</li>
                <li>{dataStats.budgetsCount} budgets</li>
              </ul>
            )}
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">
              This action cannot be undone!
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will load sample data to help you explore the app's features. The test data includes:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6">
              <li>5 sample accounts</li>
              <li>Multiple transactions</li>
              <li>Example budgets</li>
            </ul>
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-6">
              Note: This will add to your existing data, not replace it.
            </p>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg ${buttonColor}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ConfirmationModal;
