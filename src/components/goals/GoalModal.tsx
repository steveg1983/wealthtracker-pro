import React, { useEffect, memo, useState } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import {
  PlusIcon,
  HomeIcon,
  CarIcon,
  GraduationCapIcon,
  PalmtreeIcon,
  RingIcon,
  HeartIcon,
  PiggyBankIcon,
  TargetIcon
} from '../icons';
import type { Goal } from '../../types';
import { logger } from '../../services/loggingService';

interface GoalModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Omit<Goal, 'id' | 'progress'>) => void;
}

const categories = [
  { value: 'home', label: 'Home', icon: HomeIcon },
  { value: 'car', label: 'Car', icon: CarIcon },
  { value: 'education', label: 'Education', icon: GraduationCapIcon },
  { value: 'vacation', label: 'Vacation', icon: PalmtreeIcon },
  { value: 'wedding', label: 'Wedding', icon: RingIcon },
  { value: 'emergency', label: 'Emergency Fund', icon: HeartIcon },
  { value: 'retirement', label: 'Retirement', icon: PiggyBankIcon },
  { value: 'other', label: 'Other', icon: TargetIcon }
];

export const GoalModal = memo(function GoalModal({ goal, onClose, onSave }: GoalModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('GoalModal component initialized', {
      componentName: 'GoalModal'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();
  const [formData, setFormData] = useState({
    name: goal?.name || '',
    type: goal?.type || 'custom' as Goal['type'],
    category: goal?.category || 'other',
    targetAmount: goal?.targetAmount || 0,
    currentAmount: goal?.currentAmount || 0,
    targetDate: goal?.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
    description: goal?.description || '',
    isActive: goal?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      type: formData.type,
      targetAmount: formData.targetAmount,
      currentAmount: formData.currentAmount,
      targetDate: new Date(formData.targetDate),
      description: formData.description || undefined,
      linkedAccountIds: goal?.linkedAccountIds,
      isActive: formData.isActive,
      category: formData.category,
      createdAt: goal?.createdAt || new Date(),
      updatedAt: new Date(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {goal ? 'Edit Goal' : 'Create New Goal'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Goal Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Dream Home Down Payment"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Amount
              </label>
              <input
                type="number"
                value={formData.targetAmount || ''}
                onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Amount Saved
              </label>
              <input
                type="number"
                value={formData.currentAmount || ''}
                onChange={(e) => setFormData({ ...formData, currentAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Date
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder="Add notes about this goal..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              {goal ? 'Update' : 'Create'} Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
