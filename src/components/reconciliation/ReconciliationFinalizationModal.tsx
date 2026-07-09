import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, XIcon } from '../icons';
import CategorySelector from '../CategorySelector';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { parseMoneyInput, toDecimal } from '../../utils/decimal';
import { deriveAdjustment } from '../../utils/reconciliation';

interface ReconciliationFinalizationModalProps {
  isOpen: boolean;
  bankBalance: number | null;
  clearedBalance: number;
  currency?: string;
  onClose: () => void;
  onFinalize: () => void;
  /**
   * Create a cleared adjustment transaction. Amount is SIGNED per the app-wide
   * convention (income positive, expense negative). The modal stays open —
   * the parent recomputes clearedBalance and the modal re-renders with the
   * remaining difference, so several partial adjustments can be created until
   * the difference reaches zero (the Microsoft Money model). Must return the
   * write's promise so the modal can hold its in-flight guard until it lands.
   */
  onCreateAdjustment: (data: {
    amount: number;
    type: 'income' | 'expense';
    description: string;
    category: string;
    date: Date;
  }) => Promise<void>;
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

  const hasBankBalance = bankBalance != null;
  const difference = hasBankBalance
    ? toDecimal(bankBalance).minus(toDecimal(clearedBalance)).toNumber()
    : null;
  const isBalanced = difference != null && Math.abs(difference) < 0.005;

  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  // "Account Adjustment" is the exact payee Microsoft Money used for these.
  const [adjustmentDescription, setAdjustmentDescription] = useState('Account Adjustment');
  const [adjustmentCategory, setAdjustmentCategory] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // While the user is editing the amount, a background clearedBalance change
  // (e.g. a toggle RPC resolving) must not clobber what they typed.
  const [amountDirty, setAmountDirty] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmountDirty(false);
    }
  }, [isOpen]);

  // Pre-fill (and re-sync after each created adjustment) with the remaining
  // difference, so the default action always zeroes the account in one step.
  useEffect(() => {
    if (isOpen && difference != null && !amountDirty) {
      setAdjustmentAmount(Math.abs(difference).toFixed(2));
    }
  }, [isOpen, difference, amountDirty]);

  if (!isOpen) return null;

  const parsedAmount = parseMoneyInput(adjustmentAmount);
  const { type: adjustmentType, signedAmount } = deriveAdjustment(difference ?? 0, parsedAmount ?? null);
  const amountValid = signedAmount != null && Math.abs(signedAmount) > 0;

  const handleCreateAdjustment = async () => {
    if (isSubmitting || !amountValid || signedAmount == null || !adjustmentCategory || !adjustmentDescription.trim() || difference == null) {
      return;
    }

    // In-flight guard: without it a double-click would write two identical
    // adjustment transactions before the first RPC resolves.
    setIsSubmitting(true);
    try {
      await onCreateAdjustment({
        amount: signedAmount,
        type: adjustmentType,
        description: adjustmentDescription.trim(),
        category: adjustmentCategory,
        date: new Date(adjustmentDate),
      });
      // Success: let the amount field re-sync to the new remaining difference.
      setAmountDirty(false);
    } finally {
      setIsSubmitting(false);
    }
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
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>

        {!hasBankBalance ? (
          /* No bank balance — allow finalize anyway */
          <div className="text-center py-6">
            <CheckCircleIcon size={48} className="mx-auto text-blue-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No Bank Balance Set
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Enter a bank balance on the balance bar above to compare against cleared transactions,
              or finalize without comparison.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Go Back
              </button>
              <button
                onClick={onFinalize}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Finalize Anyway
              </button>
            </div>
          </div>
        ) : isBalanced ? (
          /* Balanced — success */
          <div className="text-center py-6">
            <CheckCircleIcon size={48} className="mx-auto text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">
              Account Balanced!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Bank balance matches cleared balance. Ready to finalize.
            </p>
            <button
              onClick={onFinalize}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Complete Reconciliation
            </button>
          </div>
        ) : (
          /* Unbalanced — create adjustment(s) until the difference is zero */
          <div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                Difference between bank balance and cleared balance:
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(difference!, currency)}
              </p>
              <div className="mt-2 text-xs text-red-500 dark:text-red-400 space-y-1">
                <p>Bank Balance: {formatCurrency(bankBalance, currency)}</p>
                <p>Cleared Balance: {formatCurrency(clearedBalance, currency)}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Create Adjustment Transaction
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Creates a cleared {adjustmentType} that reduces the difference. You can
                  create more than one adjustment until the difference reaches zero.
                </p>
              </div>

              {/* Amount (editable, pre-filled with remaining difference) */}
              <div>
                <label htmlFor="adjustment-amount" className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Amount ({adjustmentType === 'income' ? 'Income' : 'Expense'})
                </label>
                <input
                  id="adjustment-amount"
                  type="text"
                  inputMode="decimal"
                  value={adjustmentAmount}
                  onChange={(e) => {
                    setAmountDirty(true);
                    setAdjustmentAmount(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                />
                {!amountValid && adjustmentAmount.trim() !== '' && (
                  <p className="text-xs text-red-500 mt-1">Enter an amount greater than zero.</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="adjustment-description" className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Description
                </label>
                <input
                  id="adjustment-description"
                  type="text"
                  value={adjustmentDescription}
                  onChange={(e) => setAdjustmentDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Category
                </label>
                <CategorySelector
                  selectedCategory={adjustmentCategory}
                  onCategoryChange={setAdjustmentCategory}
                  transactionType={adjustmentType}
                  placeholder="Select category..."
                  allowCreate={false}
                />
              </div>

              {/* Date */}
              <div>
                <label htmlFor="adjustment-date" className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  Date
                </label>
                <input
                  id="adjustment-date"
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
                onClick={() => void handleCreateAdjustment()}
                disabled={isSubmitting || !amountValid || !adjustmentCategory || !adjustmentDescription.trim()}
                className="flex-1 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating…' : 'Create Adjustment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
