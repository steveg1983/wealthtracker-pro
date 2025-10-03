import React, { useState, useEffect } from 'react';
import { 
  ScissorsIcon as Scissors,
  PlusIcon as Plus,
  DeleteIcon as Trash2,
  CalculatorIcon as Calculator,
  CheckIcon as Check,
  AlertCircleIcon as AlertCircle,
  DollarSignIcon as DollarSign,
  TagIcon as Tag
} from './icons';
import { Transaction } from '../types';
import { useApp } from '../contexts/AppContextSupabase';
import { formatCurrency } from '../utils/formatters';

export interface SplitItem {
  id: string;
  amount: string;
  category: string;
  description: string;
  percentage?: number;
}

interface SplitTransactionProps {
  transaction: Transaction;
  onSave: (splits: SplitItem[]) => void;
  onCancel: () => void;
}

export default function SplitTransaction({ 
  transaction, 
  onSave, 
  onCancel 
}: SplitTransactionProps): React.JSX.Element {
  const { categories } = useApp();
  const totalAmount = Math.abs(parseFloat(transaction.amount));
  
  const [splits, setSplits] = useState<SplitItem[]>([
    {
      id: '1',
      amount: (totalAmount / 2).toFixed(2),
      category: transaction.category,
      description: transaction.description,
      percentage: 50
    },
    {
      id: '2',
      amount: (totalAmount / 2).toFixed(2),
      category: 'Uncategorized',
      description: '',
      percentage: 50
    }
  ]);
  
  const [splitMode, setSplitMode] = useState<'amount' | 'percentage'>('amount');
  const [autoBalance, setAutoBalance] = useState(true);

  // Calculate total and remaining
  const splitTotal = splits.reduce((sum, split) => sum + parseFloat(split.amount || '0'), 0);
  const remaining = totalAmount - splitTotal;
  const isBalanced = Math.abs(remaining) < 0.01;

  // Update percentages when amounts change
  useEffect(() => {
    if (splitMode === 'amount' && totalAmount > 0) {
      setSplits(prev => prev.map(split => ({
        ...split,
        percentage: (parseFloat(split.amount || '0') / totalAmount) * 100
      })));
    }
  }, [splits.map(s => s.amount).join(','), totalAmount, splitMode]);

  const addSplit = () => {
    const newSplit: SplitItem = {
      id: Date.now().toString(),
      amount: remaining > 0 ? remaining.toFixed(2) : '0.00',
      category: 'Uncategorized',
      description: '',
      percentage: remaining > 0 ? (remaining / totalAmount) * 100 : 0
    };
    setSplits([...splits, newSplit]);
  };

  const removeSplit = (id: string) => {
    if (splits.length <= 2) return; // Minimum 2 splits
    
    const newSplits = splits.filter(s => s.id !== id);
    
    // Auto-balance if enabled
    if (autoBalance && newSplits.length > 0) {
      const removedAmount = parseFloat(splits.find(s => s.id === id)?.amount || '0');
      const distribution = removedAmount / newSplits.length;
      
      setSplits(newSplits.map(split => ({
        ...split,
        amount: (parseFloat(split.amount) + distribution).toFixed(2)
      })));
    } else {
      setSplits(newSplits);
    }
  };

  const updateSplit = (id: string, field: keyof SplitItem, value: string | number) => {
    setSplits(prev => {
      const newSplits = prev.map(split => {
        if (split.id === id) {
          const updated = { ...split, [field]: value };
          
          // Handle percentage mode
          if (field === 'percentage' && splitMode === 'percentage') {
            const percentage = parseFloat(value as string) || 0;
            updated.amount = ((percentage / 100) * totalAmount).toFixed(2);
            updated.percentage = percentage;
          }
          
          // Handle amount mode
          if (field === 'amount' && splitMode === 'amount') {
            const amount = parseFloat(value as string) || 0;
            updated.percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
          }
          
          return updated;
        }
        return split;
      });

      // Auto-balance if enabled and we're not at the limit
      if (autoBalance && field === 'amount' && splitMode === 'amount') {
        const changedSplit = newSplits.find(s => s.id === id);
        const changedAmount = parseFloat(changedSplit?.amount || '0');
        const otherSplits = newSplits.filter(s => s.id !== id);
        const remainingAmount = totalAmount - changedAmount;
        
        if (otherSplits.length > 0 && remainingAmount >= 0) {
          const distributionPerSplit = remainingAmount / otherSplits.length;
          
          return newSplits.map(split => {
            if (split.id === id) return split;
            return {
              ...split,
              amount: distributionPerSplit.toFixed(2),
              percentage: (distributionPerSplit / totalAmount) * 100
            };
          });
        }
      }

      return newSplits;
    });
  };

  const autoDistribute = () => {
    const equalAmount = (totalAmount / splits.length).toFixed(2);
    const equalPercentage = 100 / splits.length;
    
    // Handle rounding difference
    const lastAmount = (totalAmount - (parseFloat(equalAmount) * (splits.length - 1))).toFixed(2);
    
    setSplits(prev => prev.map((split, index) => ({
      ...split,
      amount: index === splits.length - 1 ? lastAmount : equalAmount,
      percentage: equalPercentage
    })));
  };

  const distributeByPercentage = (percentages: number[]) => {
    if (percentages.length !== splits.length) return;
    
    setSplits(prev => prev.map((split, index) => ({
      ...split,
      percentage: percentages[index],
      amount: ((percentages[index] / 100) * totalAmount).toFixed(2)
    })));
  };

  const handleSave = () => {
    if (!isBalanced) {
      if (!confirm(`The split amounts don't match the original transaction amount. Continue anyway?`)) {
        return;
      }
    }
    
    onSave(splits);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Scissors size={24} />
              <div>
                <h2 className="text-xl font-bold">Split Transaction</h2>
                <p className="text-sm opacity-90">
                  Original: {transaction.description} • {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Split Mode Toggle */}
              <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setSplitMode('amount')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    splitMode === 'amount'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Amount
                </button>
                <button
                  onClick={() => setSplitMode('percentage')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    splitMode === 'percentage'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Percentage
                </button>
              </div>

              {/* Auto Balance Toggle */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoBalance}
                  onChange={(e) => setAutoBalance(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">Auto-balance</span>
              </label>

              {/* Quick Actions */}
              <button
                onClick={autoDistribute}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Distribute Equally
              </button>
            </div>

            {/* Balance Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
              isBalanced 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {isBalanced ? <Check size={16} /> : <AlertCircle size={16} />}
              <span className="text-sm font-medium">
                {isBalanced 
                  ? 'Balanced' 
                  : `${remaining > 0 ? 'Under' : 'Over'} by ${formatCurrency(Math.abs(remaining))}`}
              </span>
            </div>
          </div>
        </div>

        {/* Split Items */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          <div className="space-y-3">
            {splits.map((split, index) => (
              <div
                key={split.id}
                className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Amount/Percentage */}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {splitMode === 'amount' ? 'Amount' : 'Percentage'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          {splitMode === 'amount' ? '$' : '%'}
                        </span>
                        <input
                          type="number"
                          value={splitMode === 'amount' ? split.amount : split.percentage?.toFixed(2)}
                          onChange={(e) => updateSplit(
                            split.id, 
                            splitMode === 'amount' ? 'amount' : 'percentage',
                            e.target.value
                          )}
                          step={splitMode === 'amount' ? '0.01' : '1'}
                          min="0"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                        />
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Category
                      </label>
                      <select
                        value={split.category}
                        onChange={(e) => updateSplit(split.id, 'category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                      >
                        <option value="Uncategorized">Uncategorized</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={split.description}
                        onChange={(e) => updateSplit(split.id, 'description', e.target.value)}
                        placeholder="Optional description"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeSplit(split.id)}
                    disabled={splits.length <= 2}
                    className={`p-2 rounded-lg transition-colors ${
                      splits.length > 2
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Display complementary value */}
                {splitMode === 'amount' && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {split.percentage?.toFixed(1)}% of total
                  </div>
                )}
                {splitMode === 'percentage' && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    = {formatCurrency(parseFloat(split.amount))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Split Button */}
          <button
            onClick={addSplit}
            className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Add Another Split
          </button>

          {/* Quick Split Templates */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
              Quick Split Templates:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => distributeByPercentage([50, 50])}
                disabled={splits.length !== 2}
                className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                50/50
              </button>
              <button
                onClick={() => distributeByPercentage([60, 40])}
                disabled={splits.length !== 2}
                className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                60/40
              </button>
              <button
                onClick={() => distributeByPercentage([70, 30])}
                disabled={splits.length !== 2}
                className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                70/30
              </button>
              <button
                onClick={() => distributeByPercentage([33.33, 33.33, 33.34])}
                disabled={splits.length !== 3}
                className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                Thirds
              </button>
              <button
                onClick={() => distributeByPercentage([25, 25, 25, 25])}
                disabled={splits.length !== 4}
                className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                Quarters
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span>Total: {formatCurrency(totalAmount)}</span>
              <span className="mx-2">•</span>
              <span>Split Total: {formatCurrency(splitTotal)}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Check size={20} />
                Save Split
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
