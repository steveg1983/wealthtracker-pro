/**
 * Transaction Item Component
 * World-class transaction display with selection state
 */

import React, { useEffect, memo } from 'react';
import { CheckCircleIcon as CheckCircle } from '../icons';
import type { Transaction } from '../../types';
import { logger } from '../../services/loggingService';

interface TransactionItemProps {
  transaction: Transaction;
  isSelected: boolean;
  onToggle: (id: string) => void;
  formatCurrency: (amount: number) => string;
}

/**
 * Premium transaction item with clear selection state
 */
export const TransactionItem = memo(function TransactionItem({
  transaction,
  isSelected,
  onToggle,
  formatCurrency
}: TransactionItemProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TransactionItem component initialized', {
      componentName: 'TransactionItem'
    });
  }, []);

  const handleClick = () => {
    onToggle(transaction.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-pressed={isSelected}
      aria-label={`${transaction.description} - ${isSelected ? 'Selected' : 'Not selected'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SelectionCheckbox isSelected={isSelected} />
          <TransactionDetails transaction={transaction} />
        </div>
        <TransactionAmount
          amount={transaction.amount}
          type={transaction.type}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
});

/**
 * Selection checkbox
 */
const SelectionCheckbox = memo(function SelectionCheckbox({
  isSelected
}: {
  isSelected: boolean;
}): React.JSX.Element {
  return (
    <div className={`
      w-5 h-5 rounded border-2 flex items-center justify-center
      ${isSelected 
        ? 'bg-gray-600 border-gray-600' 
        : 'border-gray-300 dark:border-gray-600'
      }
    `}>
      {isSelected && <CheckCircle size={14} className="text-white" />}
    </div>
  );
});

/**
 * Transaction details
 */
const TransactionDetails = memo(function TransactionDetails({
  transaction
}: {
  transaction: Transaction;
}): React.JSX.Element {
  return (
    <div>
      <p className="font-medium text-gray-900 dark:text-white">
        {transaction.description}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {new Date(transaction.date).toLocaleDateString()}
      </p>
    </div>
  );
});

/**
 * Transaction amount
 */
const TransactionAmount = memo(function TransactionAmount({
  amount,
  type,
  formatCurrency
}: {
  amount: number;
  type: string;
  formatCurrency: (amount: number) => string;
}): React.JSX.Element {
  const colorClass = type === 'income' 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400';
  
  const prefix = type === 'income' ? '+' : '-';

  return (
    <p className={`font-semibold ${colorClass}`}>
      {prefix}{formatCurrency(Math.abs(amount))}
    </p>
  );
});