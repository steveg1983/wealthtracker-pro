import React, { memo, useCallback, useMemo } from 'react';
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
  enableBulkSelection = false
}: TransactionRowProps): React.JSX.Element {
  // Memoize formatted date
  const formattedDate = useFormattedDate(transaction.date, 'en-GB');
  
  // Memoize formatted amount
  const formattedAmount = useMemo(() => {
    const isPositive = transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0);
    const prefix = isPositive ? '+' : '-';
    return prefix + formatCurrency(Math.abs(transaction.amount), account?.currency);
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
              <CheckIcon className="text-green-500 mx-auto" size={compactView ? 14 : 16} data-testid="check-icon" />
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
            <span 
              className={`${compactView ? 'text-sm' : ''} truncate block`}
              title={categoryPath}
            >
              {categoryPath}
            </span>
          </td>
        );
      
      case 'amount':
        return (
          <td 
            className={`${compactView ? 'py-1.5' : 'py-3'} px-6 font-medium text-right`}
            style={{ width: columnWidths.amount }}
          >
            <span className={`${amountColorClass} ${compactView ? 'text-sm' : ''}`}>
              {formattedAmount}
            </span>
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
    handleDelete
  ]);

  return (
    <tr 
      className={`
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'} 
        ${enableBulkSelection ? 'cursor-pointer' : ''} 
        transition-colors
      `}
      onClick={enableBulkSelection ? handleToggleSelection : undefined}
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