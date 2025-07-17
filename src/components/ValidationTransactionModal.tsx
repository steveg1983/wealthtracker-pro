import React, { useState } from 'react';
import { Modal } from './common/Modal';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { EditIcon, TrashIcon, CheckIcon, XIcon } from './icons';
import type { Transaction } from '../types';

interface ValidationTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  transactionIds: string[];
  issueType: 'invalid-categories' | 'zero-negative-amounts' | 'large-transactions' | 'other';
  onFixed?: () => void;
}

export default function ValidationTransactionModal({
  isOpen,
  onClose,
  title,
  transactionIds,
  issueType,
  onFixed
}: ValidationTransactionModalProps) {
  const { transactions, accounts, categories, updateTransaction, deleteTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  const affectedTransactions = transactions.filter(t => transactionIds.includes(t.id));
  const validCategories = categories.map(c => c.name);

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditValues({
      [transaction.id]: {
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description
      }
    });
  };

  const handleSave = (transactionId: string) => {
    const values = editValues[transactionId];
    if (values) {
      updateTransaction(transactionId, {
        amount: parseFloat(values.amount) || 0,
        category: values.category,
        description: values.description
      });
    }
    setEditingId(null);
    if (onFixed) onFixed();
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleDelete = (transactionId: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(transactionId);
      if (onFixed) onFixed();
    }
  };

  const getAccount = (accountId: string) => {
    return accounts.find(a => a.id === accountId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="p-6">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {affectedTransactions.length} transaction(s)
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {affectedTransactions.map(transaction => {
            const account = getAccount(transaction.accountId);
            const isEditing = editingId === transaction.id;
            const values = editValues[transaction.id] || {};

            return (
              <div
                key={transaction.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="text-sm text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {account?.name || 'Unknown Account'}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-gray-600 dark:text-gray-400">Description</label>
                          <input
                            type="text"
                            value={values.description || ''}
                            onChange={(e) => setEditValues({
                              ...editValues,
                              [transaction.id]: { ...values, description: e.target.value }
                            })}
                            className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg
                                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={values.amount || ''}
                              onChange={(e) => setEditValues({
                                ...editValues,
                                [transaction.id]: { ...values, amount: e.target.value }
                              })}
                              className={`w-full px-3 py-1 border rounded-lg
                                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                       ${parseFloat(values.amount) <= 0 
                                         ? 'border-red-500' 
                                         : 'border-gray-300 dark:border-gray-600'}`}
                            />
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 dark:text-gray-400">Category</label>
                            <select
                              value={values.category || ''}
                              onChange={(e) => setEditValues({
                                ...editValues,
                                [transaction.id]: { ...values, category: e.target.value }
                              })}
                              className={`w-full px-3 py-1 border rounded-lg
                                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                       ${!validCategories.includes(values.category) && values.category !== ''
                                         ? 'border-red-500' 
                                         : 'border-gray-300 dark:border-gray-600'}`}
                            >
                              <option value="">Select category</option>
                              {validCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {transaction.description || '(No description)'}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`font-medium ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            !transaction.category || !validCategories.includes(transaction.category)
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {transaction.category || 'No category'}
                          </span>
                        </div>

                        {/* Show specific issue indicators */}
                        {issueType === 'zero-negative-amounts' && (
                          <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                            ⚠️ Amount is zero or negative
                          </div>
                        )}
                        {issueType === 'invalid-categories' && (!transaction.category || !validCategories.includes(transaction.category)) && (
                          <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                            ⚠️ Invalid or missing category
                          </div>
                        )}
                        {issueType === 'large-transactions' && (
                          <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                            ℹ️ Unusually large transaction (&gt;10x average)
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSave(transaction.id)}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                          title="Save changes"
                        >
                          <CheckIcon size={20} />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Cancel"
                        >
                          <XIcon size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="Edit transaction"
                        >
                          <EditIcon size={20} />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Delete transaction"
                        >
                          <TrashIcon size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}