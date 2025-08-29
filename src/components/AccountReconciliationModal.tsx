import { useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { XIcon, CalendarIcon, BanknoteIcon, CalculatorIcon } from './icons';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import CategoryCreationModal from './CategoryCreationModal';

interface AccountReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

export default function AccountReconciliationModal({ 
  isOpen, 
  onClose, 
  accountId 
}: AccountReconciliationModalProps) {
  const { accounts, transactions, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  const account = accounts.find(a => a.id === accountId);
  
  // Form state
  const [reconciliationDate, setReconciliationDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState('');
  const [category, setCategory] = useState('cat-blank'); // Default to Blank category
  const [subCategory, setSubCategory] = useState('sub-other-expense');
  const [notes, setNotes] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  if (!isOpen || !account) return null;
  
  // Calculate the current balance in our system as of the reconciliation date
  const systemBalance = (() => {
    const reconDate = new Date(reconciliationDate);
    reconDate.setHours(23, 59, 59, 999); // End of day
    
    // Start with opening balance
    let balance = account.openingBalance || 0;
    
    // Add all transactions up to and including the reconciliation date
    const accountTransactions = transactions
      .filter(t => t.accountId === accountId && new Date(t.date) <= reconDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    accountTransactions.forEach(t => {
      if (t.type === 'income' || (t.type === 'transfer' && t.amount > 0)) {
        balance += Math.abs(t.amount);
      } else {
        balance -= Math.abs(t.amount);
      }
    });
    
    return balance;
  })();
  
  const statementBalanceNum = parseFloat(statementBalance) || 0;
  const difference = statementBalanceNum - systemBalance;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Math.abs(difference) < 0.01) {
      // No adjustment needed, just close
      onClose();
      return;
    }
    
    // Create an adjustment transaction
    const adjustmentTransaction = {
      date: new Date(reconciliationDate),
      description: `Balance Adjustment - Account Reconciliation`,
      amount: Math.abs(difference),
      type: difference > 0 ? 'income' as const : 'expense' as const,
      category: category,
      accountId: accountId,
      notes: notes || `Reconciliation adjustment to match statement balance of ${formatCurrency(statementBalanceNum, account.currency)}`,
      cleared: true,
      tags: ['reconciliation', 'adjustment']
    };
    
    addTransaction(adjustmentTransaction);
    onClose();
  };
  
  // Get available sub-categories based on transaction type
  const transactionType = difference > 0 ? 'income' : 'expense';
  const availableSubCategories = getSubCategories(`type-${transactionType}`);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Reconcile {account.name}
            </h2>
            <button
              onClick={onClose}
              className="p-1 -m-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Reconciliation Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon size={16} />
                Statement Date
              </label>
              <input
                type="date"
                value={reconciliationDate}
                onChange={(e) => setReconciliationDate(e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* System Balance */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalculatorIcon size={16} />
                System Balance (as of {new Date(reconciliationDate).toLocaleDateString()})
              </label>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatCurrency(systemBalance, account.currency)}
                </p>
              </div>
            </div>
            
            {/* Statement Balance */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <BanknoteIcon size={16} />
                Statement Balance ({getCurrencySymbol(account.currency)})
              </label>
              <input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="Enter balance from your bank statement"
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            {/* Difference */}
            {statementBalance && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Difference</p>
                <p className={`text-xl font-bold ${
                  Math.abs(difference) < 0.01 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {formatCurrency(difference, account.currency)}
                </p>
                {Math.abs(difference) >= 0.01 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    A {difference > 0 ? 'positive' : 'negative'} adjustment of {formatCurrency(Math.abs(difference), account.currency)} will be added to reconcile.
                  </p>
                )}
              </div>
            )}
            
            {/* Category Selection - Only show if adjustment is needed */}
            {Math.abs(difference) >= 0.01 && (
              <>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category for Adjustment
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
                      className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select category (optional)</option>
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
                        className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
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
                    placeholder="Add any notes about this reconciliation..."
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}
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
              {Math.abs(difference) < 0.01 ? 'Close' : 'Reconcile & Adjust'}
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