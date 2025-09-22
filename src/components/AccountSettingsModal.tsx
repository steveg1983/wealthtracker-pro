/**
 * AccountSettingsModal Component - Account configuration and settings
 *
 * Features:
 * - Account name and details editing
 * - Account type changes
 * - Currency settings
 * - Account status (active/inactive)
 * - Account deletion
 */

import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import { ConfirmModal } from './common/Modal';
import { lazyLogger as logger } from '../services/serviceFactory';

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  is_active: boolean;
  description?: string;
}

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (updatedAccount: Partial<Account>) => Promise<void>;
  onDelete?: (accountId: string) => Promise<void>;
}

const accountTypes = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'investment', label: 'Investment Account' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' }
];

const currencies = [
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' }
];

export default function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onSave,
  onDelete
}: AccountSettingsModalProps): React.JSX.Element {
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    currency: 'GBP',
    description: '',
    is_active: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form when account changes
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        type: account.type || 'checking',
        currency: account.currency || 'GBP',
        description: account.description || '',
        is_active: account.is_active !== false
      });
    }
  }, [account]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account || !formData.name.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      });

      logger.info('Account settings saved successfully', { accountId: account.id });
      onClose();
    } catch (error) {
      logger.error('Error saving account settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!account || !onDelete) return;

    try {
      await onDelete(account.id);
      logger.info('Account deleted successfully', { accountId: account.id });
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      logger.error('Error deleting account:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'GBP'): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency
    }).format(amount);
  };

  if (!account) {
    return <></>;
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Account Settings"
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Account Info Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {account.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current Balance: {formatCurrency(account.balance, account.currency)}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                account.is_active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {account.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter account name"
              required
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              {accountTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              {currencies.map(currency => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Optional description or notes about this account"
            />
          </div>

          {/* Account Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-offset-0 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Account is active
            </label>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Inactive accounts are hidden from most views but data is preserved
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
              disabled={isLoading}
            >
              Cancel
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                disabled={isLoading}
              >
                Delete
              </button>
            )}

            <button
              type="submit"
              disabled={!formData.name.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${account.name}"? This action cannot be undone and will remove all associated transactions and data.`}
        confirmText="Delete Account"
        variant="danger"
      />
    </>
  );
}