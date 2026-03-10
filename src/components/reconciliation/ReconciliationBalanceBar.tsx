import React, { useState, useEffect } from 'react';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';

interface ReconciliationBalanceBarProps {
  bankBalance: number | null;
  accountBalance: number;
  clearedBalance: number;
  currency?: string;
  onBankBalanceChange?: (newBalance: number) => void;
}

export default function ReconciliationBalanceBar({
  bankBalance,
  accountBalance,
  clearedBalance,
  currency,
  onBankBalanceChange,
}: ReconciliationBalanceBarProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  const [isEditingBankBalance, setIsEditingBankBalance] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [optimisticBankBalance, setOptimisticBankBalance] = useState<number | null>(null);

  const displayBankBalance = bankBalance ?? optimisticBankBalance;
  const difference = displayBankBalance != null ? displayBankBalance - clearedBalance : null;

  // Clear optimistic value once the real prop arrives
  useEffect(() => {
    if (bankBalance != null) {
      setOptimisticBankBalance(null);
    }
  }, [bankBalance]);

  const handleBankBalanceSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(editValue);
    if (!Number.isNaN(parsed) && onBankBalanceChange) {
      setOptimisticBankBalance(parsed);
      onBankBalanceChange(parsed);
    }
    setIsEditingBankBalance(false);
    setEditValue('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-4 gap-4">
        {/* Bank Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bank Balance</p>
          {displayBankBalance != null && !isEditingBankBalance ? (
            <button
              type="button"
              onClick={() => {
                setEditValue(String(displayBankBalance));
                setIsEditingBankBalance(true);
              }}
              className="text-lg font-bold text-gray-900 dark:text-white hover:text-primary transition-colors cursor-pointer"
              title="Click to edit"
            >
              {formatCurrency(displayBankBalance, currency)}
            </button>
          ) : isEditingBankBalance ? (
            <form onSubmit={handleBankBalanceSubmit} className="flex gap-1">
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
                onBlur={() => {
                  if (editValue.trim()) {
                    handleBankBalanceSubmit();
                  } else {
                    setIsEditingBankBalance(false);
                    setEditValue('');
                  }
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setIsEditingBankBalance(true)}
              className="text-sm text-primary hover:underline"
            >
              Enter balance
            </button>
          )}
        </div>

        {/* Account Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account Balance</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(accountBalance, currency)}
          </p>
        </div>

        {/* Cleared Balance */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cleared Balance</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(clearedBalance, currency)}
          </p>
        </div>

        {/* Difference */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Difference</p>
          {difference != null ? (
            <p className={`text-lg font-bold ${
              Math.abs(difference) < 0.005
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(difference, currency)}
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-400">N/A</p>
          )}
        </div>
      </div>
    </div>
  );
}
