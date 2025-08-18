import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { getCurrencySymbol } from '../utils/currency';
import { XIcon } from './icons';

interface QuickTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'expense' | 'income' | 'transfer';
}

/**
 * Quick Transaction Form - Minimal UI for fastest possible entry
 * Design principle: Get the transaction in with minimum friction
 */
export function QuickTransactionForm({ 
  isOpen, 
  onClose, 
  initialType = 'expense' 
}: QuickTransactionFormProps): React.JSX.Element | null {
  const { accounts, addTransaction, categories } = useApp();
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  
  // Focus on amount field when opened
  useEffect(() => {
    if (isOpen && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  // Reset form on type change
  useEffect(() => {
    setType(initialType);
  }, [initialType]);
  
  // Filter categories based on type
  const filteredCategories = categories.filter(cat => 
    cat.type === (type === 'transfer' ? 'expense' : type) && !cat.parentId
  );
  
  // Set default category
  useEffect(() => {
    if (filteredCategories.length > 0 && !categoryId) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !description) {
      showError('Please enter amount and description');
      return;
    }
    
    if (!accountId) {
      showError('Please select an account');
      return;
    }
    
    if (type === 'transfer' && !toAccountId) {
      showError('Please select a destination account');
      return;
    }
    
    try {
      const transactionData: any = {
        amount: parseFloat(amount),
        description,
        type,
        accountId,
        category: categoryId,
        date: new Date(),
      };
      
      // Add toAccountId for transfers
      if (type === 'transfer' && toAccountId) {
        transactionData.toAccountId = toAccountId;
      }
      
      addTransaction(transactionData);
      
      showSuccess(`${type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer'} added quickly!`);
      
      // Reset form
      setAmount('');
      setDescription('');
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add transaction');
    }
  };
  
  // Keyboard shortcuts within form
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSubmit(e);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Quick Form */}
      <div 
        className="relative bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl transform transition-transform duration-300"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick {type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <XIcon size={20} />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Amount Field - Most Important */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                {getCurrencySymbol('USD')}
              </span>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-3 text-lg font-medium bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          
          {/* Description Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="What's this for?"
              required
            />
          </div>
          
          {/* Quick Select Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* From Account */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {type === 'transfer' ? 'From Account' : 'Account'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-2 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Category or To Account */}
            <div>
              {type === 'transfer' ? (
                <>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    To Account
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    {accounts.filter(a => a.id !== accountId).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required={type !== 'transfer'}
                  >
                    {filteredCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          
          {/* Type Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                type === 'expense' 
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                type === 'income' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                type === 'transfer' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              Transfer
            </button>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-primary hover:bg-secondary text-white font-medium rounded-lg transition-colors"
          >
            Add {type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer'} (⌘↵)
          </button>
        </form>
        
        {/* Quick Tips */}
        <div className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400">
          Tip: Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to cancel or <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">⌘↵</kbd> to save
        </div>
      </div>
    </div>
  );
}