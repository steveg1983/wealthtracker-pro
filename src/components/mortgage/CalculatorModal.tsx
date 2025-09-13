/**
 * Calculator Modal Component
 * Modal for entering mortgage calculation parameters
 */

import React, { useEffect } from 'react';
import { PlusIcon } from '../icons';
import type { MortgageFormData } from '../../services/mortgageCalculatorComponentService';
import { logger } from '../../services/loggingService';

interface CalculatorModalProps {
  isOpen: boolean;
  formData: MortgageFormData;
  onFormChange: (data: MortgageFormData) => void;
  onCalculate: () => void;
  onClose: () => void;
}

const CalculatorModal = React.memo(({
  isOpen,
  formData,
  onFormChange,
  onCalculate,
  onClose
}: CalculatorModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Calculate Mortgage
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close modal"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Loan Amount
              </label>
              <input
                type="number"
                value={formData.loanAmount}
                onChange={(e) => onFormChange({ ...formData, loanAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1000"
                aria-label="Loan amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interest Rate (%)
              </label>
              <input
                type="number"
                value={formData.interestRate}
                onChange={(e) => onFormChange({ ...formData, interestRate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="20"
                step="0.1"
                aria-label="Interest rate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Loan Term (years)
              </label>
              <select
                value={formData.loanTermYears}
                onChange={(e) => onFormChange({ ...formData, loanTermYears: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                aria-label="Loan term"
              >
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
                <option value={25}>25 years</option>
                <option value={30}>30 years</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onCalculate}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              Calculate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

CalculatorModal.displayName = 'CalculatorModal';

export default CalculatorModal;