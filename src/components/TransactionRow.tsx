import React, { memo } from 'react';
import type { Transaction, Account } from '../types';
import { TrendingUpIcon, TrendingDownIcon, CheckIcon, EditIcon, DeleteIcon } from './icons';
import { IconButton } from './icons/IconButton';

interface TransactionRowProps {
  transaction: Transaction;
  account: Account | undefined;
  categoryPath: string;
  compactView: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  columnOrder: string[];
  columnWidths: Record<string, number>;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  account,
  categoryPath,
  compactView,
  formatCurrency,
  onEdit,
  onDelete,
  columnOrder,
  columnWidths
}: TransactionRowProps) {
  const getTypeIcon = (type: string) => {
    return type === 'income' ? (
      <TrendingUpIcon className="text-green-500" size={compactView ? 16 : 20} />
    ) : (
      <TrendingDownIcon className="text-red-500" size={compactView ? 16 : 20} />
    );
  };

  const renderCell = (column: string) => {
    switch (column) {
      case 'date':
        return (
          <td 
            className={`${compactView ? 'py-1.5' : 'py-3'} pl-7 pr-6 text-gray-900 dark:text-gray-100 text-left`}
            style={{ width: columnWidths.date }}
          >
            <div className="flex items-center gap-2">
              {getTypeIcon(transaction.type)}
              <span className={compactView ? 'text-sm' : ''}>
                {new Date(transaction.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
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
            <div className="flex flex-col">
              <span className={`${compactView ? 'text-sm' : ''} truncate`}>
                {transaction.description}
              </span>
              {transaction.notes && (
                <span className={`${compactView ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 truncate`}>
                  {transaction.notes}
                </span>
              )}
              {transaction.tags && transaction.tags.length > 0 && (
                <div className="flex gap-1 mt-0.5">
                  {transaction.tags.map(tag => (
                    <span 
                      key={tag} 
                      className={`${compactView ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
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
            <span className={`${
              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
            } ${compactView ? 'text-sm' : ''}`}>
              {transaction.type === 'income' ? '+' : '-'}
              {formatCurrency(transaction.amount, account?.currency)}
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
                onClick={(e) => {
                  e?.stopPropagation();
                  onEdit(transaction);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Edit transaction"
                size="sm"
                data-testid="edit-button"
              />
              <IconButton
                icon={<DeleteIcon size={compactView ? 14 : 16} />}
                onClick={(e) => {
                  e?.stopPropagation();
                  onDelete(transaction.id);
                }}
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
  };

  return (
    <tr 
      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      onClick={() => onEdit(transaction)}
    >
      {columnOrder.map(column => <React.Fragment key={column}>{renderCell(column)}</React.Fragment>)}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.transaction.id === nextProps.transaction.id &&
    prevProps.transaction.cleared === nextProps.transaction.cleared &&
    prevProps.transaction.description === nextProps.transaction.description &&
    prevProps.transaction.amount === nextProps.transaction.amount &&
    prevProps.account?.id === nextProps.account?.id &&
    prevProps.categoryPath === nextProps.categoryPath &&
    prevProps.compactView === nextProps.compactView &&
    prevProps.columnOrder.join(',') === nextProps.columnOrder.join(',') &&
    JSON.stringify(prevProps.columnWidths) === JSON.stringify(nextProps.columnWidths)
  );
});