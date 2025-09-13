/**
 * Recurring Template Card Component
 * World-class component for displaying recurring transaction templates
 * Implements Apple's Human Interface Guidelines for clarity and visual hierarchy
 */

import React, { useEffect, memo, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Repeat,
  PlayIcon as Play,
  PauseIcon as Pause,
  EditIcon as Edit2,
  DeleteIcon as Trash2
} from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { recurringTransactionService, type RecurringTemplate } from '../../services/recurring/recurringTransactionService';
import { logger } from '../../services/loggingService';

interface RecurringTemplateCardProps {
  template: RecurringTemplate;
  isProcessing: boolean;
  onToggleActive: (id: string) => void;
  onEdit: (template: RecurringTemplate) => void;
  onDelete: (id: string) => void;
}

/**
 * High-performance card component with optimal rendering
 */
export const RecurringTemplateCard = memo(function RecurringTemplateCard({
  template,
  isProcessing,
  onToggleActive,
  onEdit,
  onDelete
}: RecurringTemplateCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RecurringTemplateCard component initialized', {
      componentName: 'RecurringTemplateCard'
    });
  }, []);

  
  const statusColor = recurringTransactionService.getStatusColor(template, isProcessing);
  const frequencyLabel = recurringTransactionService.getFrequencyLabel(template.frequency);
  const amount = parseFloat(template.amount);
  
  const handleToggle = useCallback(() => {
    onToggleActive(template.id);
  }, [template.id, onToggleActive]);
  
  const handleEdit = useCallback(() => {
    onEdit(template);
  }, [template, onEdit]);
  
  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this recurring transaction?')) {
      onDelete(template.id);
    }
  }, [template.id, onDelete]);
  
  return (
    <article 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
      aria-label={`Recurring transaction: ${template.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <header className="flex items-center gap-3 mb-2">
            <Repeat size={20} className={statusColor} aria-hidden="true" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              {template.name}
            </h3>
            <StatusBadges isActive={template.isActive} isProcessing={isProcessing} />
          </header>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {template.description}
          </p>

          {/* Metrics Grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <MetricItem
              label="Amount"
              value={formatCurrency(amount)}
              className={amount > 0 ? 'text-green-600' : 'text-red-600'}
            />
            <MetricItem
              label="Frequency"
              value={frequencyLabel}
            />
            <MetricItem
              label="Next Date"
              value={format(new Date(template.nextDate), 'MMM d, yyyy')}
            />
            <MetricItem
              label="Occurrences"
              value={`${template.occurrences}${template.maxOccurrences ? ` / ${template.maxOccurrences}` : ''}`}
            />
          </dl>
        </div>

        {/* Actions */}
        <ActionButtons
          isActive={template.isActive}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </article>
  );
});

/**
 * Status badges component
 */
const StatusBadges = memo(function StatusBadges({
  isActive,
  isProcessing
}: {
  isActive: boolean;
  isProcessing: boolean;
}): React.JSX.Element | null {
  if (!isActive && !isProcessing) {
    return (
      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
        Paused
      </span>
    );
  }
  
  if (isProcessing) {
    return (
      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500 rounded-full">
        Processing...
      </span>
    );
  }
  
  return null;
});

/**
 * Metric display component
 */
const MetricItem = memo(function MetricItem({
  label,
  value,
  className = 'text-gray-900 dark:text-white'
}: {
  label: string;
  value: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-gray-500 dark:text-gray-400">{label}:</dt>
      <dd className={`font-medium ${className}`}>{value}</dd>
    </div>
  );
});

/**
 * Action buttons component
 */
const ActionButtons = memo(function ActionButtons({
  isActive,
  onToggle,
  onEdit,
  onDelete
}: {
  isActive: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 ml-4" role="group" aria-label="Actions">
      <button
        onClick={onToggle}
        className={`p-2 rounded-lg transition-colors ${
          isActive
            ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={isActive ? 'Pause' : 'Resume'}
        aria-label={isActive ? 'Pause recurring transaction' : 'Resume recurring transaction'}
      >
        {isActive ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button
        onClick={onEdit}
        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Edit"
        aria-label="Edit recurring transaction"
      >
        <Edit2 size={18} />
      </button>
      <button
        onClick={onDelete}
        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title="Delete"
        aria-label="Delete recurring transaction"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
});