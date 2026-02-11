import React, { memo, useState, useCallback } from 'react';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import { useHapticFeedback, HapticPattern } from '../hooks/useHapticFeedback';
import { EditIcon, DeleteIcon, CheckIcon, StarIcon, FolderIcon } from './icons';
import type { Transaction, Account } from '../types';
import { useFormattedDate } from '../hooks/useFormattedValues';

interface SwipeableTransactionRowProps {
  transaction: Transaction;
  account?: Account;
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  onReconcile?: (transaction: Transaction) => void;
  onCategorize?: (transaction: Transaction) => void;
  onToggleFavorite?: (transaction: Transaction) => void;
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
  onReconcile,
  onCategorize,
  onToggleFavorite,
  isSelected = false,
  onToggleSelection
}: SwipeableTransactionRowProps): React.JSX.Element {
  const formattedDate = useFormattedDate(transaction.date);
  const { trigger: triggerHaptic } = useHapticFeedback();
  const [offset, setOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null);
  
  const handleSwipeLeft = useCallback(async () => {
    await triggerHaptic(HapticPattern.SELECTION);
    setIsRevealed('right');
    setOffset(-100);
  }, [triggerHaptic]);

  const handleSwipeRight = useCallback(async () => {
    await triggerHaptic(HapticPattern.SELECTION);
    setIsRevealed('left');
    setOffset(100);
  }, [triggerHaptic]);

  const handleTap = useCallback(async () => {
    if (isRevealed) {
      setIsRevealed(null);
      setOffset(0);
    } else {
      await triggerHaptic(HapticPattern.LIGHT);
      onView(transaction);
    }
  }, [isRevealed, onView, transaction, triggerHaptic]);

  const handleLongPress = useCallback(async () => {
    await triggerHaptic(HapticPattern.MEDIUM);
    onEdit(transaction);
  }, [onEdit, transaction, triggerHaptic]);
  
  const { ref, isSwipe } = useSwipeGestures({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onTap: handleTap,
    onLongPress: handleLongPress,
    onDoubleTap: () => onToggleFavorite?.(transaction)
  }, {
    threshold: 50,
    preventScrollOnSwipe: true
  });

  const amountClass = transaction.amount < 0 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-green-600 dark:text-green-400';

  return (
    <div className="relative overflow-hidden">
      {/* Left swipe actions */}
      <div className="absolute inset-0 flex items-center">
        <div className="flex items-center gap-2 px-4">
          {onReconcile && !transaction.cleared && (
            <button
              onClick={async () => {
                await triggerHaptic(HapticPattern.SUCCESS);
                onReconcile(transaction);
                setOffset(0);
                setIsRevealed(null);
              }}
              className="p-3 bg-green-500 text-white rounded-lg"
              aria-label="Reconcile"
            >
              <CheckIcon size={20} />
            </button>
          )}
          {onToggleFavorite && (
            <button
              onClick={async () => {
                await triggerHaptic(HapticPattern.MEDIUM);
                onToggleFavorite(transaction);
                setOffset(0);
                setIsRevealed(null);
              }}
              className="p-3 bg-yellow-500 text-white rounded-lg"
              aria-label="Favorite"
            >
              <StarIcon size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Right swipe actions */}
      <div className="absolute inset-0 flex items-center justify-end">
        <div className="flex items-center gap-2 px-4">
          {onCategorize && (
            <button
              onClick={async () => {
                await triggerHaptic(HapticPattern.LIGHT);
                onCategorize(transaction);
                setOffset(0);
                setIsRevealed(null);
              }}
              className="p-3 bg-purple-500 text-white rounded-lg"
              aria-label="Categorize"
            >
              <FolderIcon size={20} />
            </button>
          )}
          <button
            onClick={async () => {
              await triggerHaptic(HapticPattern.MEDIUM);
              onEdit(transaction);
              setOffset(0);
              setIsRevealed(null);
            }}
            className="p-3 bg-blue-500 text-white rounded-lg"
            aria-label="Edit"
          >
            <EditIcon size={20} />
          </button>
          <button
            onClick={async () => {
              await triggerHaptic(HapticPattern.WARNING);
              if (confirm('Delete this transaction?')) {
                await triggerHaptic(HapticPattern.ERROR);
                onDelete(transaction.id);
              }
              setOffset(0);
              setIsRevealed(null);
            }}
            className="p-3 bg-red-500 text-white rounded-lg"
            aria-label="Delete"
          >
            <DeleteIcon size={20} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`relative bg-card-bg-light dark:bg-card-bg-dark border-b border-gray-200 dark:border-gray-700 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isSwipe ? 'none' : 'transform 0.3s ease'
        }}
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
      </div>
    </div>
  );
});
