import { memo, useEffect } from 'react';
import { 
  PlayIcon, 
  StopIcon, 
  CopyIcon, 
  TrashIcon
} from '../icons';
import type { BudgetTemplate } from '../../services/budgetTemplateService';
import { budgetTemplateService } from '../../services/budgetTemplateService';
import { useLogger } from '../services/ServiceProvider';

interface BudgetTemplateCardProps {
  template: BudgetTemplate;
  notificationDays: number;
  formatCurrency: (amount: number) => string;
  onApply: (template: BudgetTemplate) => void;
  onToggleActive: (templateId: string) => void;
  onDuplicate: (template: BudgetTemplate) => void;
  onDelete: (templateId: string) => void;
}

/**
 * Individual budget template card component
 * Extracted from RecurringBudgetTemplates for single responsibility
 */
export const BudgetTemplateCard = memo(function BudgetTemplateCard({ template,
  notificationDays,
  formatCurrency,
  onApply,
  onToggleActive,
  onDuplicate,
  onDelete
 }: BudgetTemplateCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BudgetTemplateCard component initialized', {
      componentName: 'BudgetTemplateCard'
    });
  }, []);

  const statusColor = budgetTemplateService.getStatusColor(template, notificationDays);
  const statusText = budgetTemplateService.getStatusText(template, notificationDays);
  const frequencyText = budgetTemplateService.getFrequencyText(template.frequency);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
          {statusText}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{template.description}</p>

      {/* Metrics */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(template.totalAmount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {frequencyText}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Next Application:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {new Date(template.nextApplicationDate).toLocaleDateString()}
          </span>
        </div>
        {template.lastApplied && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Last Applied:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(template.lastApplied).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Budget Items Preview */}
      <div className="mb-4">
        <span className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">
          Budget Items ({template.budgetItems.length}):
        </span>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {template.budgetItems.slice(0, 3).map((item, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
          {template.budgetItems.length > 3 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              +{template.budgetItems.length - 3} more
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApply(template)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          <PlayIcon size={14} />
          Apply
        </button>
        <button
          onClick={() => onToggleActive(template.id)}
          className={`flex items-center justify-center p-2 rounded-lg ${
            template.isActive
              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {template.isActive ? <StopIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <button
          onClick={() => onDuplicate(template)}
          className="flex items-center justify-center p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <CopyIcon size={16} />
        </button>
        <button
          onClick={() => onDelete(template.id)}
          className="flex items-center justify-center p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
});