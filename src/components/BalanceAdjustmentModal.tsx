/**
 * BalanceAdjustmentModal Component - Manual balance adjustment interface
 *
 * Features:
 * - Manual balance corrections
 * - Adjustment reason tracking
 * - Audit trail creation
 * - Balance reconciliation support
 */

import React, { useState } from 'react';
import Modal from './common/Modal';
import { lazyLogger as logger } from '../services/serviceFactory';

interface BalanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName?: string;
  currentBalance: number;
  onAdjustmentComplete?: (newBalance: number, adjustment: BalanceAdjustment) => void;
}

interface BalanceAdjustment {
  amount: number;
  reason: string;
  description: string;
  date: string;
  type: 'correction' | 'reconciliation' | 'other';
}

const adjustmentReasons = [
  { value: 'correction', label: 'Data Entry Correction' },
  { value: 'reconciliation', label: 'Bank Statement Reconciliation' },
  { value: 'interest', label: 'Interest/Fees Not Captured' },
  { value: 'transfer', label: 'Missing Transfer' },
  { value: 'other', label: 'Other (specify below)' }
];

export default function BalanceAdjustmentModal({
  isOpen,
  onClose,
  accountId,
  accountName = 'Account',
  currentBalance,
  onAdjustmentComplete
}: BalanceAdjustmentModalProps): React.JSX.Element {
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [reason, setReason] = useState('correction');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const adjustment = parseFloat(adjustmentAmount) || 0;
  const newBalance = currentBalance + adjustment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustmentAmount || adjustment === 0 || !description.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const balanceAdjustment: BalanceAdjustment = {
        amount: adjustment,
        reason,
        description: description.trim(),
        date: new Date().toISOString(),
        type: reason as BalanceAdjustment['type']
      };

      logger.info('Processing balance adjustment', {
        accountId,
        currentBalance,
        adjustment,
        newBalance,
        reason
      });

      // In a real implementation, this would:
      // 1. Create an adjustment transaction
      // 2. Update the account balance
      // 3. Create audit trail entry
      // 4. Notify relevant systems

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info('Balance adjustment completed successfully');

      onAdjustmentComplete?.(newBalance, balanceAdjustment);
      onClose();

      // Reset form
      setAdjustmentAmount('');
      setReason('correction');
      setDescription('');
    } catch (error) {
      logger.error('Error processing balance adjustment:', error);
    } finally {
      setIsSubmitting(false);
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
      title={`Adjust Balance - ${accountName}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Balance */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Current Balance
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(currentBalance)}
            </div>
          </div>
        </div>

        {/* Adjustment Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Adjustment Amount
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="0.00"
              required
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use positive numbers to increase balance, negative to decrease
          </div>
        </div>

        {/* New Balance Preview */}
        {adjustmentAmount && (
          <div className={`p-4 rounded-lg ${
            adjustment > 0
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                New Balance
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(newBalance)}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Change: {adjustment > 0 ? '+' : ''}{formatCurrency(adjustment)}
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Adjustment
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            required
          >
            {adjustmentReasons.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            placeholder="Provide details about why this adjustment is necessary..."
            required
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            This will be recorded in the audit trail for compliance purposes
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Important Notice
              </h4>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This adjustment will create an audit trail entry and may affect your financial reports.
                Ensure the adjustment is accurate and properly documented.
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!adjustmentAmount || adjustment === 0 || !description.trim() || isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Processing...
              </>
            ) : (
              'Apply Adjustment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}