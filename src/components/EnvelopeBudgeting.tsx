import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useBudgets } from '../contexts/BudgetContext';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';
import type { DecimalTransaction } from '../types/decimal-types';
import { 
  PlusIcon, 
  ArrowRightIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  PiggyBankIcon,
  DollarSignIcon
} from './icons';

interface Envelope {
  id: string;
  name: string;
  budgetedAmount: DecimalInstance;
  spentAmount: DecimalInstance;
  remainingAmount: DecimalInstance;
  categoryIds: string[];
  color: string;
  isOverspent: boolean;
  fillPercentage: number;
  priority: 'high' | 'medium' | 'low';
}

export default function EnvelopeBudgeting() {
  const { categories, getDecimalTransactions } = useApp();
  const { budgets, addBudget, updateBudget } = useBudgets();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [selectedEnvelope, setSelectedEnvelope] = useState<string | null>(null);
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  
  const [newEnvelope, setNewEnvelope] = useState({
    name: '',
    budgetedAmount: '',
    categoryIds: [] as string[],
    color: '#3B82F6',
    priority: 'medium' as 'high' | 'medium' | 'low'
  });

  const transactions = getDecimalTransactions();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Create envelopes from existing budgets
  const envelopes = useMemo(() => {
    return budgets.map(budget => {
      const budgetedAmount = toDecimal(budget.amount);
      
      // Calculate spending for this budget's category
      const spentAmount = transactions
        .filter((t: DecimalTransaction) => 
          t.type === 'expense' && 
          t.date.toISOString().startsWith(currentMonth) &&
          t.category === budget.categoryId
        )
        .reduce((sum: DecimalInstance, t: DecimalTransaction) => sum.plus(t.amount), toDecimal(0));
      
      const remainingAmount = budgetedAmount.minus(spentAmount);
      const isOverspent = remainingAmount.lessThan(0);
      const fillPercentage = budgetedAmount.greaterThan(0) 
        ? Math.min(spentAmount.dividedBy(budgetedAmount).times(100).toNumber(), 100)
        : 0;

      // Use category name as envelope name
      const categoryName = categories.find(c => c.id === budget.categoryId)?.name || budget.categoryId;

      return {
        id: budget.id,
        name: categoryName,
        budgetedAmount,
        spentAmount,
        remainingAmount,
        categoryIds: [budget.categoryId],
        color: '#3B82F6', // Default color
        isOverspent,
        fillPercentage,
        priority: 'medium' as const
      } as Envelope;
    });
  }, [budgets, transactions, currentMonth, categories]);

  const totalBudgeted = envelopes.reduce((sum: DecimalInstance, env: Envelope) => sum.plus(env.budgetedAmount), toDecimal(0));
  const totalSpent = envelopes.reduce((sum: DecimalInstance, env: Envelope) => sum.plus(env.spentAmount), toDecimal(0));
  const totalRemaining = envelopes.reduce((sum: DecimalInstance, env: Envelope) => sum.plus(env.remainingAmount), toDecimal(0));
  const overbudgetEnvelopes = envelopes.filter((env: Envelope) => env.isOverspent);

  const handleAddEnvelope = () => {
    if (!newEnvelope.name || !newEnvelope.budgetedAmount || newEnvelope.categoryIds.length === 0) return;

    // Create a budget for the first selected category
    const newBudget = {
      category: newEnvelope.categoryIds[0], // Use first category
      amount: parseFloat(newEnvelope.budgetedAmount),
      period: 'monthly' as const,
      isActive: true
    };

    addBudget(newBudget);
    setNewEnvelope({
      name: '',
      budgetedAmount: '',
      categoryIds: [],
      color: '#3B82F6',
      priority: 'medium'
    });
    setShowAddEnvelope(false);
  };

  const handleTransferFunds = () => {
    if (!transferFrom || !transferTo || !transferAmount) return;

    const amount = parseFloat(transferAmount);
    if (amount <= 0) return;

    const fromBudget = budgets.find(b => b.id === transferFrom);
    const toBudget = budgets.find(b => b.id === transferTo);
    
    if (!fromBudget || !toBudget) return;

    // Update budgets
    updateBudget(fromBudget.id, {
      ...fromBudget,
      amount: fromBudget.amount - amount
    });
    
    updateBudget(toBudget.id, {
      ...toBudget,
      amount: toBudget.amount + amount
    });

    // Reset form
    setTransferFrom('');
    setTransferTo('');
    setTransferAmount('');
    setTransferDescription('');
    setShowTransferModal(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Envelope Budgeting</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowRightIcon size={16} />
              Transfer
            </button>
            <button
              onClick={() => setShowAddEnvelope(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              <PlusIcon size={16} />
              Add Envelope
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBankIcon className="text-blue-600" size={20} />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Budgeted</span>
            </div>
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(totalBudgeted)}
            </span>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSignIcon className="text-red-600" size={20} />
              <span className="text-sm font-medium text-red-800 dark:text-red-300">Total Spent</span>
            </div>
            <span className="text-2xl font-bold text-red-900 dark:text-red-100">
              {formatCurrency(totalSpent)}
            </span>
          </div>
          
          <div className={`rounded-lg p-4 ${totalRemaining.greaterThanOrEqualTo(0) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className={`${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-600' : 'text-red-600'}`} size={20} />
              <span className={`text-sm font-medium ${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                Remaining
              </span>
            </div>
            <span className={`text-2xl font-bold ${totalRemaining.greaterThanOrEqualTo(0) ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
              {formatCurrency(totalRemaining)}
            </span>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircleIcon className="text-orange-600" size={20} />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300">Overbudget</span>
            </div>
            <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {overbudgetEnvelopes.length}
            </span>
          </div>
        </div>
      </div>

      {/* Envelopes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {envelopes.map((envelope) => (
          <div
            key={envelope.id}
            className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 cursor-pointer transition-all hover:shadow-xl ${
              selectedEnvelope === envelope.id ? 'ring-2 ring-[var(--color-primary)]' : ''
            }`}
            onClick={() => setSelectedEnvelope(envelope.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: envelope.color }}
                />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{envelope.name}</h3>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(envelope.priority)}`}>
                {envelope.priority}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Spent</span>
                <span>{envelope.fillPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    envelope.isOverspent ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(envelope.fillPercentage, 100)}%`,
                    backgroundColor: envelope.isOverspent ? '#EF4444' : envelope.color
                  }}
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Budgeted:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(envelope.budgetedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Spent:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(envelope.spentAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Remaining:</span>
                <span className={`text-sm font-medium ${
                  envelope.remainingAmount.greaterThanOrEqualTo(0) 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(envelope.remainingAmount)}
                </span>
              </div>
            </div>

            {/* Categories */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">Categories:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {envelope.categoryIds.map(categoryId => {
                  const category = categories.find(c => c.id === categoryId);
                  return category ? (
                    <span
                      key={categoryId}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-700 dark:text-gray-300"
                    >
                      {category.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Envelope Modal */}
      {showAddEnvelope && (
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
                  onChange={(e) => setNewEnvelope({...newEnvelope, name: e.target.value})}
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
                  onChange={(e) => setNewEnvelope({...newEnvelope, budgetedAmount: e.target.value})}
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
                  onChange={(e) => setNewEnvelope({...newEnvelope, priority: e.target.value as 'high' | 'medium' | 'low'})}
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
                  onChange={(e) => setNewEnvelope({...newEnvelope, color: e.target.value})}
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
                            setNewEnvelope({
                              ...newEnvelope,
                              categoryIds: [...newEnvelope.categoryIds, category.id]
                            });
                          } else {
                            setNewEnvelope({
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
                onClick={() => setShowAddEnvelope(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEnvelope}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Add Envelope
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transfer Funds</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Envelope
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select envelope...</option>
                  {envelopes.map(envelope => (
                    <option key={envelope.id} value={envelope.id}>
                      {envelope.name} ({formatCurrency(envelope.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To Envelope
                </label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select envelope...</option>
                  {envelopes.filter(e => e.id !== transferFrom).map(envelope => (
                    <option key={envelope.id} value={envelope.id}>
                      {envelope.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Transfer reason..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferFunds}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
