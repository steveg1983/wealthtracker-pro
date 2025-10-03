import React, { memo, useState } from 'react';
import { CalendarIcon, ArrowRightLeftIcon, FileTextIcon, TagIcon, BanknoteIcon, PlusIcon } from '../../components/icons';
import CategorySelector from '../../components/CategorySelector';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Account } from '../../types';

interface QuickAddTransactionProps {
  account: Account;
  accounts: Account[];
  onAdd: (data: {
    date: Date;
    description: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    accountId: string;
    category?: string;
    transfer_account_id?: string;
    tags: string[];
    notes: string;
    cleared: boolean;
  }) => Promise<void>;
}

export const QuickAddTransaction = memo(function QuickAddTransaction({
  account,
  accounts,
  onAdd
}: QuickAddTransactionProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category: '',
    tags: [] as string[],
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    if (form.type !== 'transfer' && !form.category) return;

    // Calculate the correct amount based on transaction type
    let amount = parseFloat(form.amount);
    if (form.type === 'expense' || form.type === 'transfer') {
      amount = -Math.abs(amount);
    } else {
      amount = Math.abs(amount);
    }

    // Create the transaction
    const transactionData: {
      date: Date;
      description: string;
      amount: number;
      type: 'income' | 'expense' | 'transfer';
      accountId: string;
      tags: string[];
      notes: string;
      cleared: boolean;
      category?: string;
      transfer_account_id?: string;
    } = {
      date: new Date(form.date),
      description: form.description,
      amount: amount,
      type: form.type,
      accountId: account.id,
      tags: form.tags,
      notes: form.notes,
      cleared: false
    };

    // Add category or transfer_account_id
    if (form.type === 'transfer') {
      transactionData.transfer_account_id = form.category;
    } else {
      transactionData.category = form.category;
    }

    await onAdd(transactionData);

    // For transfers, create opposite transaction
    if (form.type === 'transfer' && form.category) {
      await onAdd({
        date: new Date(form.date),
        description: form.description,
        amount: Math.abs(amount),
        type: 'transfer',
        transfer_account_id: account.id,
        accountId: form.category,
        tags: form.tags,
        notes: form.notes,
        cleared: false
      });
    }

    // Reset form
    setForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      tags: [],
      notes: ''
    });
  };

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 mt-8">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Quick Add Transaction</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date and Type */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <CalendarIcon size={16} />
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-1.5 h-[36px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              required
            />
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <ArrowRightLeftIcon size={16} />
              Type
            </label>
            <div className="flex gap-2 items-center h-[36px]">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="expense"
                  checked={form.type === 'expense'}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'expense' })}
                  className="mr-1"
                />
                <span className="text-red-600 dark:text-red-400 text-sm">Expense</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="income"
                  checked={form.type === 'income'}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'income' })}
                  className="mr-1"
                />
                <span className="text-green-600 dark:text-green-400 text-sm">Income</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="transfer"
                  checked={form.type === 'transfer'}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'transfer' })}
                  className="mr-1"
                />
                <span className="text-gray-700 dark:text-gray-300 text-sm">Transfer</span>
              </label>
            </div>
          </div>
        </div>
        
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <FileTextIcon size={16} />
            Description
          </label>
          <input
            type="text"
            placeholder="Enter transaction description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-1.5 h-[36px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <TagIcon size={16} />
              {form.type === 'transfer' ? 'To Account' : 'Category'}
            </label>
            {form.type === 'transfer' ? (
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-1.5 h-[36px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                required
              >
                <option value="">Select account...</option>
                {accounts
                  .filter(acc => acc.id !== account.id)
                  .map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
              </select>
            ) : (
              <CategorySelector
                selectedCategory={form.category}
                onCategoryChange={(categoryId) => setForm({ ...form, category: categoryId })}
                transactionType={form.type}
                placeholder="Select category..."
                allowCreate={false}
              />
            )}
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <BanknoteIcon size={16} />
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-1.5 h-[36px] text-sm text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              required
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <PlusIcon size={16} />
            Add Transaction
          </button>
        </div>
      </form>
    </div>
  );
});