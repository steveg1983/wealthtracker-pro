/**
 * Offline Transaction Form
 * Allows creating transactions while offline with sync queue
 */

import React from 'react';
import { useOfflineOperations } from '../../pwa/offline-storage';
import { useCategories } from '../../contexts/CategoryContext';
import { useAccounts } from '../../contexts/AccountContext';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import MoneyInput from '../common/MoneyInput';
import AccountSelector from '../common/AccountSelector';
import DatePicker from '../common/DatePicker';
import { toDecimal, parseMoneyInput } from '../../utils/decimal';
import { 
  WifiOffIcon, 
  CheckCircleIcon, 
  AlertCircleIcon,
  DollarSignIcon,
  FileTextIcon
} from '../icons';

interface OfflineTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const OfflineTransactionForm: React.FC<OfflineTransactionFormProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { queue } = useOfflineOperations();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [formData, setFormData] = React.useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    tags: [] as string[],
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.description || !formData.amount || !formData.category || !formData.accountId) {
      setError('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Create transaction object
      const transaction = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: formData.description,
        amount: toDecimal(parseMoneyInput(formData.amount) ?? 0)
          .times(formData.type === 'expense' ? -1 : 1)
          .toNumber(),
        category: formData.category,
        accountId: formData.accountId,
        date: formData.date,
        tags: formData.tags,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOffline: true
      };
      
      // Queue for sync
      await queue({
        type: 'create',
        entity: 'transaction',
        data: transaction
      });
      
      setShowSuccess(true);
      
      // Reset form after short delay
      setTimeout(() => {
        setFormData({
          description: '',
          amount: '',
          type: 'expense',
          category: '',
          accountId: '',
          date: new Date().toISOString().split('T')[0],
          tags: [],
          notes: ''
        });
        setShowSuccess(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
      
    } catch (err) {
      setError((err as Error).message || 'Failed to queue transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Add Transaction (Offline)</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <WifiOffIcon className="h-4 w-4" />
            <span>Will sync when back online</span>
          </div>
        </div>

        {showSuccess ? (
          <div className="p-8 text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Transaction Queued!</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your transaction will be synced when you're back online.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
                <AlertCircleIcon className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Transaction Type */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`flex-1 justify-center py-2 px-4 rounded-lg font-medium transition-colors ${
                  formData.type === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`flex-1 justify-center py-2 px-4 rounded-lg font-medium transition-colors ${
                  formData.type === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Income
              </button>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileTextIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="What did you spend on?"
                  required
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="offline-amount" className="block text-sm font-medium mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSignIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <MoneyInput
                  id="offline-amount"
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: value })}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              {/* dd/mm/yyyy everywhere — a native date input renders in the
                  browser's locale, not the app's. The picker carries its own
                  calendar glyph, so the decorative leading one goes. */}
              <DatePicker
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
                className="border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                aria-label="Transaction date"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <AccountSelector
                accounts={accounts}
                selectedAccountId={formData.accountId}
                onAccountChange={(accountId) => setFormData({ ...formData, accountId })}
                placeholder="Search or select an account…"
                formatLabel={(account) => `${account.name} (${formatCurrency(account.balance, account.currency)})`}
                className="w-full px-3 py-2 h-[42px] border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                usePortal
                required
                ariaLabel="Account"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 justify-center py-2 px-4 bg-[#1a2332] text-white rounded-lg font-medium hover:bg-[#2d3a4d] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Queuing...' : 'Add Transaction'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
