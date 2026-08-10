import React, { memo, useState, useCallback } from 'react';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import { useHapticFeedback, HapticPattern } from '../hooks/useHapticFeedback';
import { EditIcon, DeleteIcon, CheckIcon, StarIcon, FolderIcon } from './icons';
import SuggestedCategoryBadge from './SuggestedCategoryBadge';
import { isConfirmableSuggestion } from '../utils/categoryProvenance';
import { isAwaitingReview } from '../utils/transactionReview';
import type { Transaction, Account } from '../types';
import { useFormattedDate } from '../hooks/useFormattedValues';

interface SwipeableTransactionRowProps {
  transaction: Transaction;
  account?: Account;
  /** The category's display name; the transaction itself holds only its id. */
  categoryName?: string;
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView: (transaction: Transaction) => void;
  onReconcile?: (transaction: Transaction) => void;
  onCategorize?: (transaction: Transaction) => void;
  onToggleFavorite?: (transaction: Transaction) => void;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  /**
   * Should a row that has arrived and not been dealt with be drawn as new?
   *
   * OFF BY DEFAULT, and asked for explicitly by the caller, because "new" is a
   * fact about a job rather than about a transaction: it means something on a
   * screen that carries a To Review counter and a filter narrowing to exactly
   * these rows, and it means nothing on a screen that offers neither. Marking a
   * row where there is nothing to do about it as a SET is how people learn to
   * ignore the marking on the screen where it matters.
   *
   * Two callers pass it, and both earn it: the account register, and the
   * Transactions page — which grew the same counter and the same filter when it
   * was brought up to the register's manners, so its rows now lead somewhere
   * too. Anything else that lists transactions (a report, a search result, a
   * dashboard card) still gets the default and still says nothing.
   */
  markNewArrivals?: boolean;
}

export const SwipeableTransactionRow = memo(function SwipeableTransactionRow({
  transaction,
  account,
  categoryName,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  onReconcile,
  onCategorize,
  onToggleFavorite,
  isSelected = false,
  onToggleSelection,
  markNewArrivals = false
}: SwipeableTransactionRowProps): React.JSX.Element {
  const formattedDate = useFormattedDate(transaction.date);
  const isNewArrival = markNewArrivals && isAwaitingReview(transaction);
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
    threshold: 50
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
              className="p-3 bg-blue-600 text-white rounded-lg"
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
        className={`relative bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${
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
            <div className="flex-1 min-w-0">
              {/* Microsoft Money's bold, on the card. The desktop register
                  weights Date and Description; here the card's own two lines
                  are the same pair, so the description goes from medium to
                  bold and the date darkens with it. Anything heavier would
                  fight the amount, which uses weight for money. */}
              <p className={`text-gray-900 dark:text-white truncate ${
                isNewArrival ? 'font-bold' : 'font-medium'
              }`}>
                {transaction.description}
                {/* Weight is a visual cue and nothing else (WCAG 1.4.1) — see
                    the identical clause in the register's own column. */}
                {isNewArrival && <span className="sr-only">— new, not reviewed yet</span>}
              </p>
              {/* One truncating line, and the category by NAME — the raw
                  field is the category's id, which on a phone read as a
                  jumble of letters and numbers. */}
              <p className={`text-sm truncate ${
                isNewArrival
                  ? 'font-semibold text-gray-700 dark:text-gray-300'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {formattedDate}
                {' · '}
                {categoryName ?? <span className="italic">Uncategorised</span>}
                {/* Right beside the category it is about, because that is the
                    only place it means anything. Tapping the card opens the row
                    (details on the transactions page, the editor on a
                    register); both carry the same badge, and saving an edit is
                    what records the answer — the phone's "confirm or edit". */}
                {isConfirmableSuggestion(transaction) && (
                  <SuggestedCategoryBadge
                    className="ml-1.5 align-middle"
                    title="The app filled this in. Open the transaction to confirm it or pick a different category."
                  />
                )}
                {account ? ` · ${account.name}` : ''}
              </p>
            </div>
            
            <div className="text-right">
              <p className={`font-semibold ${amountClass}`}>
                {formatCurrency(transaction.amount)}
              </p>
              {transaction.cleared && (
                <CheckIcon size={16} className="text-blue-600 dark:text-blue-400 ml-auto mt-1" />
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
