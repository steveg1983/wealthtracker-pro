import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { preserveDemoParam } from '../utils/navigation';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { ArrowLeftIcon, SearchIcon, PlusIcon, CalendarIcon, XIcon, SettingsIcon } from '../components/icons';
import LocalMerchantLogo from '../components/LocalMerchantLogo';
import DatePicker from '../components/common/DatePicker';
import EditTransactionModal from '../components/EditTransactionModal';
import CategorySelector from '../components/CategorySelector';
import { usePreferences } from '../contexts/PreferencesContext';
import { VirtualizedTable, Column } from '../components/VirtualizedTable';
import type { Transaction } from '../types';

type TransactionWithBalance = Transaction & { balance: number };

interface OpeningBalanceRow {
  id: 'opening-balance';
  isOpeningBalance: true;
  date: Date;
  description: string;
  amount: number;
  balance: number;
  type: 'income';
  category: string;
  accountId: string;
  tags: string[];
  cleared: true;
}

type DisplayRow = TransactionWithBalance | OpeningBalanceRow;

function isOpeningBalanceRow(row: DisplayRow): row is OpeningBalanceRow {
  return 'isOpeningBalance' in row && row.isOpeningBalance === true;
}

export default function AccountTransactions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, transactions, categories, deleteTransaction, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { compactView, setCompactView: _setCompactView } = usePreferences();
  
  // Find the specific account
  const account = accounts.find(acc => acc.id === accountId);
  
  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
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
  const [quickAddError, setQuickAddError] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Get account-specific transactions
  const accountTransactions = useMemo<Transaction[]>(() => {
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
  const transactionsWithBalance = useMemo<TransactionWithBalance[]>(() => {
    if (!account) return [] as TransactionWithBalance[];
    
    
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

  // Build display rows with virtual Opening Balance as first entry
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (!account) return [];

    const openingBalance = account.openingBalance ?? 0;

    // Date: use openingBalanceDate, or 1 day before oldest transaction, or today
    let obDate: Date;
    if (account.openingBalanceDate) {
      obDate = new Date(account.openingBalanceDate);
    } else if (transactionsWithBalance.length > 0) {
      const oldest = transactionsWithBalance.reduce((min, t) => {
        const d = new Date(t.date).getTime();
        return d < min ? d : min;
      }, Infinity);
      obDate = new Date(oldest);
      obDate.setDate(obDate.getDate() - 1);
    } else {
      obDate = new Date();
    }

    const openingBalanceRow: OpeningBalanceRow = {
      id: 'opening-balance',
      isOpeningBalance: true,
      date: obDate,
      description: 'Opening Balance',
      amount: openingBalance,
      balance: openingBalance,
      type: 'income',
      category: '',
      accountId: account.id,
      tags: [],
      cleared: true,
    };

    // Respect sort direction — opening balance is always chronologically first
    if (sortField === 'date' && sortDirection === 'desc') {
      return [...transactionsWithBalance, openingBalanceRow];
    }
    return [openingBalanceRow, ...transactionsWithBalance];
  }, [account, transactionsWithBalance, sortField, sortDirection]);

  // Calculate unreconciled total
  const unreconciledTotal = useMemo(() => {
    if (!account) return 0;

    return accountTransactions
      .filter(t => !t.cleared)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [account, accountTransactions]);

  // Compute account balance from transactions (opening balance + sum of all txns)
  const computedAccountBalance = useMemo(() => {
    if (!account) return 0;
    const openingBalance = account.openingBalance ?? 0;
    const txnTotal = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
    return openingBalance + txnTotal;
  }, [account, accountTransactions]);

  // Bank balance from TrueLayer sync (or null if not available)
  const bankBalance = account?.bankBalance ?? null;
  
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
  const handleTransactionClick = useCallback((item: DisplayRow) => {
    if (isOpeningBalanceRow(item)) return;
    setSelectedTransaction(item);

    if (selectedTransactionId === item.id) {
      // Second click on already selected transaction - open edit modal
      setIsEditModalOpen(true);
    } else {
      // First click - just select the transaction
      setSelectedTransactionId(item.id);
    }
  }, [selectedTransactionId]);
  
  
  // Handle quick add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError('');
    if (!account) return;
    if (!quickAddForm.description.trim()) {
      setQuickAddError('Description is required');
      return;
    }
    if (!quickAddForm.amount) {
      setQuickAddError('Amount is required');
      return;
    }
    if (quickAddForm.type !== 'transfer' && !quickAddForm.category) {
      setQuickAddError('Please select a category');
      return;
    }
    if (quickAddForm.type === 'transfer' && !quickAddForm.category) {
      setQuickAddError('Please select a target account');
      return;
    }
    
    // Calculate the correct amount based on transaction type
    let amount = parseFloat(quickAddForm.amount);
    if (quickAddForm.type === 'expense') {
      amount = -Math.abs(amount); // Expenses are always negative
    } else if (quickAddForm.type === 'income') {
      amount = Math.abs(amount); // Income is always positive
    } else if (quickAddForm.type === 'transfer') {
      // For transfers, amount is negative (money leaving this account)
      amount = -Math.abs(amount);
    }
    
    // Create the transaction
    const isTransfer = quickAddForm.type === 'transfer';
    const targetAccountId = isTransfer ? quickAddForm.category : undefined;

    const transactionData: Omit<Transaction, 'id'> = {
      date: new Date(quickAddForm.date),
      description: quickAddForm.description,
      amount: amount,
      type: quickAddForm.type,
      accountId: account.id,
      transferAccountId: targetAccountId,
      tags: quickAddForm.tags,
      notes: quickAddForm.notes,
      cleared: false,
      category: isTransfer ? 'transfer-out' : quickAddForm.category
    };

    try {
      const newTransaction = await addTransaction(transactionData);

      // For transfers, create the paired transaction in the target account
      if (isTransfer && targetAccountId && newTransaction) {
        await addTransaction({
          date: new Date(quickAddForm.date),
          description: quickAddForm.description,
          amount: Math.abs(amount),
          type: 'transfer',
          category: 'transfer-in',
          accountId: targetAccountId,
          transferAccountId: account.id,
          tags: quickAddForm.tags,
          notes: quickAddForm.notes,
          cleared: false
        });
      }

      // Reset form and error
      setQuickAddError('');
      setQuickAddForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'expense',
        category: '',
        tags: [],
        notes: ''
      });
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : 'Failed to add transaction. Please try again.');
    }
  };
  
  
  const handleDeleteConfirm = () => {
    if (deleteConfirmTransaction) {
      deleteTransaction(deleteConfirmTransaction.id);
      setDeleteConfirmTransaction(null);
    }
  };
  
  // Get category display name
  const getCategoryName = useCallback((categoryId: string, transaction?: TransactionWithBalance) => {
    if (!categoryId) return '';

    // For transfers, show target/source account name
    if (transaction?.type === 'transfer' && transaction.transferAccountId) {
      const targetAccount = accounts.find(a => a.id === transaction.transferAccountId);
      const accountName = targetAccount?.name ?? 'Unknown';
      if (categoryId === 'transfer-out' || categoryId === 'transfer-in') return `Transfer > ${accountName}`;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
        return '';
      }
      return '';
    }

    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }

    return category.name;
  }, [categories, accounts]);

  // Define table columns for VirtualizedTable
  const columns: Column<DisplayRow>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      width: '100px',
      accessor: (transaction) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {new Date(transaction.date).toLocaleDateString('en-GB')}
        </span>
      ),
      className: 'text-center',
      headerClassName: 'text-center',
      sortable: true
    },
    {
      key: 'reconciled',
      header: 'R',
      width: '35px',
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
      width: undefined, // flex column — uses flex:1 via className
      accessor: (transaction) => (
        <div className="flex items-center gap-2 min-w-0">
          <LocalMerchantLogo description={transaction.description} size="sm" />
          <span className="text-sm text-gray-900 dark:text-white truncate">
            {transaction.description}
          </span>
        </div>
      ),
      className: 'flex-1 min-w-0',
      headerClassName: 'flex-1 min-w-0',
      sortable: true
    },
    {
      key: 'category',
      header: 'Category',
      width: '280px',
      accessor: (transaction) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate block">
          {getCategoryName(transaction.category, transaction)}
        </span>
      ),
      className: 'text-left',
      headerClassName: 'text-left'
    },
    {
      key: 'tags',
      header: 'Tags',
      width: '120px',
      accessor: (transaction) => (
        <div className="flex flex-wrap gap-1 overflow-hidden max-h-[1.5rem] justify-center">
          {transaction.tags?.map((tag: string, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ),
      className: 'text-center',
      headerClassName: 'text-center'
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '120px',
      accessor: (transaction) => (
        <span className={`text-sm font-medium ${
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
      width: '120px',
      accessor: (transaction) => (
        <span className={`text-sm font-medium ${
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
  ], [formatCurrency, account?.currency, getCategoryName]);
  
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
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-3 self-start"
      >
        <ArrowLeftIcon size={16} />
        <span className="text-sm">Back to Accounts</span>
      </button>

      {/* Compact header with inline stat boxes */}
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow px-4 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white leading-tight">
                {account.name}
              </h1>
              <button
                onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
                className="p-1 text-white/50 hover:text-white transition-colors"
                title="Account Settings"
                type="button"
              >
                <SettingsIcon size={16} />
              </button>
            </div>
            {(account.sortCode && account.sortCode !== '000000') || (account.accountNumber && account.accountNumber !== '00000000') ? (
              <div className="flex items-center gap-3 mt-0.5">
                {account.sortCode && account.sortCode !== '000000' && (
                  <span className="text-xs text-white/70">{account.sortCode}</span>
                )}
                {account.accountNumber && account.accountNumber !== '00000000' && (
                  <span className="text-xs text-white/70">{account.accountNumber}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-white/20 dark:border-gray-700/50 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Account Balance</span>
            <span className={`text-sm font-bold whitespace-nowrap ${
              computedAccountBalance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(computedAccountBalance, account.currency)}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-white/20 dark:border-gray-700/50 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Bank Balance</span>
            <span className={`text-sm font-bold whitespace-nowrap ${
              bankBalance != null
                ? bankBalance >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              {bankBalance != null ? formatCurrency(bankBalance, account.currency) : 'N/A'}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-white/20 dark:border-gray-700/50 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Unreconciled</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
              {formatCurrency(unreconciledTotal, account.currency)}
            </span>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-lg border border-white/20 dark:border-gray-700/50 px-3 py-1.5 flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Difference</span>
            {bankBalance != null ? (() => {
              const difference = bankBalance - computedAccountBalance;
              return (
                <span className={`text-sm font-bold whitespace-nowrap ${
                  difference === 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(difference, account.currency)}
                </span>
              );
            })() : (
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">N/A</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="grid gap-6">
      {/* Search and Filter Bar */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
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
                <button
                  onClick={() => setTypeFilter('transfer')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                    typeFilter === 'transfer'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
          
          {/* Date Range and Additional Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
              <div className="w-40">
                <DatePicker
                  value={dateFrom}
                  onChange={(val) => setDateFrom(val)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                  aria-label="Filter from date"
                />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
              <div className="w-40">
                <DatePicker
                  value={dateTo}
                  onChange={(val) => setDateTo(val)}
                  className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white text-sm"
                  aria-label="Filter to date"
                />
              </div>
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
            {/* Compact View Toggle - Hidden but kept in code */}
            {/* <div className="flex-1 flex justify-end">
              <button
                onClick={() => setCompactView(!compactView)}
                className="flex items-center gap-2 px-3 py-3 sm:py-2 text-sm border-2 border-gray-400 dark:border-gray-500 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-h-[48px] sm:min-h-[auto]"
                title={compactView ? "Expand view" : "Compact view"}
              >
                {compactView ? <MaximizeIcon size={18} /> : <MinimizeIcon size={18} />}
                <span className="hidden sm:inline">{compactView ? 'Expand' : 'Compact'}</span>
              </button>
            </div> */}
          </div>
        </div>
      </div>
      
      {/* Transactions Table - Updated Layout */}
      <div 
        className="h-[calc(100vh-22rem)] min-h-[400px] overflow-hidden"
      >
        <VirtualizedTable
          items={displayRows}
          columns={columns}
          getItemKey={(row: DisplayRow) => row.id}
          onRowClick={(item) => handleTransactionClick(item)}
          rowHeight={compactView ? 36 : 44}
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
          className="virtualized-table bg-card-bg-light dark:bg-card-bg-dark rounded-2xl shadow-lg border-2 border-[#6B86B3] h-full"
          headerClassName="bg-secondary dark:bg-gray-700 text-white"
          rowClassName={(row: DisplayRow) => {
            if (isOpeningBalanceRow(row)) {
              return 'bg-blue-50/60 dark:bg-blue-900/20 italic';
            }
            const isSelected = selectedTransactionId === row.id;
            return isSelected ? 'selected-transaction-row' : '';
          }}
        />
      </div>
      
      {/* Quick Add Transaction */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl shadow-md border border-white/20 dark:border-gray-700/50 px-4 py-3 mt-4">
        <form onSubmit={handleQuickAdd}>
          {/* Row 1: Date | Type | Description */}
          <div className="flex items-end gap-3">
            <div className="w-[160px] shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Date</label>
              <DatePicker
                value={quickAddForm.date}
                onChange={(val) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, date: val }); }}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white text-xs"
                aria-label="Transaction date"
              />
            </div>

            <div className="shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Type</label>
              <div className="flex gap-0.5 items-center h-[32px] bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                {([
                  { value: 'expense', label: 'Exp', activeColor: 'text-red-600 dark:text-red-400' },
                  { value: 'income', label: 'Inc', activeColor: 'text-green-600 dark:text-green-400' },
                  { value: 'transfer', label: 'Txfr', activeColor: 'text-blue-600 dark:text-blue-400' },
                ] as const).map(({ value, label, activeColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, type: value }); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      quickAddForm.type === value
                        ? `bg-white dark:bg-gray-600 shadow-sm ${activeColor}`
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Description</label>
              <input
                type="text"
                placeholder="Description"
                value={quickAddForm.description}
                onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, description: e.target.value }); }}
                className="w-full px-2.5 py-1.5 h-[32px] text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                required
              />
            </div>
          </div>

          {/* Row 2: Category | Amount | Add */}
          <div className="flex items-end gap-3 mt-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">
                {quickAddForm.type === 'transfer' ? 'To Account' : 'Category'}
              </label>
              {quickAddForm.type === 'transfer' ? (
                <select
                  value={quickAddForm.category}
                  onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, category: e.target.value }); }}
                  className="w-full px-2.5 py-1.5 h-[32px] text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option value="">Select account...</option>
                  {accounts
                    .filter(acc => acc.id !== account?.id)
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                </select>
              ) : (
                <CategorySelector
                  selectedCategory={quickAddForm.category}
                  onCategoryChange={(categoryId) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, category: categoryId }); }}
                  transactionType={quickAddForm.type}
                  placeholder="Category..."
                  allowCreate={false}
                />
              )}
            </div>

            <div className="w-[120px] shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={quickAddForm.amount}
                onChange={(e) => { setQuickAddError(''); setQuickAddForm({ ...quickAddForm, amount: e.target.value }); }}
                className="w-full px-2.5 py-1.5 h-[32px] text-xs text-right bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="shrink-0 px-4 py-1.5 h-[32px] text-xs bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-1"
              title="Add Transaction"
            >
              <PlusIcon size={14} />
              Add
            </button>
          </div>

          {quickAddError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{quickAddError}</p>
          )}
        </form>
      </div>
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
          <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl p-6 max-w-md w-full">
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
