import React, { useState, useEffect, useMemo } from 'react';
import {
  ScissorsIcon as Scissors,
  PlusIcon as Plus,
  DeleteIcon as Trash2,
  CheckIcon as Check,
  AlertCircleIcon as AlertCircle
} from './icons';
import type { Transaction } from '../types';
import { useApp } from '../contexts/AppContextSupabase';
import { formatCurrency, parseCurrencyDecimal } from '../utils/currency-decimal';
import { formatDecimalFixed, formatPercentageValue, toDecimal, type DecimalInstance } from '@wealthtracker/utils';

const formatAmountString = (value: number | DecimalInstance): string => {
  return toDecimal(value).toDecimalPlaces(2).toString();
};

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
  const totalAmountDecimal = useMemo(
    () => toDecimal(Math.abs(transaction.amount ?? 0)),
    [transaction.amount]
  );
  const [splits, setSplits] = useState<SplitItem[]>([
    {
      id: '1',
      amount: formatAmountString(totalAmountDecimal.dividedBy(2)),
      category: transaction.category,
      description: transaction.description,
      percentage: 50
    },
    {
      id: '2',
      amount: formatAmountString(totalAmountDecimal.dividedBy(2)),
      category: 'Uncategorized',
      description: '',
      percentage: 50
    }
  ]);
  
  const [splitMode, setSplitMode] = useState<'amount' | 'percentage'>('amount');
  const [autoBalance, setAutoBalance] = useState(true);

  // Calculate total and remaining
  const splitTotalDecimal = splits.reduce(
    (sum, split) => sum.plus(parseCurrencyDecimal(split.amount || '0')),
    toDecimal(0)
  );
  const remainingDecimal = totalAmountDecimal.minus(splitTotalDecimal);
  const isBalanced = remainingDecimal.abs().lessThanOrEqualTo(toDecimal(0.01));

  // Memoize the amounts string for dependency tracking
  const amountsKey = useMemo(() => splits.map(s => s.amount).join(','), [splits]);

  // Update percentages when amounts change
  useEffect(() => {
    if (splitMode === 'amount' && totalAmountDecimal.greaterThan(0)) {
      setSplits(prev => prev.map(split => {
        const amountDecimal = parseCurrencyDecimal(split.amount || '0');
        const percentageDecimal = amountDecimal.dividedBy(totalAmountDecimal).times(100);
        return {
          ...split,
          percentage: percentageDecimal.toNumber()
        };
      }));
    }
  }, [amountsKey, totalAmountDecimal, splitMode]);

  const addSplit = () => {
    const balancedAmountDecimal = remainingDecimal.greaterThan(0) ? remainingDecimal : toDecimal(0);
    const newSplit: SplitItem = {
      id: Date.now().toString(),
      amount: formatAmountString(balancedAmountDecimal),
      category: 'Uncategorized',
      description: '',
      percentage: totalAmountDecimal.greaterThan(0)
        ? balancedAmountDecimal.dividedBy(totalAmountDecimal).times(100).toNumber()
        : 0
    };
    setSplits(prev => [...prev, newSplit]);
  };

  const removeSplit = (id: string) => {
    if (splits.length <= 2) return; // Minimum 2 splits
    
    const newSplits = splits.filter(s => s.id !== id);
    
    // Auto-balance if enabled
    if (autoBalance && newSplits.length > 0) {
      const removedAmountDecimal = parseCurrencyDecimal(splits.find(s => s.id === id)?.amount || '0');
      const distributionDecimal = removedAmountDecimal.dividedBy(newSplits.length);
      
      setSplits(newSplits.map(split => {
        const amountDecimal = parseCurrencyDecimal(split.amount).plus(distributionDecimal);
        return {
          ...split,
          amount: formatAmountString(amountDecimal),
          percentage: totalAmountDecimal.greaterThan(0)
            ? amountDecimal.dividedBy(totalAmountDecimal).times(100).toNumber()
            : 0
        };
      }));
    } else {
      setSplits(newSplits);
    }
  };

  const updateSplit = (id: string, field: keyof SplitItem, value: string | number) => {
    setSplits(prev => {
      const newSplits = prev.map(split => {
        if (split.id !== id) {
          return split;
        }

        if (field === 'amount') {
          const amountDecimal = typeof value === 'number'
            ? toDecimal(value)
            : parseCurrencyDecimal((value as string) || '0');
          const safeDecimal = amountDecimal.isFinite() ? amountDecimal : toDecimal(0);
          const normalizedAmount = formatAmountString(safeDecimal);

          const percentageDecimal = totalAmountDecimal.greaterThan(0)
            ? safeDecimal.dividedBy(totalAmountDecimal).times(100)
            : toDecimal(0);

          return {
            ...split,
            amount: normalizedAmount,
            percentage: percentageDecimal.toNumber()
          };
        }

        if (field === 'percentage') {
          const parsedPercentageDecimal = typeof value === 'number'
            ? toDecimal(value)
            : toDecimal((value as string) || '0');
          const safePercentageDecimal = parsedPercentageDecimal.isFinite() ? parsedPercentageDecimal : toDecimal(0);
          const derivedAmountDecimal = totalAmountDecimal.times(safePercentageDecimal).dividedBy(100);

          return {
            ...split,
            amount: formatAmountString(derivedAmountDecimal),
            percentage: safePercentageDecimal.toNumber()
          };
        }

        const textValue = typeof value === 'string' ? value : String(value ?? '');
        return {
          ...split,
          [field]: textValue
        } as SplitItem;
      });

      // Auto-balance if enabled and we're not at the limit
      if (autoBalance && field === 'amount' && splitMode === 'amount') {
        const changedSplit = newSplits.find(s => s.id === id);
        const changedAmountDecimal = parseCurrencyDecimal(changedSplit?.amount || '0');
        const otherSplits = newSplits.filter(s => s.id !== id);
        const remainingAmountDecimal = totalAmountDecimal.minus(changedAmountDecimal);
        
        if (otherSplits.length > 0 && remainingAmountDecimal.greaterThanOrEqualTo(0)) {
          const distributionPerSplitDecimal = remainingAmountDecimal.dividedBy(otherSplits.length);
          
          return newSplits.map(split => {
            if (split.id === id) return split;
            const distributedAmountDecimal = distributionPerSplitDecimal;
            return {
              ...split,
              amount: formatAmountString(distributedAmountDecimal),
              percentage: totalAmountDecimal.greaterThan(0)
                ? distributedAmountDecimal.dividedBy(totalAmountDecimal).times(100).toNumber()
                : 0
            };
          });
        }
      }

      return newSplits;
    });
  };

  const autoDistribute = () => {
    const equalPercentage = 100 / splits.length;
    const equalAmountDecimal = splits.length > 0
      ? totalAmountDecimal.dividedBy(splits.length)
      : toDecimal(0);
    const equalAmountString = formatAmountString(equalAmountDecimal);
    
    // Handle rounding difference
    const lastAmountDecimal = totalAmountDecimal.minus(
      parseCurrencyDecimal(equalAmountString).times(splits.length - 1)
    );
    const lastAmountString = formatAmountString(lastAmountDecimal);
    
    setSplits(prev => prev.map((split, index) => ({
      ...split,
      amount: index === splits.length - 1 ? lastAmountString : equalAmountString,
      percentage: equalPercentage
    })));
  };

  const distributeByPercentage = (percentages: number[]) => {
    if (percentages.length !== splits.length) return;
    
    setSplits(prev => prev.map((split, index) => ({
      ...split,
      percentage: percentages[index] || 0,
      amount: formatAmountString(totalAmountDecimal.times(percentages[index] || 0).dividedBy(100))
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
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Scissors size={24} />
              <div>
                <h2 className="text-xl font-bold">Split Transaction</h2>
                <p className="text-sm opacity-90">
                  Original: {transaction.description} • {formatCurrency(totalAmountDecimal)}
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
                      ? 'bg-gray-500 text-white'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Amount
                </button>
                <button
                  onClick={() => setSplitMode('percentage')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    splitMode === 'percentage'
                      ? 'bg-gray-500 text-white'
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
                  : `${remainingDecimal.greaterThan(0) ? 'Under' : 'Over'} by ${formatCurrency(remainingDecimal.abs())}`}
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
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-500">
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
                          value={
                            splitMode === 'amount'
                              ? split.amount
                              : split.percentage !== undefined
                                ? formatDecimalFixed(split.percentage, 2)
                                : ''
                          }
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
                    {formatPercentageValue(split.percentage ?? 0, 1)} of total
                  </div>
                )}
                {splitMode === 'percentage' && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    = {formatCurrency(parseCurrencyDecimal(split.amount))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Split Button */}
          <button
            onClick={addSplit}
            className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-500 hover:text-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Add Another Split
          </button>

          {/* Quick Split Templates */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-gray-300 mb-3">
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
              <span>Total: {formatCurrency(totalAmountDecimal)}</span>
              <span className="mx-2">•</span>
              <span>Split Total: {formatCurrency(splitTotalDecimal)}</span>
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
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
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
