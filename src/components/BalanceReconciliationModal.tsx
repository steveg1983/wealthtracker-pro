import React, { useState } from 'react';
import { Modal } from './common/Modal';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { 
  AlertCircleIcon,
  ArrowRightIcon,
  CalendarIcon,
  PlusCircleIcon,
  BanknoteIcon
} from './icons';

export interface ReconciliationOption {
  type: 'opening-balance' | 'adjustment-transaction';
  accountId: string;
  accountName: string;
  currentBalance: number;
  calculatedBalance: number;
  difference: number;
}

interface BalanceReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  option: ReconciliationOption | null;
  onConfirm: (type: 'opening-balance' | 'adjustment-transaction') => void;
}

export default function BalanceReconciliationModal({
  isOpen,
  onClose,
  option,
  onConfirm
}: BalanceReconciliationModalProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedOption, setSelectedOption] = useState<'opening-balance' | 'adjustment-transaction' | null>(null);

  if (!option) return null;

  const { accountName, currentBalance, calculatedBalance, difference } = option;
  const adjustmentType = difference > 0 ? 'income' : 'expense';
  const adjustmentAmount = Math.abs(difference);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Balance Reconciliation Options"
    >
      <div className="p-6">
        {/* Issue Summary */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
                Balance Mismatch Detected
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                {accountName} shows a balance of {formatCurrency(currentBalance)}, 
                but your transactions sum to {formatCurrency(calculatedBalance)}.
                The difference is {formatCurrency(adjustmentAmount)}.
              </p>
              {/* Debug info */}
              {console.log('BalanceReconciliationModal Debug:', {
                accountName,
                currentBalance,
                calculatedBalance,
                difference,
                adjustmentAmount
              })}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">
            Choose how to reconcile this difference:
          </h4>

          {/* Option 1: Opening Balance */}
          <label className="block">
            <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedOption === 'opening-balance'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="reconciliation"
                  value="opening-balance"
                  checked={selectedOption === 'opening-balance'}
                  onChange={() => setSelectedOption('opening-balance')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BanknoteIcon size={20} className="text-gray-600 dark:text-gray-400" />
                    <span className="font-medium">Adjust Opening Balance</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Use this if the account had a balance before your first imported transaction.
                    This will set an opening balance to account for the difference.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-400">Effect:</span>
                      <span>Opening Balance</span>
                      <ArrowRightIcon size={14} className="text-gray-400" />
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(difference)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </label>

          {/* Option 2: Adjustment Transaction */}
          <label className="block">
            <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedOption === 'adjustment-transaction'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="reconciliation"
                  value="adjustment-transaction"
                  checked={selectedOption === 'adjustment-transaction'}
                  onChange={() => setSelectedOption('adjustment-transaction')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <PlusCircleIcon size={20} className="text-gray-600 dark:text-gray-400" />
                    <span className="font-medium">Create Adjustment Transaction</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Use this if there's a missing transaction or an error in your records.
                    This will create a new transaction to reconcile the balance.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarIcon size={14} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                        <span>Today</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 dark:text-gray-400">Type:</span>
                        <span className={adjustmentType === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {adjustmentType === 'income' ? 'Income' : 'Expense'}
                        </span>
                        <span className="font-medium">{formatCurrency(adjustmentAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 dark:text-gray-400">Category:</span>
                        <span>Account Adjustments</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (selectedOption) {
              onConfirm(selectedOption);
            }
          }}
          disabled={!selectedOption}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark 
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Selected Fix
        </button>
      </div>
    </Modal>
  );
}