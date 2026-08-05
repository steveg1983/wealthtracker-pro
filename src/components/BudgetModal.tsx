import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';
import { parseMoneyInput } from '../utils/decimal';
import CategorySelector from './CategorySelector';
import type { Budget, Category } from '../types';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget;
}

interface FormData {
  categoryId: string;
  amount: string;
  period: 'monthly' | 'weekly' | 'yearly' | 'custom' | 'quarterly';
  isActive: boolean;
}

export default function BudgetModal({ isOpen, onClose, budget }: BudgetModalProps): React.JSX.Element {
  const { addBudget, updateBudget, categories } = useApp();

  /**
   * Budgets key on a category ID: that is what `calculateBudgetSpending`
   * matches against `transaction.category`, and what the recommendation
   * service writes. This modal's old flat <select> stored the category NAME
   * instead, so a budget added here matched nothing. Resolve such a legacy
   * value back to its id on open, so editing an old budget both shows the
   * right category and heals the stored value on save.
   */
  const seededCategoryId = useMemo((): string => {
    const stored = budget?.categoryId;
    if (!stored) return '';
    if (categories.some((c: Category) => c.id === stored)) return stored;
    const byName = categories.find((c: Category) => c.level === 'detail' && c.name === stored);
    return byName?.id ?? '';
  }, [budget?.categoryId, categories]);

  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    {
      categoryId: seededCategoryId,
      amount: budget?.amount?.toString() || '',
      period: budget?.period || 'monthly',
      isActive: budget?.isActive !== false
    },
    {
      onSubmit: (data) => {
        const now = new Date();
        const budgetData = {
          categoryId: data.categoryId,
          amount: parseMoneyInput(data.amount) ?? 0,
          period: data.period,
          isActive: data.isActive,
          createdAt: budget?.createdAt || now,
          updatedAt: now
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

  // The combobox has no native `required`, so the form guards the field itself.
  const [categoryError, setCategoryError] = useState('');

  const onFormSubmit = (e: React.FormEvent): void => {
    if (!formData.categoryId) {
      e.preventDefault();
      setCategoryError('Choose a category to budget against.');
      return;
    }
    handleSubmit(e);
  };

  // Re-seeds on the RESOLVED id, not on `categories`: an unrelated category
  // refresh while the modal is open must not wipe what the user has typed.
  useEffect(() => {
    if (budget) {
      setFormData({
        categoryId: seededCategoryId,
        amount: budget.amount?.toString() || '',
        period: budget.period || 'monthly',
        isActive: budget.isActive !== false
      });
    }
  }, [budget, setFormData, seededCategoryId]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={budget ? 'Edit Budget' : 'Add Budget'} size="md">
      <form onSubmit={onFormSubmit}>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-red-500" aria-label="required">*</span>
            </label>
            {/* The shared searchable picker every categorisation surface uses:
                grouped under its parent group, alphabetical inside. Budgets are
                spending limits, so it lists the expense tree. usePortal escapes
                the modal body's overflow-y-auto clipping. */}
            <CategorySelector
              selectedCategory={formData.categoryId}
              onCategoryChange={(categoryId) => {
                setCategoryError('');
                updateField('categoryId', categoryId);
              }}
              transactionType="expense"
              placeholder="Search or select category…"
              allowCreate={false}
              showHelperText={false}
              usePortal
            />
            {categoryError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {categoryError}
              </p>
            )}
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
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
              className="flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 justify-center px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
            >
              {budget ? 'Save Changes' : 'Add Budget'}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
