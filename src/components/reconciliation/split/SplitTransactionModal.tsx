import React, { useEffect } from 'react';
import { XIcon, PlusIcon, DeleteIcon } from '../../icons';
import CategorySelect from '../../CategorySelect';
import type { Transaction, Category } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface SplitItem {
  id: string;
  description: string;
  category: string;
  amount: number;
}

interface SplitTransactionModalProps {
  show: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  splitItems: SplitItem[];
  onAddItem: () => void;
  onUpdateItem: (id: string, field: 'description' | 'category' | 'amount', value: string | number) => void;
  onRemoveItem: (id: string) => void;
  onSave: () => void;
  categories: Category[];
  formatCurrency: (amount: number) => string;
}

export function SplitTransactionModal({ show,
  onClose,
  transaction,
  splitItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSave,
  categories,
  formatCurrency
 }: SplitTransactionModalProps): React.JSX.Element | null {
  if (!show || !transaction) return null;

  const total = splitItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0);
  const isValid = Math.abs(total - transaction.amount) < 0.01;
  const remaining = transaction.amount - total;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Split Transaction</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Original: {transaction.description} - {formatCurrency(transaction.amount)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {splitItems.map((item, index) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Split Item #{index + 1}
                  </h4>
                  {splitItems.length > 1 && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => onUpdateItem(item.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Item description"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Category
                    </label>
                    <CategorySelect
                      value={item.category}
                      onChange={(value) => onUpdateItem(item.id, 'category', value)}
                      categories={categories}
                      placeholder="Select category"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => onUpdateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button
              onClick={onAddItem}
              className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary flex items-center justify-center gap-2"
            >
              <PlusIcon size={16} />
              Add Split Item
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Original Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Split Total:</span>
              <span className={`font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(total)}
              </span>
            </div>
            {!isValid && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Remaining:</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(remaining)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!isValid}
              className={`px-4 py-2 rounded-lg ${
                isValid
                  ? 'bg-primary text-white hover:bg-secondary'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Save Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}