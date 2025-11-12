import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { ChevronRightIcon, ChevronLeftIcon, ArrowLeftIcon, EditIcon, PlusIcon, DeleteIcon, XIcon, CheckCircleIcon, Building2Icon, CreditCardIcon, CircleDotIcon } from '../components/icons';
import { preserveDemoParam } from '../utils/navigation';
import { IconButton } from '../components/icons/IconButton';
import HelpTooltip from '../components/HelpTooltip';
import EditTransactionModal from '../components/EditTransactionModal';
import CategorySelect from '../components/CategorySelect';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReconciliation } from '../hooks/useReconciliation';
import type { Transaction } from '../types';

// Bank transactions are now imported from shared utility

export default function Reconciliation() {
  const { transactions, accounts, updateTransaction, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(
    searchParams.get('account') || null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(20);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [editingFields, setEditingFields] = useState<Record<string, Partial<Transaction>>>({});
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [splitItems, setSplitItems] = useState<Array<{id: string, description: string, category: string, amount: number}>>([]);
  
  // Quick filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Use shared reconciliation hook
  const { 
    reconciliationDetails: accountSummaries, 
    totalUnreconciledCount, 
    getUnreconciledCount 
  } = useReconciliation(accounts, transactions);

  // Get uncleared transactions for selected account with filters
  const unclearedTransactions = useMemo(() => {
    let filtered = selectedAccount 
      ? transactions.filter(t => t.accountId === selectedAccount && !t.cleared)
      : [];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query) ||
        t.merchant?.toLowerCase().includes(query)
      );
    }
    
    // Apply date filters
    if (dateFrom) {
      filtered = filtered.filter(t => {
        const transDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
        return transDate >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(t => {
        const transDate = typeof t.date === 'string' ? t.date : t.date.toISOString().split('T')[0];
        return transDate <= dateTo;
      });
    }
    
    // Apply amount filters
    if (amountMin) {
      const min = parseFloat(amountMin);
      filtered = filtered.filter(t => Math.abs(t.amount) >= min);
    }
    if (amountMax) {
      const max = parseFloat(amountMax);
      filtered = filtered.filter(t => Math.abs(t.amount) <= max);
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    return filtered;
  }, [selectedAccount, transactions, searchQuery, dateFrom, dateTo, amountMin, amountMax, selectedCategory]);
    
  // Pagination
  const totalPages = Math.ceil(unclearedTransactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const paginatedTransactions = unclearedTransactions.slice(startIndex, endIndex);

  // Reset page when account changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedTransactions(new Set());
    // Clear filters when changing accounts
    clearFilters();
  }, [selectedAccount]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSelectedCategory('');
  };

  // Handle marking transaction as cleared/reconciled
  const handleReconcile = (transactionId: string): void => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    // Apply any pending edits first
    const edits = editingFields[transactionId];
    const updatedTransaction = edits ? { ...transaction, ...edits } : transaction;

    // Update the transaction to mark it as cleared
    updateTransaction(transaction.id, {
      ...updatedTransaction,
      cleared: true
    });

    // Remove from selected and editing fields
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      newSet.delete(transactionId);
      return newSet;
    });
    setEditingFields(prev => {
      const newFields = { ...prev };
      delete newFields[transactionId];
      return newFields;
    });
  };

  // Handle marking multiple transactions as reconciled
  const handleReconcileSelected = (): void => {
    selectedTransactions.forEach(transactionId => {
      handleReconcile(transactionId);
    });
  };

  // Handle editing transaction
  const handleEdit = (transaction: Transaction): void => {
    setEditingTransaction(transaction);
    setShowEditModal(true);
  };

  // Toggle transaction selection
  const toggleTransactionSelection = (transactionId: string): void => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  // Select/deselect all visible transactions
  const toggleSelectAll = (): void => {
    const visibleTransactionIds = paginatedTransactions.map(t => t.id);
    if (visibleTransactionIds.every(id => selectedTransactions.has(id))) {
      // Deselect all visible
      setSelectedTransactions(prev => {
        const newSet = new Set(prev);
        visibleTransactionIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all visible
      setSelectedTransactions(prev => {
        const newSet = new Set(prev);
        visibleTransactionIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  // Handle inline field editing
  const handleFieldEdit = (transactionId: string, field: keyof Transaction, value: Transaction[keyof Transaction]): void => {
    setEditingFields(prev => ({
      ...prev,
      [transactionId]: {
        ...prev[transactionId],
        [field]: value
      }
    }));
  };

  // Save inline edits
  const saveInlineEdits = (transactionId: string): void => {
    const transaction = transactions.find(t => t.id === transactionId);
    const edits = editingFields[transactionId];
    if (!transaction || !edits) return;

    updateTransaction(transaction.id, {
      ...transaction,
      ...edits
    });

    // Clear editing fields for this transaction
    setEditingFields(prev => {
      const newFields = { ...prev };
      delete newFields[transactionId];
      return newFields;
    });
  };

  // getCategoryDisplay function removed - it was unused

  // Handle split toggle
  const handleSplitToggle = (transactionId: string): void => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    setSplittingTransaction(transaction);
    
    // Initialize with a single split item for the full amount
    setSplitItems([{
      id: '1',
      description: transaction.description,
      category: transaction.category || '',
      amount: transaction.amount
    }]);
    
    setShowSplitModal(true);
  };

  // Add split item
  const addSplitItem = (): void => {
    const newId = (Math.max(...splitItems.map(item => parseInt(item.id))) + 1).toString();
    setSplitItems([...splitItems, {
      id: newId,
      description: '',
      category: '',
      amount: 0
    }]);
  };

  // Update split item
  const updateSplitItem = (id: string, field: 'description' | 'category' | 'amount', value: string | number): void => {
    setSplitItems(splitItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove split item
  const removeSplitItem = (id: string): void => {
    if (splitItems.length > 1) {
      setSplitItems(splitItems.filter(item => item.id !== id));
    }
  };

  // Validate split amounts
  const validateSplitAmounts = (): boolean => {
    if (!splittingTransaction) return false;
    const total = splitItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0);
    return Math.abs(total - splittingTransaction.amount) < 0.01; // Allow for small rounding differences
  };

  // Save split transaction
  const saveSplitTransaction = (): void => {
    if (!splittingTransaction) return;
    
    if (!validateSplitAmounts()) {
      alert('Split amounts must equal the original transaction amount');
      return;
    }

    // Mark original transaction as split and update its display
    handleFieldEdit(splittingTransaction.id, 'description', 'Various');
    handleFieldEdit(splittingTransaction.id, 'category', 'multiple');
    
    // Save the edits
    saveInlineEdits(splittingTransaction.id);

    // Create new transactions for each split
    splitItems.forEach(() => {
      // Note: newTransaction variable removed as it's not being used
      // The transaction creation logic is commented out and needs to be implemented
      // when addTransaction function is available in the app context
      
      // const newTransaction = {
      //   date: splittingTransaction.date,
      //   description: item.description,
      //   amount: Math.abs(item.amount),
      //   type: item.amount >= 0 ? splittingTransaction.type : (splittingTransaction.type === 'income' ? 'expense' : 'income'),
      //   category: item.category,
      //   accountId: splittingTransaction.accountId,
      //   cleared: false,
      //   isSplit: false,
      //   originalTransactionId: splittingTransaction.id,
      //   notes: `Split from: ${splittingTransaction.description}`
      // };
      
      // Add transaction using the app context (you'll need to add this function)
      // addTransaction(newTransaction);
    });

    // Close modal
    setShowSplitModal(false);
    setSplittingTransaction(null);
    setSplitItems([]);
  };

  // Currency formatting now handled by useCurrencyDecimal hook

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    // Preserve demo mode when clearing search params
    const isDemoMode = new URLSearchParams(location.search).get('demo') === 'true';
    setSearchParams(isDemoMode ? { demo: 'true' } : {});
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId);
    // Preserve demo mode when setting account
    const isDemoMode = new URLSearchParams(location.search).get('demo') === 'true';
    const params: any = { account: accountId };
    if (isDemoMode) params.demo = 'true';
    setSearchParams(params);
  };

  // totalUnreconciledCount now comes from useReconciliation hook

  // Show account summary view if no account is selected
  if (!selectedAccount) {
    return (
      <div>
        <div className="mb-6">
          <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-white">Reconciliation</h1>
              <HelpTooltip
                title="Account Reconciliation"
                content="Match your transactions with bank statements to ensure accuracy. Mark transactions as cleared when they appear on your statement. This helps identify missing or duplicate transactions."
                position="right"
                iconSize={20}
              />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Select an account below to reconcile imported bank transactions
          </p>
        </div>

        {accountSummaries.length === 0 ? (
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-12 text-center">
            <CheckCircleIcon className="mx-auto text-green-500 mb-4" size={48} />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              All caught up!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              All bank transactions have been reconciled across all accounts.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    Reconciliation Summary
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    You have {totalUnreconciledCount} transactions to reconcile across {accountSummaries.length} accounts
                  </p>
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {totalUnreconciledCount}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="grid gap-4">
              {accountSummaries.map(({ account, unreconciledCount, totalToReconcile, lastImportDate }) => (
                <div
                  key={account.id}
                  className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleSelectAccount(account.id)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {account.type === 'credit' ? (
                            <CreditCardIcon className="text-gray-400" size={24} />
                          ) : (
                            <Building2Icon className="text-gray-400" size={24} />
                          )}
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {account.name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {account.institution} • Last import: {formatDate(lastImportDate)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Transactions to reconcile</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{unreconciledCount}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total amount</p>
                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(totalToReconcile)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <ChevronRightIcon size={24} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Show reconciliation view for selected account
  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const unreconciledCount = selectedAccount ? getUnreconciledCount(selectedAccount) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <IconButton
            onClick={handleBackToAccounts}
            icon={<ArrowLeftIcon size={24} />}
            variant="ghost"
            size="md"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          />
          <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
            <h1 className="text-3xl font-bold text-white">
              Reconcile {selectedAccountData?.name}
            </h1>
            <p className="text-sm text-white/80">
              {selectedAccountData?.institution}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {unreconciledCount} items to reconcile
        </div>
      </div>

      {unclearedTransactions.length === 0 ? (
        <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <CheckCircleIcon className="mx-auto text-green-500 mb-4" size={48} />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Account reconciled!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            All transactions for {selectedAccountData?.name} have been reconciled.
          </p>
          <button
            onClick={handleBackToAccounts}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            Back to Accounts
          </button>
        </div>
      ) : (
        <div>
          {/* Quick Filters Bar */}
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Filters</h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-primary hover:text-secondary"
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
            
            {showFilters && (
              <div className="space-y-4">
                {/* Search bar */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                
                {/* Filter row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Date range */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  {/* Amount range */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Min Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amountMin}
                      onChange={(e) => setAmountMin(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Max Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amountMax}
                      onChange={(e) => setAmountMax(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  
                  {/* Category filter */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Clear filters button */}
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-primary hover:text-secondary"
                >
                  {paginatedTransactions.every(t => selectedTransactions.has(t.id)) ? 'Deselect All' : 'Select All'}
                </button>
                {selectedTransactions.size > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTransactions.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={transactionsPerPage}
                  onChange={(e) => {
                    setTransactionsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                {selectedTransactions.size > 0 && (
                  <button
                    onClick={handleReconcileSelected}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                  >
                    <CheckCircleIcon size={18} />
                    Reconcile Selected ({selectedTransactions.size})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
            {paginatedTransactions.map((transaction) => {
              const edits = editingFields[transaction.id] || {};
              const currentDate = edits.date || transaction.date;
              const currentDescription = edits.description !== undefined ? edits.description : transaction.description;
              const currentCategory = edits.category !== undefined ? edits.category : transaction.category;
              const isSplit = edits.isSplit !== undefined ? edits.isSplit : transaction.isSplit;
              
              return (
                <div
                  key={transaction.id}
                  className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="pt-5">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={() => toggleTransactionSelection(transaction.id)}
                        className="rounded text-primary focus:ring-primary"
                      />
                    </div>
                    
                    {/* Transaction Details */}
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      {/* Date */}
                      <div className="col-span-12 md:col-span-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Date</label>
                        <input
                          type="date"
                          value={currentDate instanceof Date ? currentDate.toISOString().split('T')[0] : currentDate}
                          onChange={(e) => handleFieldEdit(transaction.id, 'date', e.target.value)}
                          className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      
                      {/* Description */}
                      <div className="col-span-12 md:col-span-4">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Description</label>
                        <input
                          type="text"
                          value={currentDescription}
                          onChange={(e) => handleFieldEdit(transaction.id, 'description', e.target.value)}
                          className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      
                      {/* Category */}
                      <div className="col-span-12 md:col-span-5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              id={`split-${transaction.id}`}
                              checked={isSplit || false}
                              onChange={() => handleSplitToggle(transaction.id)}
                              className="rounded text-primary focus:ring-primary h-3 w-3"
                            />
                            <label htmlFor={`split-${transaction.id}`} className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                              Split
                            </label>
                          </div>
                        </div>
                        <CategorySelect
                          value={currentCategory || ''}
                          onChange={(value) => handleFieldEdit(transaction.id, 'category', value)}
                          categories={categories}
                          className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={isSplit}
                          showMultiple={isSplit}
                        />
                      </div>
                    </div>
                    
                    {/* Amount and Actions */}
                    <div className="flex flex-col items-end ml-auto">
                      <div className="flex items-center gap-2 mb-2">
                        {edits && Object.keys(edits).length > 0 && (
                          <div className="relative group">
                            <button
                              onClick={() => saveInlineEdits(transaction.id)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <CheckCircleIcon size={18} />
                            </button>
                            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                              Save changes
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="relative group">
                          <button
                            className={`${transaction.isImported ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'} cursor-default`}
                          >
                            <CircleDotIcon size={18} className={transaction.isImported ? 'fill-current' : ''} />
                          </button>
                          {transaction.isImported && (
                            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                              Bank Statement
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="relative group">
                          <IconButton
                            onClick={() => handleEdit(transaction)}
                            icon={<EditIcon size={18} />}
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          />
                          <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                            Advanced edit
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => handleReconcile(transaction.id)}
                            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                          >
                            <CheckCircleIcon size={20} className="font-bold" />
                          </button>
                          <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                            Mark as reconciled
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold whitespace-nowrap text-right ${
                        transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Notes section if exists */}
                  {transaction.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Notes:</span> {transaction.notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {startIndex + 1} to {Math.min(endIndex, unclearedTransactions.length)} of {unclearedTransactions.length} transactions
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
      />

      {/* Split Transaction Modal */}
      {showSplitModal && splittingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Split Transaction</h2>
                <button
                  onClick={() => {
                    setShowSplitModal(false);
                    setSplittingTransaction(null);
                    setSplitItems([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XIcon size={24} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Original amount: {formatCurrency(splittingTransaction.amount)}
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {splitItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateSplitItem(item.id, 'description', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Description"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <CategorySelect
                          value={item.category}
                          onChange={(value) => updateSplitItem(item.id, 'category', value)}
                          categories={categories}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Select category"
                        />
                      </td>
                      <td className="py-2 pl-2">
                        <input
                          type="number"
                          value={item.amount === 0 ? '' : item.amount}
                          onChange={(e) => updateSplitItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => {
                            if (item.amount === 0) {
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => removeSplitItem(item.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          disabled={splitItems.length === 1}
                        >
                          <DeleteIcon size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={addSplitItem}
                className="mt-4 flex items-center gap-2 text-sm text-primary hover:text-secondary"
              >
                <PlusIcon size={16} />
                Add line
              </button>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total allocated: </span>
                    <span className={`font-medium ${validateSplitAmounts() ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {formatCurrency(splitItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0))}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Remaining to allocate: </span>
                    <span className={`font-medium ${
                      Math.abs(splittingTransaction.amount - splitItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0)) < 0.01
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {formatCurrency(splittingTransaction.amount - splitItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0))}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSplitModal(false);
                      setSplittingTransaction(null);
                      setSplitItems([]);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSplitTransaction}
                    disabled={!validateSplitAmounts()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Split
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}