import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ArrowLeftIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, CalendarIcon, BanknoteIcon, FileTextIcon, TagIcon, ArrowRightLeftIcon, XIcon, SettingsIcon, MinimizeIcon, MaximizeIcon } from '../components/icons';
import EditTransactionModal from '../components/EditTransactionModal';
import CategorySelector from '../components/CategorySelector';
import { usePreferences } from '../contexts/PreferencesContext';
import { VirtualizedTable, Column } from '../components/VirtualizedTable';
import type { Transaction } from '../types';

export default function AccountTransactions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { accounts, transactions, categories, deleteTransaction, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { compactView, setCompactView } = usePreferences();
  
  // Find the specific account
  const account = accounts.find(acc => acc.id === accountId);
  
  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount' | 'category' | 'tags'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // State for modals and selection
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmTransaction, setDeleteConfirmTransaction] = useState<Transaction | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  
  // State for quick add form
  const [quickAddForm, setQuickAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    category: '',
    tags: [] as string[],
    notes: ''
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Get account-specific transactions
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    
    
    return transactions
      .filter(t => t.accountId === account.id)
      .filter(t => {
        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        
        // Date range filter
        if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
        if (dateTo && new Date(t.date) > new Date(dateTo)) return false;
        
        // Search filter
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          t.description.toLowerCase().includes(search) ||
          t.amount.toString().includes(search) ||
          (t.category && categories.find(c => c.id === t.category)?.name.toLowerCase().includes(search)) ||
          (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(search))) ||
          (t.notes && t.notes.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        let aValue: string | number | Date = a[sortField as keyof Transaction] as string | number | Date;
        let bValue: string | number | Date = b[sortField as keyof Transaction] as string | number | Date;
        
        if (sortField === 'date') {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          
          // If dates are different, sort by date
          if (dateA !== dateB) {
            aValue = dateA;
            bValue = dateB;
          } else {
            // If dates are the same, sort by type (income first, then transfers, then expenses)
            const typeOrder = { income: 0, transfer: 1, expense: 2 };
            return typeOrder[a.type] - typeOrder[b.type];
          }
        }
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [account, transactions, searchTerm, dateFrom, dateTo, typeFilter, sortField, sortDirection, categories]);
  
  // Calculate running balance
  const transactionsWithBalance = useMemo(() => {
    if (!account) return [];
    
    
    // Sort transactions by date and type for proper balance calculation
    // Within the same date: income first, then transfers, then expenses
    const typeOrder = { income: 0, transfer: 1, expense: 2 };
    const sortedForBalance = [...accountTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      
      // First sort by date
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // If same date, sort by type (income first, then transfers, then expenses)
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    // Start from opening balance or 0
    let runningBalance = account.openingBalance || 0;
    
    // Calculate running balance for each transaction
    const withBalance = sortedForBalance.map((transaction) => {
      // Since amounts are already signed (negative for expenses), just add them
      runningBalance += transaction.amount;
      return { ...transaction, balance: runningBalance };
    });
    
    // Now sort back to the user's requested order, but keep the calculated balances
    const balanceMap = new Map(withBalance.map(t => [t.id, t.balance]));
    
    const result = accountTransactions.map(t => ({
      ...t,
      balance: balanceMap.get(t.id) || 0
    }));
    
    return result;
  }, [account, accountTransactions]);
  
  // Calculate unreconciled total
  const unreconciledTotal = useMemo(() => {
    if (!account) return 0;
    
    return accountTransactions
      .filter(t => !t.cleared)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [account, accountTransactions]);
  
  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedTransactionId) {
        const transaction = transactionsWithBalance.find(t => t.id === selectedTransactionId);
        if (transaction) {
          setDeleteConfirmTransaction(transaction);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransactionId, transactionsWithBalance]);
  
  // Remove auto-scroll - we want to start at the top with oldest transactions

  // Handle scroll isolation
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    let isMouseOverContainer = false;
    
    const handleMouseEnter = () => {
      isMouseOverContainer = true;
    };
    
    const handleMouseLeave = () => {
      isMouseOverContainer = false;
    };
    
    const handleGlobalWheel = (e: WheelEvent) => {
      if (isMouseOverContainer && scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isScrollable = scrollHeight > clientHeight;
        
        if (isScrollable) {
          // Prevent the default page scroll
          e.preventDefault();
          
          // Apply the scroll to our container instead
          const newScrollTop = scrollTop + e.deltaY;
          scrollContainer.scrollTop = Math.max(0, Math.min(newScrollTop, scrollHeight - clientHeight));
        }
      }
    };
    
    // Add mouse enter/leave listeners
    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    
    // Add global wheel listener with passive: false to allow preventDefault
    document.addEventListener('wheel', handleGlobalWheel, { passive: false });
    
    return () => {
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);
  
  // Handle transaction row click
  const handleTransactionClick = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    
    if (selectedTransactionId === transaction.id) {
      // Second click on already selected transaction - open edit modal
      setIsEditModalOpen(true);
    } else {
      // First click - just select the transaction
      setSelectedTransactionId(transaction.id);
    }
  }, [selectedTransactionId]);
  
  
  // Handle quick add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !quickAddForm.description || !quickAddForm.amount || !quickAddForm.category) return;
    
    await addTransaction({
      date: new Date(quickAddForm.date),
      description: quickAddForm.description,
      amount: parseFloat(quickAddForm.amount),
      type: quickAddForm.type,
      category: quickAddForm.category,
      accountId: account.id,
      tags: quickAddForm.tags,
      notes: quickAddForm.notes,
      cleared: false
    });
    
    // Reset form
    setQuickAddForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      tags: [],
      notes: ''
    });
  };
  
  
  const handleDeleteConfirm = () => {
    if (deleteConfirmTransaction) {
      deleteTransaction(deleteConfirmTransaction.id);
      setDeleteConfirmTransaction(null);
    }
  };
  
  // Get category display name
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    
    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    
    return category.name;
  };

  // Define table columns for VirtualizedTable
  const columns: Column<Transaction & { balance: number }>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      width: '120px',
      accessor: (transaction) => (
        <span className="text-gray-900 dark:text-white">
          {new Date(transaction.date).toLocaleDateString('en-GB')}
        </span>
      ),
      sortable: true
    },
    {
      key: 'reconciled',
      header: '✓',
      width: '40px',
      accessor: (transaction) => (
        transaction.cleared ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : null
      ),
      className: 'text-center',
      headerClassName: 'text-center'
    },
    {
      key: 'description',
      header: 'Description',
      width: '300px',
      accessor: (transaction) => (
        <span className="text-gray-900 dark:text-white">
          {transaction.description}
        </span>
      ),
      sortable: true
    },
    {
      key: 'category',
      header: 'Category',
      width: '200px',
      accessor: (transaction) => (
        <span className="text-gray-600 dark:text-gray-400">
          {getCategoryName(transaction.category)}
        </span>
      )
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '200px',
      accessor: (transaction) => (
        <div className="flex flex-wrap gap-1">
          {transaction.tags?.map((tag: string, idx: number) => (
            <span
              key={idx}
              className={`inline-flex items-center px-2 ${compactView ? 'py-0' : 'py-0.5'} rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}
            >
              {tag}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '150px',
      accessor: (transaction) => (
        <span className={`font-medium ${
          transaction.amount > 0
            ? 'text-green-600 dark:text-green-400' 
            : transaction.amount < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {formatCurrency(transaction.amount, account?.currency)}
        </span>
      ),
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true
    },
    {
      key: 'balance',
      header: 'Balance',
      width: '150px',
      accessor: (transaction) => (
        <span className={`font-medium ${
          transaction.balance < 0 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {formatCurrency(transaction.balance, account?.currency)}
        </span>
      ),
      className: 'text-right',
      headerClassName: 'text-right'
    }
  ], [compactView, formatCurrency, account?.currency, getCategoryName]);
  
  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Account not found</p>
        <button
          onClick={() => navigate('/accounts')}
          className="mt-4 text-primary hover:text-secondary"
        >
          Return to Accounts
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeftIcon size={20} />
          Back to Accounts
        </button>
        
        <div className="flex items-start justify-between">
          {/* Account Name and Details Box */}
          <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
            <h1 className="text-3xl font-bold text-white">
              {account.name}
            </h1>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-white/80">
                <span>00-00-00</span>
                <span className="ml-4">00000000</span>
              </div>
              <button
                onClick={() => navigate(`/settings/accounts/${account.id}`)}
                className="p-2 text-white/60 hover:text-white transition-colors"
                title="Account Settings"
              >
                <SettingsIcon size={20} />
              </button>
            </div>
          </div>
          
          {/* Right side boxes - 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Account Balance Box - Top Left */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account Balance</span>
                <span className={`text-xl font-bold ${
                  account.balance >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(account.balance, account.currency)}
                </span>
              </div>
            </div>
            
            {/* Imported Bank Balance Box - Top Right */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Imported Bank Balance</span>
                <span className="text-xl font-bold text-gray-600 dark:text-gray-400">
                  {formatCurrency(0, account.currency)}
                </span>
              </div>
            </div>
            
            {/* Unreconciled Box - Bottom Left */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Unreconciled</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(unreconciledTotal, account.currency)}
                </span>
              </div>
            </div>
            
            {/* Difference Box - Bottom Right */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Difference</span>
                <span className={`text-xl font-bold ${
                  account.balance === 0 
                    ? 'text-gray-900 dark:text-white'
                    : account.balance > 0
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(account.balance - 0, account.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="flex-shrink-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by description, amount, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                />
              </div>
            </div>
            
            {/* Type Filter and Compact View Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter('income')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'income'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setTypeFilter('expense')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'expense'
                      ? 'bg-red-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Expense
                </button>
              </div>
              
              {/* Compact View Toggle */}
              <button
                onClick={() => setCompactView(!compactView)}
                className="flex items-center gap-2 px-3 py-3 sm:py-2 text-sm border-2 border-gray-400 dark:border-gray-500 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-h-[48px] sm:min-h-[auto]"
                title={compactView ? "Expand view" : "Compact view"}
              >
                {compactView ? <MaximizeIcon size={18} /> : <MinimizeIcon size={18} />}
                <span className="hidden sm:inline">{compactView ? 'Expand' : 'Compact'}</span>
              </button>
            </div>
          </div>
          
          {/* Date Range and Additional Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                placeholder="From"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 px-3 py-3 sm:py-2 text-base sm:text-sm bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent dark:text-white min-h-[48px] sm:min-h-[auto]"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                  title="Clear date range"
                >
                  <XIcon size={18} />
                </button>
              )}
            </div>
            <div className="flex-1">
              {/* Space for additional filters */}
            </div>
          </div>
        </div>
      </div>
      
      {/* Transactions Table */}
      <div 
        className="flex-1 min-h-[400px] max-h-[600px] overflow-hidden"
      >
        <VirtualizedTable
          items={transactionsWithBalance}
          columns={columns}
          getItemKey={(transaction) => transaction.id}
          onRowClick={handleTransactionClick}
          rowHeight={compactView ? 48 : 64}
          selectedItems={selectedTransactionId ? new Set([selectedTransactionId]) : new Set()}
          onSort={(column, direction) => {
            if (column === 'date' || column === 'description' || column === 'amount') {
              setSortField(column);
              setSortDirection(direction);
            }
          }}
          sortColumn={sortField}
          sortDirection={sortDirection}
          emptyMessage="No transactions found"
          threshold={50}
          className="virtualized-table bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-[#6B86B3]"
          headerClassName="bg-secondary dark:bg-gray-700 text-white"
          rowClassName={(transaction, index) => {
            const isSelected = selectedTransactionId === transaction.id;
            return isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30 font-semibold' : '';
          }}
        />
      </div>
      
      {/* Quick Add Transaction Form */}
      <div className="flex-shrink-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Add Transaction</h3>
        <form onSubmit={handleQuickAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date and Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <CalendarIcon size={16} />
                Date
              </label>
              <input
                type="date"
                value={quickAddForm.date}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, date: e.target.value })}
                className="w-full px-3 py-2 h-[42px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                required
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <ArrowRightLeftIcon size={16} />
                Type
              </label>
              <div className="flex gap-4 items-center h-[42px]">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="expense"
                    checked={quickAddForm.type === 'expense'}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, type: e.target.value as 'expense' })}
                    className="mr-2"
                  />
                  <span className="text-red-600 dark:text-red-400">Expense</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="income"
                    checked={quickAddForm.type === 'income'}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, type: e.target.value as 'income' })}
                    className="mr-2"
                  />
                  <span className="text-green-600 dark:text-green-400">Income</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="transfer"
                    checked={quickAddForm.type === 'transfer'}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, type: e.target.value as 'transfer' })}
                    className="mr-2"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Transfer</span>
                </label>
              </div>
            </div>
          </div>
          
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <FileTextIcon size={16} />
              Description
            </label>
            <input
              type="text"
              placeholder="Enter transaction description"
              value={quickAddForm.description}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, description: e.target.value })}
              className="w-full px-3 py-2 h-[42px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <TagIcon size={16} />
                Category
              </label>
              <CategorySelector
                selectedCategory={quickAddForm.category}
                onCategoryChange={(categoryId) => setQuickAddForm({ ...quickAddForm, category: categoryId })}
                transactionType={quickAddForm.type}
                placeholder="Select category..."
                allowCreate={false}
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <BanknoteIcon size={16} />
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={quickAddForm.amount}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, amount: e.target.value })}
                className="w-full px-3 py-2 h-[42px] text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-2xl hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <PlusIcon size={18} />
              Add Transaction
            </button>
          </div>
        </form>
      </div>
      
      {/* Edit Modal */}
      {selectedTransaction && (
        <EditTransactionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTransaction(null);
            setSelectedTransactionId(null);
          }}
          transaction={selectedTransaction}
        />
      )}
      
      {/* Delete Confirmation */}
      {deleteConfirmTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Delete Transaction</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{deleteConfirmTransaction.description}"?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmTransaction(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}