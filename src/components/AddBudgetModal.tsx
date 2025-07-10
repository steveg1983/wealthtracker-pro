import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddBudgetModal({ isOpen, onClose }: AddBudgetModalProps) {
  const { addBudget, budgets } = useApp();
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'weekly' | 'yearly',
    isActive: true,
  });

  const categories = [
    'Food & Dining',
    'Shopping',
    'Transport',
    'Bills',
    'Entertainment',
    'Healthcare',
    'Education',
    'Travel',
    'Personal Care',
    'Gifts',
    'Insurance',
    'Savings',
    'Other',
  ];

  // Filter out categories that already have budgets
  const availableCategories = categories.filter(
    cat => !budgets.find(b => b.category === cat && b.isActive)
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addBudget({
      ...formData,
      amount: parseFloat(formData.amount),
    });
    onClose();
    // Reset form
    setFormData({
      category: '',
      amount: '',
      period: 'monthly',
      isActive: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Set Budget</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
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
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {availableCategories.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  All categories have budgets. Edit existing ones instead.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  £
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Start with essential categories like Food & Dining, 
                Transport, and Bills. You can always add more budgets later.
              </p>
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
              disabled={availableCategories.length === 0}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Set Budget
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
