import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '@wealthtracker/utils';
import { lazy, Suspense } from 'react';
import { useDeviceType } from '../hooks/useDeviceType';
import { useTranslation } from '../hooks/useTranslation';

// Lazy load heavy modals to improve initial page load
const EditTransactionModal = lazy(() => import('../components/EditTransactionModal'));
const TransactionDetailsView = lazy(() => import('../components/TransactionDetailsView'));
const QuickDateFilters = lazy(() => import('../components/QuickDateFilters'));
import { CalendarIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, TrendingUpIcon, TrendingDownIcon } from '../components/icons';
import type { Transaction } from '../types';
import type { DecimalTransaction, DecimalInstance } from '../types/decimal-types';
import PageWrapper from '../components/PageWrapper';
import { TransactionRow } from '../components/TransactionRow';
import { TransactionCard } from '../components/TransactionCard';
// Lazy load list components that are conditionally rendered
const VirtualizedTransactionList = lazy(() => import('../components/VirtualizedTransactionList').then(m => ({ default: m.VirtualizedTransactionList })));
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useDebounce } from '../hooks/useDebounce';
import { SkeletonTableRow } from '../components/loading/Skeleton';

const Transactions = React.memo(function Transactions() {
  const { transactions, accounts, deleteTransaction, categories, getDecimalTransactions } = useApp();
  const { compactView, currency: displayCurrency } = usePreferences();
  const { isWideView, setIsWideView } = useLayout();
  const { formatCurrency } = useCurrencyDecimal();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { isMobile } = useDeviceType();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(20); // Increased for better UX
  const [sortField, setSortField] = useState<'date' | 'account' | 'description' | 'category' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnWidths, setColumnWidths] = useState({
    date: 120,
    reconciled: 40,
    account: 150,
    description: 300,
    category: 180,
    amount: 120,
    actions: 100
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [columnOrder, setColumnOrder] = useState(['date', 'reconciled', 'account', 'description', 'category', 'amount', 'actions']);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use optimized transaction filters hook
  const filterOptions = useMemo(() => ({
    filterType,
    filterAccountId,
    searchQuery: debouncedSearchQuery,
    dateFrom,
    dateTo
  }), [filterType, filterAccountId, debouncedSearchQuery, dateFrom, dateTo]);

  const sortOptions = useMemo(() => ({
    field: sortField,
    direction: sortDirection
  }), [sortField, sortDirection]);

  const { transactions: filteredAndSortedTransactions, getCategoryPath } = useTransactionFilters(
    transactions,
    accounts,
    categories,
    filterOptions,
    sortOptions
  );

  // Get account ID from URL params
  const accountIdFromUrl = searchParams.get('account');
  
  // Set filter from URL on mount
  useEffect(() => {
    if (accountIdFromUrl) {
      setFilterAccountId(accountIdFromUrl);
    }
  }, [accountIdFromUrl]);

  // Simulate loading state
  useEffect(() => {
    // Set loading to false once we have data
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);


  // Sort handler
  const handleSort = useCallback((field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  }, [sortField, sortDirection]);

  // Handle column resize
  const handleMouseDown = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column as keyof typeof columnWidths]);
  }, [columnWidths]);

  // Column configuration with display names and properties
  const columnConfig = useMemo(() => ({
    date: {
      label: 'Date',
      sortable: true,
      className: 'text-left',
      cellClassName: 'pl-7 pr-6',
      hidden: ''
    },
    reconciled: {
      label: 'R',
      sortable: false,
      className: 'text-center',
      cellClassName: 'px-2',
      hidden: ''
    },
    account: {
      label: 'Account',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: ''
    },
    description: {
      label: 'Description',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: ''
    },
    category: {
      label: 'Category',
      sortable: true,
      className: 'text-left',
      cellClassName: 'px-6',
      hidden: 'hidden sm:table-cell'
    },
    amount: {
      label: 'Amount',
      sortable: true,
      className: 'text-right',
      cellClassName: 'px-6',
      hidden: ''
    },
    actions: {
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      cellClassName: 'pl-6 pr-7',
      hidden: ''
    }
  }), []);

  // Handle column drag start
  const handleDragStart = useCallback((column: string, e: React.DragEvent) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
    
    // Create a custom drag image with enhanced styling
    const dragImage = document.createElement('div');
    dragImage.textContent = columnConfig[column as keyof typeof columnConfig].label;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 12px 24px;
      background: rgba(107, 134, 179, 0.95);
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(10px);
      z-index: 1000;
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, [columnConfig]);

  // Handle column drag over
  const handleDragOver = useCallback((column: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  }, []);

  // Handle column drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // Handle column drop
  const handleDrop = useCallback((targetColumn: string, e: React.DragEvent) => {
    e.preventDefault();
    const draggedColumn = e.dataTransfer.getData('text/plain');
    
    if (draggedColumn && draggedColumn !== targetColumn) {
      const newOrder = [...columnOrder];
      const draggedIndex = newOrder.indexOf(draggedColumn);
      const targetIndex = newOrder.indexOf(targetColumn);
      
      // Remove dragged column from its current position
      newOrder.splice(draggedIndex, 1);
      
      // Insert dragged column at target position
      newOrder.splice(targetIndex, 0, draggedColumn);
      
      setColumnOrder(newOrder);
    }
    
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [columnOrder]);


  // Add mouse event listeners when resizing
  React.useEffect(() => {
    if (isResizing) {
      const handleMouseMoveEvent = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        
        setColumnWidths(prev => ({
          ...prev,
          [isResizing]: newWidth
        }));
      };

      const handleMouseUpEvent = () => {
        setIsResizing(null);
      };

      document.addEventListener('mousemove', handleMouseMoveEvent);
      document.addEventListener('mouseup', handleMouseUpEvent);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveEvent);
        document.removeEventListener('mouseup', handleMouseUpEvent);
      };
    }
  }, [isResizing, startX, startWidth]);


  // Pagination logic - show all transactions if account is selected
  const showAllTransactions = !!accountIdFromUrl;
  const totalPages = showAllTransactions ? 1 : Math.ceil(filteredAndSortedTransactions.length / transactionsPerPage);
  const startIndex = showAllTransactions ? 0 : (currentPage - 1) * transactionsPerPage;
  const endIndex = showAllTransactions ? filteredAndSortedTransactions.length : startIndex + transactionsPerPage;
  const paginatedTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Add this to filter change handlers
  const handleFilterChange = useCallback(<T,>(filterSetter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    filterSetter(value);
    resetPagination();
  }, [resetPagination]);


  const handleDelete = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id);
    }
  }, [deleteTransaction]);

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  }, []);

  const handleView = useCallback((transaction: Transaction) => {
    setViewingTransaction(transaction);
    setIsDetailsViewOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleCloseDetailsView = useCallback(() => {
    setIsDetailsViewOpen(false);
    setViewingTransaction(null);
  }, []);

  // Calculate totals using decimal arithmetic
  const totals = useMemo(() => {
    const decimalTransactions = getDecimalTransactions();
    const filteredIds = new Set(filteredAndSortedTransactions.map(t => t.id));
    
    return decimalTransactions
      .filter((t: DecimalTransaction) => filteredIds.has(t.id))
      .reduce((acc: { income: DecimalInstance, expense: DecimalInstance, net: DecimalInstance }, t: DecimalTransaction) => {
        if (t.type === 'income') {
          acc.income = acc.income.plus(t.amount);
        } else if (t.type === 'expense') {
          acc.expense = acc.expense.plus(t.amount);
        }
        return acc;
      }, { 
        income: toDecimal(0), 
        expense: toDecimal(0),
        get net() { return this.income.minus(this.expense); }
      });
  }, [filteredAndSortedTransactions, getDecimalTransactions]);

  // Get filtered account name for display
  const filteredAccount = filterAccountId ? accounts.find(a => a.id === filterAccountId) : null;

  // Render table header cell
  const renderHeaderCell = useCallback((columnKey: string) => {
    const config = columnConfig[columnKey as keyof typeof columnConfig];
    if (!config) return null;

    const isDragging = draggedColumn === columnKey;
    const isDragOver = dragOverColumn === columnKey;

    return (
      <th
        key={columnKey}
        draggable={!isResizing}
        onDragStart={(e) => handleDragStart(columnKey, e)}
        onDragOver={(e) => handleDragOver(columnKey, e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(columnKey, e)}
        className={`px-6 ${compactView ? 'py-2' : 'py-3'} ${config.className} text-sm font-semibold text-white dark:text-gray-200 uppercase tracking-wider ${
          config.sortable ? 'cursor-pointer hover:text-white/80 dark:hover:text-gray-100' : ''
        } ${config.hidden || ''} relative ${
          isDragging ? 'opacity-70 shadow-2xl border-2 border-white/50 dark:border-gray-300/50 bg-white/10 dark:bg-gray-700/50 transform scale-105 z-50' : ''
        } ${
          isDragOver ? 'bg-white/20 border-l-4 border-l-white/80 dark:border-l-gray-300/80 before:absolute before:top-0 before:left-0 before:w-full before:h-full before:bg-white/10 before:animate-pulse' : ''
        } transition-all duration-200 ease-in-out`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={config.sortable && ['date', 'account', 'description', 'category', 'amount'].includes(columnKey) ? () => handleSort(columnKey as 'date' | 'account' | 'description' | 'category' | 'amount') : undefined}
        role="columnheader"
        aria-sort={sortField === columnKey ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        tabIndex={config.sortable ? 0 : -1}
        onKeyDown={config.sortable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (['date', 'account', 'description', 'category', 'amount'].includes(columnKey)) {
              handleSort(columnKey as 'date' | 'account' | 'description' | 'category' | 'amount');
            }
          }
        } : undefined}
        aria-label={`${config.label} column${config.sortable ? ', sortable' : ''}${sortField === columnKey ? `, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      >
        <div className="flex items-center gap-1" style={{ justifyContent: config.className === 'text-right' ? 'flex-end' : 'flex-start' }}>
          {config.label}
          {config.sortable && sortField === columnKey && (
            <span className="font-bold text-white dark:text-gray-200">
              {sortDirection === 'asc' ? <ChevronUpIcon size={18} strokeWidth={3} /> : <ChevronDownIcon size={18} strokeWidth={3} />}
            </span>
          )}
        </div>
        <div 
          className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[#5A729A] dark:bg-gray-600"
          onMouseDown={(e) => handleMouseDown(columnKey, e)}
        />
      </th>
    );
  }, [columnConfig, draggedColumn, dragOverColumn, isResizing, compactView, columnWidths, sortField, sortDirection, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleSort, handleMouseDown]);


  return (
    <PageWrapper 
      title={t('navigation.transactions')}
      headerContent={
        filteredAccount && (
          <p className="text-sm text-white/80 mt-1 ml-4">
            {t('transactions.showingTransactionsFor', 'Showing transactions for')}: <span className="font-semibold">{filteredAccount.name}</span>
          </p>
        )
      }
      rightContent={
        <div className="flex items-center gap-2">
          {/* Wide View Toggle */}
          <div 
            onClick={() => setIsWideView(!isWideView)}
            className="cursor-pointer"
            title={isWideView ? t('transactions.switchToStandardWidth', 'Switch to standard width') : t('transactions.switchToWideView', 'Switch to wide view')}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
            >
              <circle
                cx="24"
                cy="24"
                r="24"
                fill="#D9E1F2"
                className="transition-all duration-200"
                onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
              />
              {isWideView ? (
                <g transform="translate(12, 12)">
                  <path 
                    d="M5 12h14m-7-7v14" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </g>
              ) : (
                <g transform="translate(12, 12)">
                  <path 
                    d="M3 12h18m-9-9v18" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </svg>
          </div>
          
          {/* Add Transaction Button */}
          <div 
            onClick={() => setIsModalOpen(true)}
            className="cursor-pointer"
            title={t('transactions.addTransaction')}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
            >
              <circle
                cx="24"
                cy="24"
                r="24"
                fill="#D9E1F2"
                className="transition-all duration-200"
                onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
                onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
              />
              <g transform="translate(12, 12)">
                <path 
                  d="M12 5v14M5 12h14" 
                  stroke="#1F2937" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        </div>
      }
    >
      <div className={isWideView ? "w-[100vw] relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw] px-4 md:px-6 lg:px-8" : ""}>
        {/* Main content grid with consistent spacing */}
        <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.income')}</p>
              <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.income, displayCurrency)}</p>
            </div>
            <TrendingUpIcon className="text-green-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.expenses')}</p>
              <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense, displayCurrency)}</p>
            </div>
            <TrendingDownIcon className="text-red-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{t('transactions.net', 'Net')}</p>
              <p className={`text-lg md:text-xl font-bold ${totals.net.greaterThanOrEqualTo(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totals.net, displayCurrency)}
              </p>
            </div>
            <CalendarIcon className="text-primary" size={20} />
          </div>
        </div>
        </div>

        {/* Filters and Search */}
        <div className="pt-4">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="space-y-3">
          {/* Search Input */}
          <div className="w-full">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t('transactions.searchTransactions')}
                value={searchQuery}
                onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              />
            </div>
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="type-filter" className="sr-only">Transaction type filter</label>
              <select
                id="type-filter"
                className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterType}
                onChange={(e) => handleFilterChange(setFilterType)(e.target.value as 'all' | 'income' | 'expense')}
                aria-label="Filter transactions by type"
              >
                <option value="all">All Types</option>
                <option value="income">Income Only</option>
                <option value="expense">Expenses Only</option>
              </select>
            </div>
            
            {/* Account Filter */}
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="account-filter" className="sr-only">Account filter</label>
              <select
                id="account-filter"
                className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterAccountId}
                onChange={(e) => handleFilterChange(setFilterAccountId)(e.target.value)}
                aria-label="Filter transactions by account"
              >
                <option value="">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Quick Date Filters */}
          <Suspense fallback={<div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />}>
            <QuickDateFilters 
              onDateRangeSelect={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                resetPagination();
              }}
              currentFrom={dateFrom}
              currentTo={dateTo}
            />
          </Suspense>
          
          {/* Custom Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Range:</span>
            <label htmlFor="date-from" className="sr-only">From date</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="From"
              aria-label="Filter from date"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
            <label htmlFor="date-to" className="sr-only">To date</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="To"
              aria-label="Filter to date"
            />
          </div>
        </div>
        </div>
        </div>

        {/* Transactions List */}
        {filteredAndSortedTransactions.length === 0 ? (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-white/20 dark:border-gray-700/50">
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {transactions.length === 0 
              ? "No transactions yet. Click 'Add Transaction' to record your first one!"
              : searchQuery 
                ? `No transactions found for "${searchQuery}"`
                : "No transactions match your filters."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-4">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-4 border border-white/20 dark:border-gray-700/50">
                    <div className="animate-pulse">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex-1">
                          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                        <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {paginatedTransactions.map((transaction) => {
                  const account = accounts.find(a => a.id === transaction.accountId);
                  const categoryPath = getCategoryPath(transaction.category);
                  
                  return (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      account={account}
                      categoryDisplay={categoryPath}
                      formatCurrency={formatCurrency}
                      onClick={() => handleView(transaction)}
                    />
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className={`hidden lg:block bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/20 dark:border-gray-700/50 ${isWideView ? 'w-full' : ''}`} style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
            {isLoading ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Account</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200">Description</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-white dark:text-gray-200 hidden sm:table-cell">Category</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-white dark:text-gray-200">Amount</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-white dark:text-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(10)].map((_, index) => (
                      <SkeletonTableRow key={index} columns={6} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (transactionsPerPage > 20 || showAllTransactions) && filteredAndSortedTransactions.length > 20 && !isMobile ? (
              <div className="relative" style={{ height: '600px' }}>
                <Suspense fallback={<div className="p-4">Loading transactions...</div>}>
                  <VirtualizedTransactionList
                    transactions={filteredAndSortedTransactions}
                    formatCurrency={formatCurrency}
                    onTransactionClick={handleView}
                    onTransactionEdit={handleEdit}
                    onTransactionDelete={handleDelete}
                  />
                </Suspense>
              </div>
            ) : isMobile ? (
              // Mobile card view
              <div className="space-y-3 p-4">
                {paginatedTransactions.map((transaction) => {
                  const account = accounts.find(a => a.id === transaction.accountId);
                  const categoryPath = getCategoryPath(transaction.category);
                  
                  return (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      account={account}
                      categoryDisplay={categoryPath}
                      formatCurrency={formatCurrency}
                      onClick={() => handleView(transaction)}
                    />
                  );
                })}
              </div>
            ) : (
              // Desktop table view
              <div className={isWideView ? '' : 'overflow-x-auto'} role="region" aria-label="Transactions table">
                <table className="w-full" style={{ tableLayout: 'fixed' }} role="table" aria-label="Financial transactions">
                <caption className="sr-only">List of financial transactions with sortable columns. Use arrow keys to navigate and Enter to sort.</caption>
                <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
                  <tr role="row">
                    {columnOrder.map(renderHeaderCell)}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedTransactions.map((transaction) => {
                    const account = accounts.find(a => a.id === transaction.accountId);
                    const categoryPath = getCategoryPath(transaction.category);
                    
                    return (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        account={account}
                        categoryPath={categoryPath}
                        compactView={compactView}
                        formatCurrency={formatCurrency}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onView={handleView}
                        columnOrder={columnOrder}
                        columnWidths={columnWidths}
                      />
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
            </div>
            
            {/* Pagination Controls - Desktop Only (Mobile uses infinite scroll) */}
            {totalPages > 1 && (
              <div>
              <div className="hidden lg:block px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `Showing all ${filteredAndSortedTransactions.length} transactions`
                      : `Showing ${startIndex + 1} to ${Math.min(endIndex, filteredAndSortedTransactions.length)} of ${filteredAndSortedTransactions.length} transactions`
                    }
                  </span>
                  <label htmlFor="per-page-desktop" className="sr-only">Items per page</label>
                  <select
                    id="per-page-desktop"
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredAndSortedTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    aria-label="Select number of transactions per page"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value="all">All transactions</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to previous page"
                  >
                    <ChevronLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Show first page */}
                    {currentPage > 3 && (
                      <>
                        <button
                          onClick={() => setCurrentPage(1)}
                          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          1
                        </button>
                        {currentPage > 4 && <span className="text-gray-500 dark:text-gray-400">...</span>}
                      </>
                    )}
                    
                    {/* Show pages around current */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                      if (pageNum < 1 || pageNum > totalPages) return null;
                      if (pageNum > totalPages - 3 && currentPage < totalPages - 2) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm rounded ${
                            currentPage === pageNum
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {/* Show last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && <span className="text-gray-500 dark:text-gray-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to next page"
                  >
                    <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Pagination Controls - Hidden: Using Infinite Scroll Instead */}
            <div className="hidden lg:hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg px-4 py-3 border border-white/20 dark:border-gray-700/50">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `All ${filteredAndSortedTransactions.length}`
                      : `${startIndex + 1}-${Math.min(endIndex, filteredAndSortedTransactions.length)} of ${filteredAndSortedTransactions.length}`
                    }
                  </span>
                  <label htmlFor="per-page-mobile" className="sr-only">Items per page</label>
                  <select
                    id="per-page-mobile"
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredAndSortedTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-xs bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                    aria-label="Select number of transactions per page"
                  >
                    <option value={5}>5/page</option>
                    <option value={10}>10/page</option>
                    <option value={20}>20/page</option>
                    <option value={50}>50/page</option>
                    <option value={100}>100/page</option>
                    <option value="all">All</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to previous page"
                  >
                    <ChevronLeftIcon size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Simplified pagination for mobile */}
                    <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Go to next page"
                  >
                    <ChevronRightIcon size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            </div>
            )}
          </>
        )}

      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
        <EditTransactionModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal}
          transaction={editingTransaction}
        />
      </Suspense>

      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
        <TransactionDetailsView
          isOpen={isDetailsViewOpen}
          onClose={handleCloseDetailsView}
          transaction={viewingTransaction}
          accounts={accounts}
          categories={categories}
        />
      </Suspense>
      
      </div>
      </div>
    </PageWrapper>
  );
});

export default Transactions;
