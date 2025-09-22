import React, { useEffect, memo } from 'react';
import { EditIcon, DeleteIcon, RefreshCwIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { ZeroBudgetItem } from './types';
import { useLogger } from '../services/ServiceProvider';

interface BudgetItemsListProps {
  items: ZeroBudgetItem[];
  onToggleApproval: (itemId: string) => void;
  onEdit: (item: ZeroBudgetItem) => void;
  onDelete: (itemId: string) => void;
}

export const BudgetItemsList = memo(function BudgetItemsList({ items,
  onToggleApproval,
  onEdit,
  onDelete
 }: BudgetItemsListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetItemsList component initialized', {
      componentName: 'BudgetItemsList'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        No budget items yet. Start by adding your essential expenses.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center justify-between p-4 rounded-lg border ${
            item.isApproved 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
          }`}
        >
          <div className="flex items-start gap-3 flex-1">
            <input
              type="checkbox"
              checked={item.isApproved}
              onChange={() => onToggleApproval(item.id)}
              className="mt-1 rounded"
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{item.description}</h4>
                <span className={`text-xs px-2 py-1 rounded ${
                  item.priority === 'essential' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  item.priority === 'important' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                }`}>
                  {item.priority}
                </span>
                {item.isRecurring && (
                  <RefreshCwIcon size={14} className="text-gray-500" />
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.category} {item.subcategory && `• ${item.subcategory}`} • {item.frequency}
              </div>
              {item.notes && (
                <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="font-semibold">
              {formatCurrency(item.amount)}
              {item.frequency !== 'monthly' && (
                <span className="text-xs text-gray-500">/{item.frequency}</span>
              )}
            </span>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(item)}
                className="p-1 text-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded"
              >
                <EditIcon size={16} />
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
              >
                <DeleteIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});