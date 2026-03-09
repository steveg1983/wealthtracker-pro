import React, { useState } from 'react';
import { CheckCircleIcon, XIcon } from '../icons';
import CategorySelector from '../CategorySelector';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';

interface ReconciliationFinalizationModalProps {
  isOpen: boolean;
  bankBalance: number;
  clearedBalance: number;
  currency?: string;
  onClose: () => void;
  onFinalize: () => void;
  onCreateAdjustment: (data: {
    amount: number;
    type: 'income' | 'expense';
    description: string;
    category: string;
    date: Date;
  }) => void;
}

export default function ReconciliationFinalizationModal({
  isOpen,
  bankBalance,
  clearedBalance,
  currency,
  onClose,
  onFinalize,
  onCreateAdjustment,
}: ReconciliationFinalizationModalProps): React.JSX.Element | null {
  const { formatCurrency } = useCurrencyDecimal();
  const difference = bankBalance - clearedBalance;
  const isBalanced = Math.abs(difference) < 0.005;

  const [adjustmentCategory, setAdjustmentCategory] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  if (!isOpen) return null;

  const handleCreateAdjustment = () => {
    if (!adjustmentCategory) return;

    onCreateAdjustment({
      amount: difference, // positive = income, negative = expense
      type: difference > 0 ? 'income' : 'expense',
      description: 'Account Reconciliation Adjustment',
      category: adjustmentCategory,
      date: new Date(adjustmentDate),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Finalize Reconciliation
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XIcon size={20} />
          </button>
        </div>

        {isBalanced ? (
          /* Balanced — success */
          <div className="text-center py-6">
            <CheckCircleIcon size={48} className="mx-auto text-green-500 mb-3" />
            <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-1">
              Account Balanced!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Bank balance matches cleared balance. Ready to finalize.
            </p>
            <button
              onClick={onFinalize}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Complete Reconciliation
            </button>
          </div>
        ) : (
          /* Unbalanced — show options */
          <div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                There is a difference between your bank balance and cleared balance:
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(difference, currency)}
              </p>
              <div className="mt-2 text-xs text-red-500 dark:text-red-400 space-y-1">
                <p>Bank Balance: {formatCurrency(bankBalance, currency)}</p>
                <p>Cleared Balance: {formatCurrency(clearedBalance, currency)}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Create Adjustment Transaction
              </h4>

              {/* Amount (read-only) */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Amount</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(Math.abs(difference), currency)}
                  {' '}
                  ({difference > 0 ? 'Income' : 'Expense'})
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Category
                </label>
                <CategorySelector
                  selectedCategory={adjustmentCategory}
                  onCategoryChange={setAdjustmentCategory}
                  transactionType={difference > 0 ? 'income' : 'expense'}
                  placeholder="Select category..."
                  allowCreate={false}
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Go Back
              </button>
              <button
                onClick={handleCreateAdjustment}
                disabled={!adjustmentCategory}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Adjustment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
