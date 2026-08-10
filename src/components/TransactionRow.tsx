import React, { memo, useCallback, useMemo, useState } from 'react';
import type { Transaction, Account } from '../types';
import { TrendingUpIcon, TrendingDownIcon, EditIcon, DeleteIcon } from './icons';
import { IconButton } from './icons/IconButton';
import MarkdownNote from './MarkdownNote';
import MoneyInput from './common/MoneyInput';
import SuggestedCategoryBadge from './SuggestedCategoryBadge';
import { isConfirmableSuggestion } from '../utils/categoryProvenance';
import { isReconciled, isMarkedAwaitingFinalize } from '../utils/transactionReconciliation';
import { isAwaitingReview } from '../utils/transactionReview';
import { clickedOwnControl, useRowClickGesture } from '../hooks/useRowClickGesture';
import { transactionRowDomId } from './transactionRowDomId';
import { useFormattedDate } from '../hooks/useFormattedValues';

/**
 * The look of the row the keyboard is on, echoing the register's own active row
 * (.selected-transaction-row in index.css): the same blue wash, the same
 * #6B86B3 ring.
 *
 * ─ WHY UTILITIES AND NOT THAT CLASS ────────────────────────────────────────
 * The register's rows are DIVs (VirtualizedTable), and three of that class's
 * declarations only work on one: `margin: 4px 0` and `border-radius: 12px` do
 * nothing at all on a `<tr>` in the CSS table model, and its `box-shadow` — the
 * "lift" — is not painted on a table row while borders are collapsing, which
 * Tailwind's preflight makes the default for every table in the app. The
 * Accounts page reached the same conclusion from the other direction and
 * echoed the look in utilities (ACCOUNT_ROW_SELECTED_CLASS); this is that
 * pattern again, for a real table row.
 *
 * ─ THE RING IS DRAWN ON THE CELLS ──────────────────────────────────────────
 * For the same reason: in the collapsing model a border on a `<tr>` is what the
 * row separators already use, and the cell's border wins the collapse — so
 * bordering the cells is the only way to draw one unbroken outline round the
 * whole row, and it is the way that survives the row above being selected too.
 *
 * ─ AND WHY NOT font-weight: 600 ────────────────────────────────────────────
 * The register's class emboldens the selected row. It cannot here, because on
 * this page weight already says something else: a row that has arrived and not
 * been reviewed is bold (see isAwaitingReview below), and emboldening the
 * selected row would erase the only mark that says "this one is new" exactly
 * when the user is looking straight at it. The register can afford the weight
 * because it also has the lift; this row has to spend it on one fact only.
 */
export const TRANSACTION_ROW_SELECTED_CLASS =
  'bg-blue-50/80 dark:bg-blue-900/30 ' +
  '[&>td]:border-y [&>td]:border-[#6B86B3]/50 dark:[&>td]:border-[#6B86B3]/70 ' +
  '[&>td:first-child]:border-l [&>td:last-child]:border-r';

interface TransactionRowProps {
  transaction: Transaction;
  account: Account | undefined;
  categoryPath: string;
  compactView: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onView?: (transaction: Transaction) => void;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  enableBulkSelection?: boolean;
  /**
   * True for the ONE row the keyboard is on — the register's highlight, on this
   * table. Distinct from `isSelected`, which is the bulk-selection checkbox:
   * one says "where am I", the other says "what will the next bulk action act
   * on". `enableBulkSelection` wins the row's click when it is on, because a
   * row wearing a checkbox is a row whose click means "tick me".
   */
  isCurrentRow?: boolean;
  /**
   * Roving tabindex: exactly one row of a table is the tab stop, and the rest
   * are reached with the arrows. A table of two hundred rows that made each one
   * its own tab stop would take two hundred presses to get past.
   */
  isTabStop?: boolean;
  /** A click on the row itself — never on one of its own controls. */
  onRowClick?: (transaction: Transaction) => void;
  /** A key pressed on the row itself — never inside one of its boxes. */
  onRowKeyDown?: (event: React.KeyboardEvent<HTMLTableRowElement>, transaction: Transaction) => void;
  runningBalance?: number;
  onContextMenu?: (e: React.MouseEvent, transaction: Transaction) => void;
  categories?: Array<{ id: string; name: string }>;
  onUpdateCategory?: (transactionId: string, categoryId: string) => void;
  onUpdateAmount?: (transactionId: string, amount: number) => void;
}

// Memoized type icon component
const TypeIcon = memo(({ type, amount, compactView }: { type: string; amount: number; compactView: boolean }): React.JSX.Element => {
  if (type === 'income' || (type === 'transfer' && amount > 0)) {
    return <TrendingUpIcon className="text-green-500" size={compactView ? 16 : 20} />;
  } else {
    return <TrendingDownIcon className="text-red-500" size={compactView ? 16 : 20} />;
  }
});
TypeIcon.displayName = 'TypeIcon';

// Memoized tag component
const TransactionTag = memo(({ tag, compactView }: { tag: string; compactView: boolean }): React.JSX.Element => (
  <span 
    className={`${compactView ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full`}
  >
    {tag}
  </span>
));
TransactionTag.displayName = 'TransactionTag';

export const TransactionRow = memo(function TransactionRow({
  transaction,
  account,
  categoryPath,
  compactView,
  formatCurrency,
  onEdit,
  onDelete,
  onView,
  columnOrder,
  columnWidths,
  isSelected = false,
  onToggleSelection,
  enableBulkSelection = false,
  isCurrentRow = false,
  isTabStop = false,
  onRowClick,
  onRowKeyDown,
  runningBalance,
  onContextMenu,
  categories: availableCategories,
  onUpdateCategory,
  onUpdateAmount
}: TransactionRowProps): React.JSX.Element {
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  // Memoize formatted date
  const formattedDate = useFormattedDate(transaction.date, 'en-GB');

  /**
   * Has this row arrived from an import with nobody having saved it since?
   *
   * The register's convention, and the ONE predicate every surface asks (see
   * transactionReview): the date and description carry the weight, at opposite
   * ends of the line, so the whole row reads as bold at a glance.
   */
  const awaitingReview = isAwaitingReview(transaction);

  // Where the mouse went DOWN, so a click the browser synthesised on this row
  // from a drag that began in one of its own boxes — the category picker, the
  // amount box — is not mistaken for someone clicking the row. Per row rather
  // than per table: a drag that starts in one row and ends in another has the
  // TABLE as its common ancestor, so no row's onClick fires for it at all.
  const { rowGestureProps, isSelectionTail } = useRowClickGesture();

  // Memoize formatted amount — accounting style: parentheses for expenses
  const formattedAmount = useMemo(() => {
    const isExpense = transaction.type === 'expense' || (transaction.type === 'transfer' && transaction.amount < 0);
    const absAmount = Math.abs(transaction.amount);
    const formatted = formatCurrency(absAmount, account?.currency);

    if (isExpense) {
      // Accounting notation: (£100.00) for expenses
      return `(${formatted})`;
    }
    return formatted;
  }, [transaction.type, transaction.amount, formatCurrency, account?.currency]);
  
  // Memoize amount color class
  const amountColorClass = useMemo(() => {
    return transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0)
      ? 'text-green-600'
      : 'text-red-600';
  }, [transaction.type, transaction.amount]);
  
  // Memoize event handlers
  const handleView = useCallback(() => {
    if (onView) {
      onView(transaction);
    }
  }, [onView, transaction]);
  
  const handleEdit = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    onEdit(transaction);
  }, [onEdit, transaction]);
  
  const handleDelete = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    onDelete(transaction.id);
  }, [onDelete, transaction.id]);
  
  const handleToggleSelection = useCallback(() => {
    if (onToggleSelection) {
      onToggleSelection(transaction.id);
    }
  }, [onToggleSelection, transaction.id]);

  const renderCell = useCallback((column: string) => {
    switch (column) {
      case 'date':
        return (
          <td 
            className={`${compactView ? 'py-1.5' : 'py-3'} pl-7 pr-6 text-gray-900 dark:text-gray-100 text-left`}
            style={{ width: columnWidths.date }}
          >
            <div className="flex items-center gap-2">
              <TypeIcon type={transaction.type} amount={transaction.amount} compactView={compactView} />
              <span className={`${compactView ? 'text-sm' : ''} ${awaitingReview ? 'font-semibold' : ''}`}>
                {formattedDate}
              </span>
            </div>
          </td>
        );

      case 'reconciled':
        return (
          <td
            className={`${compactView ? 'py-1.5' : 'py-3'} px-2 text-center`}
            style={{ width: columnWidths.reconciled }}
          >
            {/* Microsoft Money's own two letters, and the register's — C is a
                mark made while balancing, R is a reconciliation that was
                finished. One tick for both was what let a working mark pass for
                settled work, and a cross-account list that disagreed with the
                register about which is which would be worse than either.

                Both branches go through the shared predicates
                (transactionReconciliation), never `cleared` on its own: an
                unanswered `reconciled` is judged by `cleared`, and that
                fallback is the whole reason a pre-migration history does not
                light up as unreconciled. */}
            {isReconciled(transaction) ? (
              <span className={`text-blue-600 dark:text-blue-400 font-semibold ${compactView ? 'text-sm' : ''}`} title="Reconciled">R</span>
            ) : isMarkedAwaitingFinalize(transaction) ? (
              <span
                className={`text-gray-500 dark:text-gray-400 font-semibold ${compactView ? 'text-sm' : ''}`}
                title="Marked while balancing — not reconciled until you finalize"
              >
                C
              </span>
            ) : null}
          </td>
        );

      case 'account':
        return (
          <td 
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 text-gray-900 dark:text-gray-100 text-left`}
            style={{ width: columnWidths.account }}
          >
            <span className={`${compactView ? 'text-sm' : ''} truncate block`}>
              {account?.name || 'Unknown'}
            </span>
          </td>
        );
      
      case 'description':
        return (
          <td 
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 text-gray-900 dark:text-gray-100 text-left`}
            style={{ width: columnWidths.description }}
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={`${compactView ? 'text-sm' : ''} truncate ${awaitingReview ? 'font-semibold' : ''} ${onView ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={onView ? handleView : undefined}
                >
                  {transaction.description}
                </span>
                {/* WEIGHT IS A VISUAL CUE AND NOTHING ELSE (WCAG 1.4.1). Bold is
                    invisible to a screen reader and to anyone reading the list
                    one row at a time in a magnifier, so the fact is also stated
                    in words — off-screen, because on-screen it would be a second
                    marker for one fact and the whole point of the bold is that
                    it costs the row no space. The register says it the same way,
                    in the same words. */}
                {awaitingReview && <span className="sr-only">— new, not reviewed yet</span>}
                {transaction.notes && (
                  <div className={`${compactView ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
                    <MarkdownNote content={transaction.notes} />
                  </div>
                )}
                {transaction.tags && transaction.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {transaction.tags.map(tag => (
                      <TransactionTag key={tag} tag={tag} compactView={compactView} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        );
      
      case 'category':
        return (
          <td
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 text-gray-900 dark:text-gray-100 text-left`}
            style={{ width: columnWidths.category }}
          >
            {transaction.isSplit ? (
              // Money-style: a split transaction shows "Split" in the category
              // column; its categorisation lives in the split lines and is
              // edited through the full transaction editor, never inline.
              <span
                className={`${compactView ? 'text-sm' : ''} truncate block italic text-blue-600 dark:text-blue-400`}
                title="Split across multiple categories — open the transaction to edit its splits"
              >
                Split
              </span>
            ) : isEditingCategory && availableCategories && onUpdateCategory ? (
              <select
                className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={transaction.category || ''}
                onChange={(e) => {
                  onUpdateCategory(transaction.id, e.target.value);
                  setIsEditingCategory(false);
                }}
                onBlur={() => setIsEditingCategory(false)}
                autoFocus
              >
                <option value="">Uncategorized</option>
                {availableCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : onUpdateCategory ? (
              // The badge rides alongside the button rather than inside it: it
              // is a statement about the row, not part of the control's name,
              // and a screen reader announcing "Change category, currently
              // Groceries Suggested" would be naming a category that does not
              // exist. Choosing a different category here records the answer —
              // the service treats a changed category as one the user vouched
              // for — so this cell IS the "or edit" half; the badge disappears
              // of its own accord once it is.
              <span className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  className={`${compactView ? 'text-sm' : ''} truncate block flex-1 min-w-0 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  title={`${categoryPath} (click to change)`}
                  aria-label={`Change category, currently ${categoryPath || 'uncategorized'}`}
                  onClick={() => setIsEditingCategory(true)}
                >
                  {categoryPath || <span className="text-gray-400 italic">Uncategorized</span>}
                </button>
                {isConfirmableSuggestion(transaction) && (
                  <SuggestedCategoryBadge title="The app filled this in. Click the category to confirm it or pick a different one." />
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`${compactView ? 'text-sm' : ''} truncate`}
                  title={categoryPath}
                >
                  {categoryPath || <span className="text-gray-400 italic">Uncategorized</span>}
                </span>
                {isConfirmableSuggestion(transaction) && (
                  <SuggestedCategoryBadge title="The app filled this in and nobody has confirmed it yet." />
                )}
              </span>
            )}
          </td>
        );
      
      case 'amount':
        return (
          <td
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 font-medium text-right`}
            style={{ width: columnWidths.amount }}
          >
            {transaction.isSplit ? (
              // A split parent's amount is the sum of its split lines (locked
              // by the DB guard) — inline editing would only ever error.
              <span
                className={`${amountColorClass} ${compactView ? 'text-sm' : ''}`}
                title="Split transaction — its amount is the sum of its splits; edit them in the full editor"
              >
                {formattedAmount}
              </span>
            ) : isEditingAmount && onUpdateAmount ? (
              <MoneyInput
                className="w-full text-sm text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editAmount}
                aria-label="Edit transaction amount"
                // The row's type carries the sign; the cell holds the size.
                onChange={setEditAmount}
                onBlur={() => {
                  const parsed = Number(editAmount);
                  if (Number.isFinite(parsed) && parsed > 0 && parsed !== Math.abs(transaction.amount)) {
                    const newAmount = transaction.type === 'expense' ? -Math.abs(parsed) : Math.abs(parsed);
                    try {
                      onUpdateAmount(transaction.id, newAmount);
                    } catch {
                      // The caller surfaces failures (toast/log). Never let an
                      // edit-save error crash the row render path.
                    }
                  }
                  setIsEditingAmount(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    setIsEditingAmount(false);
                  }
                }}
                autoFocus
              />
            ) : onUpdateAmount ? (
              // Real button so keyboard and screen-reader users can edit too.
              <button
                type="button"
                className={`${amountColorClass} ${compactView ? 'text-sm' : ''} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full text-right`}
                onClick={() => {
                  setEditAmount(String(Math.abs(transaction.amount)));
                  setIsEditingAmount(true);
                }}
                title="Click to edit amount"
                aria-label={`Edit amount, currently ${formattedAmount}`}
              >
                {formattedAmount}
              </button>
            ) : (
              <span className={`${amountColorClass} ${compactView ? 'text-sm' : ''}`}>
                {formattedAmount}
              </span>
            )}
          </td>
        );
      
      case 'balance':
        return (
          <td
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 font-medium text-right hidden xl:table-cell`}
            style={{ width: columnWidths.balance }}
          >
            {runningBalance !== undefined && (
              <span className={`${compactView ? 'text-sm' : 'text-sm'} ${runningBalance < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                {formatCurrency(runningBalance, account?.currency)}
              </span>
            )}
          </td>
        );

      case 'actions':
        return (
          <td
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 text-right`}
            style={{ width: columnWidths.actions }}
          >
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={<EditIcon size={compactView ? 14 : 16} />}
                onClick={handleEdit}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit transaction"
                size="sm"
                data-testid="edit-button"
              />
              <IconButton
                icon={<DeleteIcon size={compactView ? 14 : 16} />}
                onClick={handleDelete}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Delete transaction"
                size="sm"
                data-testid="delete-button"
              />
            </div>
          </td>
        );
      
      default:
        return null;
    }
  }, [
    compactView,
    columnWidths,
    transaction,
    account,
    formattedDate,
    formattedAmount,
    amountColorClass,
    categoryPath,
    onView,
    handleView,
    handleEdit,
    handleDelete,
    runningBalance,
    formatCurrency,
    isEditingCategory,
    availableCategories,
    onUpdateCategory,
    isEditingAmount,
    editAmount,
    onUpdateAmount,
    awaitingReview
  ]);

  /**
   * A click on the row — which is not the same thing as a click that merely
   * ENDED on the row.
   *
   * Two guards, and they answer different questions. `isSelectionTail` is about
   * where the gesture BEGAN: a drag that started in the amount box and was let
   * go a few pixels outside it arrives here as a click on the row, and it must
   * change nothing at all, or the re-render collapses the very text the user
   * was selecting. `clickedOwnControl` is about where the click LANDED: Edit,
   * Delete, the category button and the amount button are each a request to do
   * that thing, never a request to pick the row out.
   */
  const handleRowClick = useCallback((event: React.MouseEvent<HTMLTableRowElement>): void => {
    if (isSelectionTail()) return;
    if (enableBulkSelection) {
      // A row wearing a checkbox has already said what its click means.
      handleToggleSelection();
      return;
    }
    if (!onRowClick) return;
    if (clickedOwnControl(event.target, event.currentTarget)) return;
    onRowClick(transaction);
  }, [isSelectionTail, enableBulkSelection, handleToggleSelection, onRowClick, transaction]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>): void => {
    // A key pressed inside one of the row's own boxes belongs to that box:
    // ArrowDown in the category picker must open its list, not walk the table,
    // and Enter on the Edit button must press the button. Comparing target with
    // currentTarget is the whole guard — the row hears only its own keys —
    // which is why nothing here needs a list of exceptions for text entry.
    if (event.target !== event.currentTarget) return;
    onRowKeyDown?.(event, transaction);
  }, [onRowKeyDown, transaction]);

  // Selectable rows are drawn `select-none`, the same answer VirtualizedTable
  // gives its clickable rows: a row whose own text can be dragged over would
  // make a text-selection out of what was meant to be a click.
  const isSelectable = !!onRowClick && !enableBulkSelection;

  return (
    <tr
      id={transactionRowDomId(transaction.id)}
      className={`
        ${isCurrentRow ? TRANSACTION_ROW_SELECTED_CLASS : isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
        ${enableBulkSelection || isSelectable ? 'cursor-pointer' : ''}
        ${isSelectable ? 'select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500' : ''}
        transition-colors
      `}
      // The row itself takes the focus as the selection moves, so a screen
      // reader announces the whole line rather than relying on the marker
      // alone — the same choice the Accounts list made, and the reason
      // aria-current is enough here without giving the table grid semantics.
      tabIndex={isSelectable ? (isTabStop ? 0 : -1) : undefined}
      aria-current={isCurrentRow ? 'true' : undefined}
      {...(isSelectable ? rowGestureProps : {})}
      onClick={enableBulkSelection || isSelectable ? handleRowClick : undefined}
      onKeyDown={isSelectable ? handleRowKeyDown : undefined}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, transaction); } : undefined}
    >
      {enableBulkSelection && (
        <td className={`${compactView ? 'py-1.5' : 'py-3'} pl-4 pr-2`}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleToggleSelection}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
        </td>
      )}
      {columnOrder.map(column => (
        <React.Fragment key={column}>{renderCell(column)}</React.Fragment>
      ))}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.transaction.amount === nextProps.transaction.amount &&
    prevProps.transaction.description === nextProps.transaction.description &&
    prevProps.transaction.category === nextProps.transaction.category &&
    // Confirming a suggestion changes NOTHING else about the row — same
    // category, same amount, same description. Left out of this comparison the
    // badge would sit there after the user had answered it, until something
    // unrelated forced a re-render.
    prevProps.transaction.categoryConfirmed === nextProps.transaction.categoryConfirmed &&
    prevProps.transaction.isSplit === nextProps.transaction.isSplit &&
    prevProps.transaction.cleared === nextProps.transaction.cleared &&
    // Both halves of the C/R column, because they are two different facts: a
    // Finalize moves a row from C to R without touching `cleared`, and a row
    // left out of this comparison would keep drawing the letter it had.
    prevProps.transaction.reconciled === nextProps.transaction.reconciled &&
    // Saving an imported row clears its bold and nothing else about it — same
    // description, same amount, same category. Left out, the row would stay
    // bold until something unrelated forced a re-render.
    prevProps.transaction.needsReview === nextProps.transaction.needsReview &&
    prevProps.account?.id === nextProps.account?.id &&
    prevProps.categoryPath === nextProps.categoryPath &&
    prevProps.compactView === nextProps.compactView &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.enableBulkSelection === nextProps.enableBulkSelection &&
    // The highlight and the tab stop both move between two rows at a time. Left
    // out, the arrow keys would change the state and repaint nothing.
    prevProps.isCurrentRow === nextProps.isCurrentRow &&
    prevProps.isTabStop === nextProps.isTabStop &&
    // Check if column order or widths have changed
    JSON.stringify(prevProps.columnOrder) === JSON.stringify(nextProps.columnOrder) &&
    JSON.stringify(prevProps.columnWidths) === JSON.stringify(nextProps.columnWidths)
  );
});

TransactionRow.displayName = 'TransactionRow';