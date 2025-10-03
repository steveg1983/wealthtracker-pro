import React from 'react';
import { XIcon, CalendarIcon, TagIcon, FileTextIcon, CheckIcon2, LinkIcon, HashIcon, WalletIcon } from './icons';
import MarkdownNote from './MarkdownNote';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import type { Transaction, Account, Category } from '../types';

interface TransactionDetailsViewProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
}

export default function TransactionDetailsView({ 
  isOpen, 
  onClose, 
  transaction, 
  accounts,
  categories 
}: TransactionDetailsViewProps) {
  const { formatCurrency } = useCurrencyDecimal();

  if (!isOpen || !transaction) return null;

  const account = accounts.find(a => a.id === transaction.accountId);
  const category = categories.find(c => c.id === transaction.category);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Transaction Details
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Main Details */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CalendarIcon size={20} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <WalletIcon size={20} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Account</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {account?.name || 'Unknown Account'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description and Amount */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {transaction.description}
              </p>
              <p className={`text-2xl font-bold ${
                transaction.type === 'income' 
                  ? 'text-green-600 dark:text-green-400' 
                  : transaction.type === 'expense'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                {formatCurrency(Math.abs(transaction.amount))}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Type: {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
              </p>
            </div>

            {/* Category */}
            {category && (
              <div className="flex items-start gap-3">
                <TagIcon size={20} className="text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </p>
                </div>
              </div>
            )}

            {/* Tags */}
            {transaction.tags && transaction.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <HashIcon size={20} className="text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {transaction.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes with Markdown */}
            {transaction.notes && (
              <div className="flex items-start gap-3">
                <FileTextIcon size={20} className="text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Notes</p>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <MarkdownNote content={transaction.notes} />
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {transaction.cleared ? (
                  <>
                    <CheckIcon2 size={20} className="text-green-600 dark:text-green-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Transaction reconciled
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Not reconciled
                    </span>
                  </>
                )}
              </div>

              {transaction.reconciledWith && transaction.reconciledWith !== 'manual' && (
                <div className="flex items-center gap-3">
                  <LinkIcon size={20} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Linked to bank statement (ID: {transaction.reconciledWith})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}