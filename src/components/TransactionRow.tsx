import React, { memo, useCallback, useMemo, useState } from 'react';
import type { Transaction, Account } from '../types';
import { TrendingUpIcon, TrendingDownIcon, CheckIcon, EditIcon, DeleteIcon } from './icons';
import { IconButton } from './icons/IconButton';
import LocalMerchantLogo from './LocalMerchantLogo';
import MarkdownNote from './MarkdownNote';
import { useFormattedDate } from '../hooks/useFormattedValues';

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
              <span className={compactView ? 'text-sm' : ''}>
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
            {transaction.cleared && (
              <CheckIcon className="text-blue-600 mx-auto" size={compactView ? 14 : 16} data-testid="check-icon" />
            )}
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
              <LocalMerchantLogo 
                description={transaction.description} 
                size={compactView ? 'sm' : 'md'}
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span 
                  className={`${compactView ? 'text-sm' : ''} truncate ${onView ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={onView ? handleView : undefined}
                >
                  {transaction.description}
                </span>
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
            {isEditingCategory && availableCategories && onUpdateCategory ? (
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
              // Real button so keyboard and screen-reader users can edit too
              // (WCAG 2.1.1 — a span with onClick is invisible to AT).
              <button
                type="button"
                className={`${compactView ? 'text-sm' : ''} truncate block w-full text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                title={`${categoryPath} (click to change)`}
                aria-label={`Change category, currently ${categoryPath || 'uncategorized'}`}
                onClick={() => setIsEditingCategory(true)}
              >
                {categoryPath || <span className="text-gray-400 italic">Uncategorized</span>}
              </button>
            ) : (
              <span
                className={`${compactView ? 'text-sm' : ''} truncate block`}
                title={categoryPath}
              >
                {categoryPath || <span className="text-gray-400 italic">Uncategorized</span>}
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
            {isEditingAmount && onUpdateAmount ? (
              <input
                type="number"
                step="0.01"
                className="w-full text-sm text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editAmount}
                aria-label="Edit transaction amount"
                onChange={(e) => setEditAmount(e.target.value)}
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
    onUpdateAmount
  ]);

  return (
    <tr 
      className={`
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'} 
        ${enableBulkSelection ? 'cursor-pointer' : ''} 
        transition-colors
      `}
      onClick={enableBulkSelection ? handleToggleSelection : undefined}
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
      {columnOrder.map(column => renderCell(column))}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.transaction.amount === nextProps.transaction.amount &&
    prevProps.transaction.description === nextProps.transaction.description &&
    prevProps.transaction.category === nextProps.transaction.category &&
    prevProps.transaction.cleared === nextProps.transaction.cleared &&
    prevProps.account?.id === nextProps.account?.id &&
    prevProps.categoryPath === nextProps.categoryPath &&
    prevProps.compactView === nextProps.compactView &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.enableBulkSelection === nextProps.enableBulkSelection &&
    // Check if column order or widths have changed
    JSON.stringify(prevProps.columnOrder) === JSON.stringify(nextProps.columnOrder) &&
    JSON.stringify(prevProps.columnWidths) === JSON.stringify(nextProps.columnWidths)
  );
});

TransactionRow.displayName = 'TransactionRow';