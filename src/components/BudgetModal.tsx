import { useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';
import type { Budget } from '../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget;
}

interface FormData {
  category: string;
  amount: string;
  period: 'monthly' | 'weekly' | 'yearly' | 'custom' | 'quarterly';
  isActive: boolean;
}

export default function BudgetModal({ isOpen, onClose, budget }: BudgetModalProps): React.JSX.Element {
  const { addBudget, updateBudget, categories } = useApp();
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    {
      category: budget?.categoryId || '',
      amount: budget?.amount?.toString() || '',
      period: budget?.period || 'monthly',
      isActive: budget?.isActive !== false
    },
    {
      onSubmit: (data) => {
        const budgetData = {
          categoryId: data.category,
          amount: parseFloat(data.amount),
          period: data.period,
          isActive: data.isActive
        };

        if (budget) {
          updateBudget(budget.id, budgetData);
        } else {
          addBudget(budgetData);
        }
      },
      onClose
    }
  );

  useEffect(() => {
    if (budget) {
      setFormData({
        category: budget.categoryId || '',
        amount: budget.amount?.toString() || '',
        period: budget.period || 'monthly',
        isActive: budget.isActive !== false
      });
    }
  }, [budget, setFormData]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={budget ? 'Edit Budget' : 'Add Budget'} size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="">Select category</option>
              {categories
                .filter(cat => cat.level === 'detail' && (cat.type === 'expense' || cat.type === 'both'))
                .map(cat => {
                  // Build the full category path
                  const parent = categories.find(c => c.id === cat.parentId);
                  const grandParent = parent ? categories.find(c => c.id === parent.parentId) : null;
                  const path = grandParent ? `${parent?.name} > ${cat.name}` : cat.name;
                  
                  return (
                    <option key={cat.id} value={cat.name}>
                      {path}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period
            </label>
            <select
              value={formData.period}
              onChange={(e) => updateField('period', e.target.value as 'monthly' | 'yearly')}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => updateField('isActive', e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
              Budget is active
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
            >
              {budget ? 'Save Changes' : 'Add Budget'}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
