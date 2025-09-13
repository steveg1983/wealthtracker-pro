import { memo, useEffect } from 'react';
import type { Category } from '../../types';
import { logger } from '../../services/loggingService';

interface NewEnvelope {
  name: string;
  budgetedAmount: string;
  categoryIds: string[];
  color: string;
  priority: 'high' | 'medium' | 'low';
}

interface AddEnvelopeModalProps {
  newEnvelope: NewEnvelope;
  categories: Category[];
  onEnvelopeChange: (envelope: NewEnvelope) => void;
  onAddEnvelope: () => void;
  onClose: () => void;
}

/**
 * Add envelope modal component
 * Handles creation of new budget envelopes
 */
export const AddEnvelopeModal = memo(function AddEnvelopeModal({
  newEnvelope,
  categories,
  onEnvelopeChange,
  onAddEnvelope,
  onClose
}: AddEnvelopeModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AddEnvelopeModal component initialized', {
      componentName: 'AddEnvelopeModal'
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Envelope</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Envelope Name
            </label>
            <input
              type="text"
              value={newEnvelope.name}
              onChange={(e) => onEnvelopeChange({...newEnvelope, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Groceries"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Budgeted Amount
            </label>
            <input
              type="number"
              value={newEnvelope.budgetedAmount}
              onChange={(e) => onEnvelopeChange({...newEnvelope, budgetedAmount: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              value={newEnvelope.priority}
              onChange={(e) => onEnvelopeChange({...newEnvelope, priority: e.target.value as 'high' | 'medium' | 'low'})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <input
              type="color"
              value={newEnvelope.color}
              onChange={(e) => onEnvelopeChange({...newEnvelope, color: e.target.value})}
              className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categories
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {categories.map(category => (
                <label key={category.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEnvelope.categoryIds.includes(category.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onEnvelopeChange({
                          ...newEnvelope,
                          categoryIds: [...newEnvelope.categoryIds, category.id]
                        });
                      } else {
                        onEnvelopeChange({
                          ...newEnvelope,
                          categoryIds: newEnvelope.categoryIds.filter(id => id !== category.id)
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                </label>
              ))}
            </div>
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
            onClick={onAddEnvelope}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Add Envelope
          </button>
        </div>
      </div>
    </div>
  );
});