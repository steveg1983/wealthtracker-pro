import { memo, useState, useEffect } from 'react';
import type { Budget } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface CreateTemplateModalProps {
  isOpen: boolean;
  budgets: Budget[];
  formatCurrency: (amount: number) => string;
  onClose: () => void;
  onCreate: (template: {
    name: string;
    description: string;
    frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly';
  }) => void;
}

/**
 * Modal for creating budget templates
 * Extracted from RecurringBudgetTemplates for single responsibility
 */
export const CreateTemplateModal = memo(function CreateTemplateModal({ isOpen,
  budgets,
  formatCurrency,
  onClose,
  onCreate
 }: CreateTemplateModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('CreateTemplateModal component initialized', {
      componentName: 'CreateTemplateModal'
    });
  }, []);

  const [template, setTemplate] = useState({
    name: '',
    description: '',
    frequency: 'monthly' as 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'yearly'
  });

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!template.name) return;
    onCreate(template);
    setTemplate({ name: '', description: '', frequency: 'monthly' });
  };

  const totalAmount = budgets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create Budget Template
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template Name
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({...template, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Monthly Budget"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={template.description}
              onChange={(e) => setTemplate({...template, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Brief description of this template..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Frequency
            </label>
            <select
              value={template.frequency}
              onChange={(e) => setTemplate({...template, frequency: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Template Preview</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This template will include {budgets.length} budget items with a total of {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Create Template
          </button>
        </div>
      </div>
    </div>
  );
});
