import { useState } from "react";
import { useApp } from '../contexts/AppContext';
import type { RecurringTransaction } from '../contexts/AppContext';
import { RepeatIcon } from './icons';
import { Modal, ModalBody } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

interface RecurringTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RecurringTransactionFormData {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
}

export default function RecurringTransactionModal({ isOpen, onClose }: RecurringTransactionModalProps) {
  const { accounts, addTransaction, recurringTransactions = [], addRecurringTransaction, deleteRecurringTransaction } = useApp();
  const [showForm, setShowForm] = useState(false);
  
  const { formData, updateField, handleSubmit, reset } = useModalForm<RecurringTransactionFormData>(
    {
      description: '',
      amount: 0,
      type: 'expense',
      category: '',
      accountId: accounts[0]?.id || '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0]
    },
    {
      onSubmit: (data) => {
        const startDate = new Date(data.startDate);
        const nextDate = new Date(data.startDate);
        
        addRecurringTransaction({
          description: data.description,
          amount: data.amount,
          type: data.type,
          category: data.category,
          accountId: data.accountId,
          frequency: data.frequency,
          interval: 1,
          startDate,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          nextDate,
          isActive: true
        });
        reset();
        setShowForm(false);
      },
      onClose: () => {
        setShowForm(false);
        onClose();
      }
    }
  );


  const processRecurringTransaction = (recurring: RecurringTransaction) => {
    const today = new Date();
    const lastProcessed = recurring.lastProcessed ? new Date(recurring.lastProcessed) : new Date(recurring.startDate);
    
    // Calculate next date based on frequency
    const nextDate = new Date(lastProcessed);
    
    switch (recurring.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    // Process all due transactions
    while (nextDate <= today) {
      if (!recurring.endDate || nextDate <= new Date(recurring.endDate)) {
        addTransaction({
          date: nextDate,
          amount: recurring.amount,
          description: `${recurring.description} (Recurring)`,
          type: recurring.type,
          category: recurring.category,
          accountId: recurring.accountId,
          isRecurring: true
        });
      }
      
      // Move to next occurrence
      switch (recurring.frequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recurring Transactions" size="lg">
      <ModalBody>

        <div className="flex items-center gap-2 mb-4">
          <RepeatIcon size={20} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Manage your recurring transactions</span>
        </div>
        
        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="mb-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
            >
              Add Recurring Transaction
            </button>

            <div className="space-y-3">
              {recurringTransactions?.map((recurring) => (
                <div key={recurring.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {recurring.description}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {recurring.type === 'income' ? '+' : '-'}£{recurring.amount.toFixed(2)} · {recurring.frequency}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Starts: {new Date(recurring.startDate).toLocaleDateString()}
                        {recurring.endDate && ` · Ends: ${new Date(recurring.endDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => processRecurringTransaction(recurring)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Process Now
                      </button>
                      <button
                        onClick={() => deleteRecurringTransaction(recurring.id!)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value as 'income' | 'expense')}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
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
                  onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => updateField('accountId', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => updateField('frequency', e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Add Recurring Transaction
              </button>
            </div>
          </form>
        )}
      </ModalBody>
    </Modal>
  );
}
