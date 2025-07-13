import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { X, Calendar, Tag } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import CategoryCreationModal from './CategoryCreationModal';

interface BalanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  currentBalance: number;
  newBalance: string;
}

export default function BalanceAdjustmentModal({ 
  isOpen, 
  onClose, 
  accountId,
  currentBalance,
  newBalance
}: BalanceAdjustmentModalProps) {
  const { accounts, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  const account = accounts.find(a => a.id === accountId);
  
  // Form state
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('cat-blank'); // Default to Blank category
  const [subCategory, setSubCategory] = useState('sub-other-expense');
  const [description, setDescription] = useState('Balance Adjustment');
  const [notes, setNotes] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  if (!isOpen || !account) return null;
  
  const newBalanceNum = parseFloat(newBalance) || 0;
  const difference = newBalanceNum - currentBalance;
  const isIncrease = difference > 0;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Math.abs(difference) < 0.01) {
      // No adjustment needed
      onClose();
      return;
    }
    
    // Create an adjustment transaction
    const adjustmentTransaction = {
      date: new Date(adjustmentDate),
      description: description,
      amount: Math.abs(difference),
      type: isIncrease ? 'income' as const : 'expense' as const,
      category: category,
      accountId: accountId,
      notes: notes || `Manual balance adjustment from ${formatCurrency(currentBalance, account.currency)} to ${formatCurrency(newBalanceNum, account.currency)}`,
      cleared: true,
      tags: ['balance-adjustment']
    };
    
    addTransaction(adjustmentTransaction);
    onClose();
  };
  
  // Get available sub-categories based on adjustment type
  const transactionType = isIncrease ? 'income' : 'expense';
  const availableSubCategories = getSubCategories(`type-${transactionType}`);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Balance Adjustment Required
            </h2>
            <button
              onClick={onClose}
              className="p-1 -m-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Changing the balance requires creating a transaction to maintain accurate records. 
              This adjustment will be recorded in your transaction history.
            </p>
          </div>
          
          <div className="space-y-4">
            {/* Balance Change Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Current Balance</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(currentBalance, account.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">New Balance</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(newBalanceNum, account.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">Adjustment Amount</p>
                <p className={`text-lg font-bold ${
                  isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {isIncrease ? '+' : '-'}{formatCurrency(Math.abs(difference), account.currency)}
                </p>
              </div>
            </div>
            
            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={16} />
                Date
              </label>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Category Selection */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Tag size={16} />
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="text-sm text-primary hover:text-secondary"
                  >
                    Create new
                  </button>
                </div>
                <select
                  value={subCategory}
                  onChange={(e) => {
                    setSubCategory(e.target.value);
                    setCategory(''); // Reset detail category
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select category</option>
                  {availableSubCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Detail category */}
              {subCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sub-category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                  >
                    <option value="cat-blank">Blank (No category)</option>
                    {getDetailCategories(subCategory).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this adjustment..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-secondary"
            >
              Create Adjustment
            </button>
          </div>
        </form>
        
        {/* Category Creation Modal */}
        <CategoryCreationModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          initialType={transactionType}
          onCategoryCreated={(categoryId) => {
            const createdCategory = categories.find(c => c.id === categoryId);
            if (createdCategory) {
              if (createdCategory.level === 'detail') {
                setSubCategory(createdCategory.parentId || '');
                setCategory(categoryId);
              } else {
                setSubCategory(categoryId);
                setCategory('');
              }
            }
            setShowCategoryModal(false);
          }}
        />
      </div>
    </div>
  );
}