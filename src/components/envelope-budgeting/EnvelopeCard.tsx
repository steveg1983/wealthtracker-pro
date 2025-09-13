import { memo, useEffect } from 'react';
import type { Envelope } from '../../services/envelopeService';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface EnvelopeCardProps {
  envelope: Envelope;
  categories: Category[];
  isSelected: boolean;
  formatCurrency: (value: number) => string;
  getPriorityColor: (priority: string) => string;
  onClick: () => void;
}

/**
 * Individual envelope card component
 * Displays envelope details and progress
 */
export const EnvelopeCard = memo(function EnvelopeCard({
  envelope,
  categories,
  isSelected,
  formatCurrency,
  getPriorityColor,
  onClick
}: EnvelopeCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EnvelopeCard component initialized', {
      componentName: 'EnvelopeCard'
    });
  }, []);

  return (
    <div
      className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 cursor-pointer transition-all hover:shadow-xl ${
        isSelected ? 'ring-2 ring-[var(--color-primary)]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: envelope.color }}
          />
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{envelope.name}</h3>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(envelope.priority)}`}>
          {envelope.priority}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>Spent</span>
          <span>{envelope.fillPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              envelope.isOverspent ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ 
              width: `${Math.min(envelope.fillPercentage, 100)}%`,
              backgroundColor: envelope.isOverspent ? '#EF4444' : envelope.color
            }}
          />
        </div>
      </div>

      {/* Amounts */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Budgeted:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(envelope.budgetedAmount.toNumber())}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Spent:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(envelope.spentAmount.toNumber())}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Remaining:</span>
          <span className={`text-sm font-medium ${
            envelope.remainingAmount.greaterThanOrEqualTo(0) 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(envelope.remainingAmount.toNumber())}
          </span>
        </div>
      </div>

      {/* Categories */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">Categories:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {envelope.categoryIds.map(categoryId => {
            const category = categories.find(c => c.id === categoryId);
            return category ? (
              <span
                key={categoryId}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-700 dark:text-gray-300"
              >
                {category.name}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
});
