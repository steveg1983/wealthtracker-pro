import { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { CalendarIcon, TagIcon } from './icons';
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
  const [category, setCategory] = useState('cat-blank');
  const [subCategory, setSubCategory] = useState('sub-other-expense');
  const [description, setDescription] = useState('Balance Adjustment');
  const [notes, setNotes] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  if (!account) return null;

  const newBalanceNum = parseFloat(newBalance) || 0;
  const difference = newBalanceNum - currentBalance;
  const isIncrease = difference > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (Math.abs(difference) < 0.01) {
      onClose();
      return;
    }

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

  const transactionType = isIncrease ? 'income' : 'expense';
  const availableSubCategories = getSubCategories(`type-${transactionType}`);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Balance Adjustment Required" size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Changing the balance requires creating a transaction to maintain accurate records.
                This adjustment will be recorded in your transaction history.
              </p>
            </div>

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
              <label htmlFor="adjustment-date" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon size={16} />
                Date
              </label>
              <input
                id="adjustment-date"
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="adjustment-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                id="adjustment-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                required
              />
            </div>

            {/* Category Selection */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="adjustment-category" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <TagIcon size={16} />
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
                  id="adjustment-category"
                  value={subCategory}
                  onChange={(e) => {
                    setSubCategory(e.target.value);
                    setCategory('');
                  }}
                  className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                >
                  <option value="">Select category</option>
                  {availableSubCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {subCategory && (
                <div>
                  <label htmlFor="adjustment-subcategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sub-category
                  </label>
                  <select
                    id="adjustment-subcategory"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
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
              <label htmlFor="adjustment-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                id="adjustment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this adjustment..."
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              />
            </div>
          </ModalBody>

          <ModalFooter>
            <div className="flex gap-3 w-full">
              <button
                type="submit"
                className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
              >
                Create Adjustment
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

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
    </>
  );
}
