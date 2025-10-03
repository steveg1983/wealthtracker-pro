import React, { useEffect, memo, useState } from 'react';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface CreateBudgetModalProps {
  categories: Category[];
  onClose: () => void;
  onSubmit: (budget: {
    name: string;
    category: string;
    amount: string;
    period: 'monthly' | 'weekly' | 'yearly';
    approvalRequired: boolean;
    approvalThreshold: string;
  }) => void;
}

export const CreateBudgetModal = memo(function CreateBudgetModal({ categories,
  onClose,
  onSubmit
 }: CreateBudgetModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CreateBudgetModal component initialized', {
      componentName: 'CreateBudgetModal'
    });
  }, []);

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    category: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'weekly' | 'yearly',
    approvalRequired: false,
    approvalThreshold: '100'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(budgetForm);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Create Shared Budget</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Budget Name
            </label>
            <input
              type="text"
              value={budgetForm.name}
              onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={budgetForm.category}
              onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={budgetForm.amount}
              onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period
            </label>
            <select
              value={budgetForm.period}
              onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value as 'monthly' | 'weekly' | 'yearly' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={budgetForm.approvalRequired}
              onChange={(e) => setBudgetForm({ ...budgetForm, approvalRequired: e.target.checked })}
              className="rounded text-indigo-600"
            />
            <span className="text-sm">Require approval for changes</span>
          </label>

          {budgetForm.approvalRequired && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Approval Threshold
              </label>
              <input
                type="number"
                value={budgetForm.approvalThreshold}
                onChange={(e) => setBudgetForm({ ...budgetForm, approvalThreshold: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});