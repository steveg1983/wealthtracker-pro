import { memo, useEffect } from 'react';
import { DeleteIcon as Trash2 } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import type { SplitItem as SplitItemType } from '../../services/splitTransactionService';
import { useLogger } from '../services/ServiceProvider';

interface SplitItemProps {
  split: SplitItemType;
  index: number;
  splitMode: 'amount' | 'percentage';
  categories: Array<{ id: string; name: string }>;
  canRemove: boolean;
  onUpdate: (id: string, field: keyof SplitItemType, value: string | number) => void;
  onRemove: (id: string) => void;
}

export const SplitItem = memo(function SplitItem({ split,
  index,
  splitMode,
  categories,
  canRemove,
  onUpdate,
  onRemove
 }: SplitItemProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SplitItem component initialized', {
      componentName: 'SplitItem'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-500">
          {index + 1}
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {splitMode === 'amount' ? 'Amount' : 'Percentage'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                {splitMode === 'amount' ? '$' : '%'}
              </span>
              <input
                type="number"
                value={splitMode === 'amount' ? split.amount : split.percentage?.toFixed(2)}
                onChange={(e) => onUpdate(
                  split.id, 
                  splitMode === 'amount' ? 'amount' : 'percentage',
                  e.target.value
                )}
                step={splitMode === 'amount' ? '0.01' : '1'}
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Category
            </label>
            <select
              value={split.category}
              onChange={(e) => onUpdate(split.id, 'category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="Uncategorized">Uncategorized</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={split.description}
              onChange={(e) => onUpdate(split.id, 'description', e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <button
          onClick={() => onRemove(split.id)}
          disabled={!canRemove}
          className={`p-2 rounded-lg transition-colors ${
            canRemove
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {splitMode === 'amount' && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {split.percentage?.toFixed(1)}% of total
        </div>
      )}
      {splitMode === 'percentage' && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          = {formatCurrency(split.amount)}
        </div>
      )}
    </div>
  );
});