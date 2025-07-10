import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedAccountId?: string;
}

export default function AddTransactionModal({ isOpen, onClose, preSelectedAccountId }: AddTransactionModalProps) {
  const { accounts, addTransaction } = useApp();
  const [formData, setFormData] = useState({
    accountId: preSelectedAccountId || '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category: '',
  });

  if (!isOpen) return null;

  const categories = {
    income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Refund', 'Other'],
    expense: ['Food & Dining', 'Shopping', 'Transport', 'Bills', 'Entertainment', 'Healthcare', 'Education', 'Other'],
    transfer: ['Transfer'],
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTransaction({
      ...formData,
      date: new Date(formData.date),
      amount: parseFloat(formData.amount),
    });
    onClose();
    // Reset form
    setFormData({
      accountId: preSelectedAccountId || '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'expense',
      category: '',
    });
  };

  const selectedAccount = accounts.find(a => a.id === formData.accountId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Transaction</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['income', 'expense', 'transfer'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type, category: '' })}
                    className={`px-3 py-2 rounded-lg border transition-colors ${
                      formData.type === type
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency === 'GBP' ? '£' : account.currency}{account.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Grocery shopping"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">Select category</option>
                {categories[formData.type].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {selectedAccount?.currency === 'GBP' ? '£' : selectedAccount?.currency || '£'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              {formData.type === 'income' && (
                <p className="text-sm text-green-600 mt-1">
                  This will add {selectedAccount?.currency === 'GBP' ? '£' : selectedAccount?.currency || '£'}{formData.amount || '0'} to your account
                </p>
              )}
              {formData.type === 'expense' && (
                <p className="text-sm text-red-600 mt-1">
                  This will subtract {selectedAccount?.currency === 'GBP' ? '£' : selectedAccount?.currency || '£'}{formData.amount || '0'} from your account
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.accountId || !formData.amount}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
