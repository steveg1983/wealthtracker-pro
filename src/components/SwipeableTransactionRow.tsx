import React, { memo } from 'react';
import { useSwipeableListItem } from '../hooks/useTouchGestures';
import { EditIcon, DeleteIcon, CheckIcon } from './icons';
import type { Transaction, Account } from '../types';
import { useFormattedDate } from '../hooks/useFormattedValues';

interface SwipeableTransactionRowProps {
  transaction: Transaction;
  account?: Account;
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export const SwipeableTransactionRow = memo(function SwipeableTransactionRow({
  transaction,
  account,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  isSelected = false,
  onToggleSelection
}: SwipeableTransactionRowProps): React.JSX.Element {
  const formattedDate = useFormattedDate(transaction.date);
  
  const swipeRef = useSwipeableListItem<HTMLDivElement>({
    onSwipeLeft: () => {
      if (confirm('Delete this transaction?')) {
        onDelete(transaction.id);
      }
    },
    onSwipeRight: () => {
      onEdit(transaction);
    },
    onTap: () => {
      onView(transaction);
    }
  });

  const amountClass = transaction.amount < 0 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-green-600 dark:text-green-400';

  return (
    <div
      ref={swipeRef}
      className={`swipeable-item bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <div className="flex items-center p-4 gap-3">
        {/* Selection checkbox */}
        {onToggleSelection && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(transaction.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded"
            aria-label={`Select transaction ${transaction.description}`}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {transaction.description}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{formattedDate}</span>
                <span>•</span>
                <span>{transaction.category}</span>
                {account && (
                  <>
                    <span>•</span>
                    <span className="truncate">{account.name}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className={`font-semibold ${amountClass}`}>
                {formatCurrency(transaction.amount)}
              </p>
              {transaction.cleared && (
                <CheckIcon size={16} className="text-green-600 dark:text-green-400 ml-auto mt-1" />
              )}
            </div>
          </div>
        </div>

        {/* Action hints - visible on desktop, hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(transaction);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Edit transaction"
          >
            <EditIcon size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this transaction?')) {
                onDelete(transaction.id);
              }
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Delete transaction"
          >
            <DeleteIcon size={16} />
          </button>
        </div>
      </div>

      {/* Swipe action indicators */}
      <div className="absolute inset-y-0 left-0 w-20 bg-green-500 dark:bg-green-600 flex items-center justify-center opacity-0 swipe-action-right">
        <EditIcon size={24} className="text-white" />
      </div>
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 dark:bg-red-600 flex items-center justify-center opacity-0 swipe-action-left">
        <DeleteIcon size={24} className="text-white" />
      </div>
    </div>
  );
});