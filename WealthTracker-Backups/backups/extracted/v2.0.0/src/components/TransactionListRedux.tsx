import React, { useState, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { deleteTransaction } from '../store/slices/transactionsSlice';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { format } from 'date-fns';
import { 
  EditIcon, 
  DeleteIcon, 
  TagIcon,
  FilterIcon,
  CalendarIcon,
  SearchIcon
} from './icons';
import EditTransactionModal from './EditTransactionModal';
import type { Transaction } from '../types';

/**
 * Redux-based transaction list component
 * Demonstrates direct Redux usage without migration hooks
 */
export function TransactionListRedux() {
  const dispatch = useAppDispatch();
  const { formatCurrency } = useCurrencyDecimal();
  
  // Get data from Redux store
  const transactions = useAppSelector(state => state.transactions.transactions);
  const categories = useAppSelector(state => state.categories.categories);
  const accounts = useAppSelector(state => state.accounts.accounts);
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Search filter
      if (searchTerm && !transaction.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (selectedCategory && transaction.category !== selectedCategory) {
        return false;
      }
      
      // Account filter
      if (selectedAccount && transaction.accountId !== selectedAccount) {
        return false;
      }
      
      // Date range filter
      if (dateRange.start && new Date(transaction.date) < new Date(dateRange.start)) {
        return false;
      }
      if (dateRange.end && new Date(transaction.date) > new Date(dateRange.end)) {
        return false;
      }
      
      return true;
    });
  }, [transactions, searchTerm, selectedCategory, selectedAccount, dateRange]);

  // Sort transactions by date (newest first)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredTransactions]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      dispatch(deleteTransaction(id));
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  return (
    <div className="space-y-6">
      {/* Redux Indicator */}
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <p className="text-sm text-purple-700 dark:text-purple-300">
          <strong>Redux Mode:</strong> This component is using Redux store directly for state management.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <FilterIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account Filter */}
          <div className="relative">
            <FilterIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            Transactions ({sortedTransactions.length})
          </h3>
          
          {sortedTransactions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No transactions found matching your filters.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedTransactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon size={14} />
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </span>
                          <span>{getCategoryName(transaction.category)}</span>
                          <span>{getAccountName(transaction.accountId)}</span>
                          {transaction.tags && transaction.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <TagIcon size={14} />
                              {transaction.tags.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className={`text-lg font-semibold ${
                          transaction.type === 'income' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingTransaction(transaction)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                            title="Edit transaction"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="p-1.5 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            title="Delete transaction"
                          >
                            <DeleteIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          isOpen={!!editingTransaction}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}