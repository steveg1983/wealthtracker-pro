import React, { useEffect, memo, useState } from 'react';
import { Modal } from '../common/Modal';
import { SaveIcon, FilterIcon } from '../icons';
import type { CustomFilterFormData } from './types';
import { logger } from '../../services/loggingService';

interface CustomFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, filters: CustomFilterFormData) => void;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
}

export const CustomFilterModal = memo(function CustomFilterModal({
  isOpen,
  onClose,
  onSave,
  categories,
  accounts
}: CustomFilterModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CustomFilterModal component initialized', {
      componentName: 'CustomFilterModal'
    });
  }, []);

  const [formData, setFormData] = useState<CustomFilterFormData>({
    name: '',
    dateRange: { start: null, end: null },
    categories: [],
    accounts: [],
    amountRange: { min: null, max: null },
    types: []
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a name for this filter');
      return;
    }
    onSave(formData.name, formData);
    onClose();
    // Reset form
    setFormData({
      name: '',
      dateRange: { start: null, end: null },
      categories: [],
      accounts: [],
      amountRange: { min: null, max: null },
      types: []
    });
  };

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(c => c !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const toggleAccount = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.includes(accountId)
        ? prev.accounts.filter(a => a !== accountId)
        : [...prev.accounts, accountId]
    }));
  };

  const toggleType = (type: 'income' | 'expense' | 'transfer') => {
    setFormData(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Custom Filter"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {/* Filter Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Large expenses this month"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={formData.dateRange.start?.toISOString().split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                dateRange: {
                  ...prev.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null
                }
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="date"
              value={formData.dateRange.end?.toISOString().split('T')[0] || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                dateRange: {
                  ...prev.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null
                }
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Transaction Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Transaction Types
          </label>
          <div className="flex gap-3">
            {(['income', 'expense', 'transfer'] as const).map(type => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.types.includes(type)}
                  onChange={() => toggleType(type)}
                  className="rounded"
                />
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Categories
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 
                        rounded-lg p-3 space-y-1">
            {categories.map(category => (
              <label key={category.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.categories.includes(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className="rounded"
                />
                <span className="text-sm">{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Accounts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Accounts
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 
                        rounded-lg p-3 space-y-1">
            {accounts.map(account => (
              <label key={account.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.accounts.includes(account.id)}
                  onChange={() => toggleAccount(account.id)}
                  className="rounded"
                />
                <span className="text-sm">{account.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Amount Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Min amount"
              value={formData.amountRange.min || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                amountRange: {
                  ...prev.amountRange,
                  min: e.target.value ? Number(e.target.value) : null
                }
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="number"
              placeholder="Max amount"
              value={formData.amountRange.max || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                amountRange: {
                  ...prev.amountRange,
                  max: e.target.value ? Number(e.target.value) : null
                }
              }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                     dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg 
                     hover:bg-primary-dark"
          >
            <SaveIcon size={18} />
            Save Filter
          </button>
        </div>
      </div>
    </Modal>
  );
});