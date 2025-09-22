/**
 * AccountReconciliationModal Component - Account reconciliation interface
 *
 * Features:
 * - Account balance reconciliation
 * - Transaction matching
 * - Balance adjustments
 * - Discrepancy resolution
 */

import React, { useState } from 'react';
import Modal from './common/Modal';
import { lazyLogger as logger } from '../services/serviceFactory';

interface AccountReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName?: string;
  currentBalance?: number;
}

export default function AccountReconciliationModal({
  isOpen,
  onClose,
  accountId,
  accountName = 'Account',
  currentBalance = 0
}: AccountReconciliationModalProps): React.JSX.Element {
  const [statementBalance, setStatementBalance] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [isReconciling, setIsReconciling] = useState(false);

  const difference = statementBalance ?
    parseFloat(statementBalance) - currentBalance : 0;

  const handleReconcile = async () => {
    if (!statementBalance || !statementDate) {
      return;
    }

    setIsReconciling(true);
    try {
      logger.info('Reconciling account', {
        accountId,
        currentBalance,
        statementBalance: parseFloat(statementBalance),
        difference
      });

      // In a real implementation, this would:
      // 1. Compare transactions with statement
      // 2. Identify discrepancies
      // 3. Create reconciliation records
      // 4. Adjust balance if necessary

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info('Account reconciliation completed');
      onClose();
    } catch (error) {
      logger.error('Error reconciling account:', error);
    } finally {
      setIsReconciling(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reconcile ${accountName}`}
      size="md"
    >
      <div className="space-y-6">
        {/* Current Balance */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Current Balance
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(currentBalance)}
          </p>
        </div>

        {/* Statement Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Statement Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Statement Date
            </label>
            <input
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Difference Display */}
        {statementBalance && (
          <div className={`p-4 rounded-lg ${
            Math.abs(difference) < 0.01
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Difference
              </span>
              <span className={`text-lg font-bold ${
                Math.abs(difference) < 0.01
                  ? 'text-green-600 dark:text-green-400'
                  : difference > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
            {Math.abs(difference) < 0.01 ? (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                ✓ Balances match perfectly
              </p>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {difference > 0
                  ? 'Statement shows more money than recorded'
                  : 'Statement shows less money than recorded'
                }
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
            disabled={isReconciling}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReconcile}
            disabled={!statementBalance || !statementDate || isReconciling}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {isReconciling ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Reconciling...
              </>
            ) : (
              'Start Reconciliation'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}