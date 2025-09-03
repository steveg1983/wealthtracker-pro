import React, { useState } from 'react';
import { CheckIcon, XIcon, AlertTriangleIcon } from './icons';
import type { BulkOperation } from '../hooks/useBulkOperations';

interface BulkOperationsToolbarProps<T> {
  selectedCount: number;
  availableOperations: BulkOperation<T>[];
  onExecuteOperation: (operationId: string) => Promise<void>;
  onDeselectAll: () => void;
  isProcessing: boolean;
}

export default function BulkOperationsToolbar<T>({
  selectedCount,
  availableOperations,
  onExecuteOperation,
  onDeselectAll,
  isProcessing,
}: BulkOperationsToolbarProps<T>): React.JSX.Element | null {
  const [confirmingOperation, setConfirmingOperation] = useState<string | null>(null);

  const handleOperationClick = async (operation: BulkOperation<T>): Promise<void> => {
    if (operation.requiresConfirmation) {
      setConfirmingOperation(operation.id);
    } else {
      await onExecuteOperation(operation.id);
    }
  };

  const handleConfirmOperation = async (): Promise<void> => {
    if (confirmingOperation) {
      await onExecuteOperation(confirmingOperation);
      setConfirmingOperation(null);
    }
  };

  const handleCancelConfirmation = (): void => {
    setConfirmingOperation(null);
  };

  if (selectedCount === 0) {
    return null;
  }

  const confirmingOp = availableOperations.find(op => op.id === confirmingOperation);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-600 p-4">
        {confirmingOperation && confirmingOp ? (
          // Confirmation dialog
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <AlertTriangleIcon size={20} className="text-yellow-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {confirmingOp.confirmationMessage || `Are you sure you want to ${confirmingOp.label.toLowerCase()} ${selectedCount} item${selectedCount !== 1 ? 's' : ''}?`}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleConfirmOperation}
                disabled={isProcessing}
                className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                  confirmingOp.destructive
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isProcessing ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={handleCancelConfirmation}
                disabled={isProcessing}
                className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // Main toolbar
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckIcon size={20} className="text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {availableOperations.map((operation) => {
                const Icon = operation.icon;
                return (
                  <button
                    key={operation.id}
                    onClick={() => handleOperationClick(operation)}
                    disabled={isProcessing}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      operation.destructive
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] text-white'
                    }`}
                    title={operation.label}
                  >
                    <div className="flex items-center space-x-1">
                      {Icon && <Icon size={16} />}
                      <span>{operation.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onDeselectAll}
              disabled={isProcessing}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Deselect all"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}