import { useState, useEffect, useMemo } from 'react';
import { XIcon } from './icons/XIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { SearchIcon } from './icons/SearchIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

interface CategoryTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

type TransactionFilter = 'all' | 'income' | 'expense';

export default function CategoryTransactionsModal({ 
  isOpen, 
  onClose, 
  categoryId,
  categoryName 
}: CategoryTransactionsModalProps) {
  const { transactions, accounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  // Filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
  
  // Get all transactions for this category
  const categoryTransactions = useMemo(() => {
    return transactions.filter(t => t.category === categoryId);
  }, [transactions, categoryId]);
  
  // Apply filters
  const filteredTransactions = useMemo(() => {
    let filtered = categoryTransactions;
    
    // Transaction type filtering
    if (transactionFilter === 'income') {
      filtered = filtered.filter(t => 
        t.type === 'income' || (t.type === 'transfer' && t.amount > 0)
      );
    } else if (transactionFilter === 'expense') {
      filtered = filtered.filter(t => 
        t.type === 'expense' || (t.type === 'transfer' && t.amount < 0)
      );
    }
    
    // Date filtering
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => new Date(t.date) >= from);
    }
    
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= to);
    }
    
    // Search filtering - Enhanced search with multiple field support
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/); // Split by whitespace for multi-word search
      
      filtered = filtered.filter(t => {
        const account = accounts.find(a => a.id === t.accountId);
        
        // First check description directly for better performance
        const descriptionLower = t.description.toLowerCase();
        if (queryWords.every(word => descriptionLower.includes(word))) {
          return true;
        }
        
        // If not found in description, check all fields
        const searchableFields = [
          t.description,
          t.amount.toString(),
          Math.abs(t.amount).toString(),
          formatCurrency(Math.abs(t.amount)),
          account?.name || '',
          account?.institution || '',
          t.type,
          t.categoryName || categoryName,
          new Date(t.date).toLocaleDateString(),
          new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          t.notes || '',
          t.tags?.join(' ') || ''
        ];
        
        // Join and search
        const searchableText = searchableFields.join(' ').toLowerCase();
        
        // Check if ALL query words are found (AND search)
        return queryWords.every(word => searchableText.includes(word));
      });
    }
    
    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [categoryTransactions, fromDate, toDate, debouncedSearchQuery, transactionFilter, accounts, formatCurrency, categoryName]);
  
  // Debounce search query for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150); // Reduced to 150ms for faster response
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Calculate totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    
    filteredTransactions.forEach(t => {
      if (t.type === 'income' || (t.type === 'transfer' && t.amount > 0)) {
        income += t.amount;
      } else if (t.type === 'expense' || (t.type === 'transfer' && t.amount < 0)) {
        expense += Math.abs(t.amount);
      }
    });
      
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);
  
  // Set initial date range to show all transactions
  useEffect(() => {
    if (isOpen && categoryTransactions.length > 0) {
      // Find earliest and latest transaction dates
      const dates = categoryTransactions.map(t => new Date(t.date).getTime());
      const earliestDate = new Date(Math.min(...dates));
      const latestDate = new Date(Math.max(...dates));
      
      // Only set if not already set
      if (!fromDate) {
        setFromDate(earliestDate.toISOString().split('T')[0]);
      }
      if (!toDate) {
        setToDate(latestDate.toISOString().split('T')[0]);
      }
    }
  }, [isOpen, categoryTransactions, fromDate, toDate]);
  
  // Reset filters when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setTransactionFilter('all');
      setFromDate('');
      setToDate('');
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Transactions in "{categoryName}"
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {categoryTransactions.length} total transactions
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 -m-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Transaction Type Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTransactionFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                transactionFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setTransactionFilter('income')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                transactionFilter === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Income
            </button>
            <button
              onClick={() => setTransactionFilter('expense')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                transactionFilter === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Outgoings
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {/* Date Range */}
            <div className="flex flex-wrap gap-2 items-center">
              <CalendarIcon className="text-gray-400 hidden sm:block" size={18} />
              <div className="flex flex-wrap gap-2 items-center flex-1">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 min-w-[130px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                />
                <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 min-w-[130px] px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Clear search"
                >
                  <XCircleIcon size={18} />
                </button>
              )}
            </div>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {categoryName.toLowerCase().includes('transfer') ? 'Money In:' : 'Income:'}
              </span>
              <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                {formatCurrency(totals.income)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                {categoryName.toLowerCase().includes('transfer') ? 'Money Out:' : 'Expense:'}
              </span>
              <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                {formatCurrency(totals.expense)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Net:</span>
              <span className={`ml-2 font-medium ${
                categoryName.toLowerCase().includes('transfer') && Math.abs(totals.net) < 0.01 
                  ? 'text-green-600 dark:text-green-400' 
                  : totals.net >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(totals.net)}
                {categoryName.toLowerCase().includes('transfer') && Math.abs(totals.net) < 0.01 && ' ✓'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                {searchQuery ? `No transactions matching "${searchQuery}"` : 
                 fromDate || toDate || transactionFilter !== 'all' ? 'No matching transactions found' : 
                 'No transactions in this category'}
              </p>
              {searchQuery && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Try searching for partial words, amounts, or account names
                </p>
              )}
              {(fromDate || toDate || transactionFilter !== 'all') && !searchQuery && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Try adjusting your filters or date range
                </p>
              )}
            </div>
          ) : (
            <>
              {searchQuery && (
                <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                  Found {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} matching "{searchQuery}"
                </div>
              )}
            <div className="space-y-2">
              {filteredTransactions.map(transaction => {
                const account = accounts.find(a => a.id === transaction.accountId);
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {new Date(transaction.date).toLocaleDateString()} • {account?.name || 'Unknown Account'}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className={`font-medium ${
                            transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0)
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {transaction.amount >= 0 ? '+' : '-'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {transaction.type === 'transfer' ? `transfer (${transaction.amount > 0 ? 'in' : 'out'})` : transaction.type}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredTransactions.length} of {categoryTransactions.length} transactions
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}