import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import EditTransactionModal from '../components/EditTransactionModal';
import TransactionDetailsView from '../components/TransactionDetailsView';
import { CalendarIcon, SearchIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, TrendingUpIcon, TrendingDownIcon } from '../components/icons';
import type { Transaction } from '../types';
import type { DecimalTransaction, DecimalInstance } from '../types/decimal-types';
import PageWrapper from '../components/PageWrapper';
import { TransactionRow } from '../components/TransactionRow';
import { TransactionCard } from '../components/TransactionCard';
import { VirtualizedTransactionList } from '../components/VirtualizedTransactionList';
import { MobileTransactionList } from '../components/MobileTransactionList';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useDebounce } from '../hooks/useDebounce';
import { SkeletonTableRow, SkeletonList } from '../components/loading/Skeleton';

export default function Transactions() {
  const { transactions, accounts, deleteTransaction, categories, getDecimalTransactions } = useApp();
  const { compactView, setCompactView, currency: displayCurrency } = usePreferences();
  const { isWideView, setIsWideView } = useLayout();
  const { formatCurrency } = useCurrencyDecimal();
  const [searchParams] = useSearchParams();
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
  const [transactionsPerPage, setTransactionsPerPage] = useState(20);
  const [sortField, setSortField] = useState<'date' | 'account' | 'description' | 'category' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
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

  // Handle column drag start
  const handleDragStart = useCallback((column: string, e: React.DragEvent) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
    
    // Create a custom drag image with enhanced styling
    const dragImage = document.createElement('div');
    dragImage.innerHTML = columnConfig[column as keyof typeof columnConfig].label;
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
  }, []);

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
      title="Transactions"
      headerContent={
        filteredAccount && (
          <p className="text-sm text-white/80 mt-1 ml-4">
            Showing transactions for: <span className="font-semibold">{filteredAccount.name}</span>
          </p>
        )
      }
      rightContent={
        <div className="flex items-center gap-2">
          {/* Compact View Toggle */}
          <div 
            onClick={() => setCompactView(!compactView)}
            className="cursor-pointer"
            title={compactView ? "Switch to normal view" : "Switch to compact view"}
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
              {compactView ? (
                <g transform="translate(12, 12)">
                  <path 
                    d="M8 3H5a2 2 0 00-2 2v3m0 0h18M3 8v8a2 2 0 002 2h3m0 0v3m0-3h8m0 3v-3m0 0h3a2 2 0 002-2v-3m0 0V8m0 0V5a2 2 0 00-2-2h-3" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>
              ) : (
                <g transform="translate(12, 12)">
                  <path 
                    d="M3 8V5a2 2 0 012-2h3M3 8h18M3 8v8a2 2 0 002 2h3m13-10v8a2 2 0 01-2 2h-3m0 0v3m0-3H8m8 3v-3m0-10V3m0 0h3a2 2 0 012 2v3M16 3H8" 
                    stroke="#1F2937" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>
              )}
            </svg>
          </div>
          
          {/* Wide View Toggle */}
          <div 
            onClick={() => setIsWideView(!isWideView)}
            className="cursor-pointer"
            title={isWideView ? "Switch to standard width" : "Switch to wide view"}
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
            title="Add Transaction"
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
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Income</p>
              <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.income, displayCurrency)}</p>
            </div>
            <TrendingUpIcon className="text-green-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense, displayCurrency)}</p>
            </div>
            <TrendingDownIcon className="text-red-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Net</p>
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
                placeholder="Search transactions..."
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
              <select
                className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterType}
                onChange={(e) => handleFilterChange(setFilterType)(e.target.value as 'all' | 'income' | 'expense')}
              >
                <option value="all">All Types</option>
                <option value="income">Income Only</option>
                <option value="expense">Expenses Only</option>
              </select>
            </div>
            
            {/* Account Filter */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="w-full px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                value={filterAccountId}
                onChange={(e) => handleFilterChange(setFilterAccountId)(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="From"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="To"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  resetPagination();
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                title="Clear date range"
              >
                <XIcon size={18} />
              </button>
            )}
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
          {/* Mobile Swipeable List View */}
          <div className="sm:hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-4">
            {isLoading ? (
              <SkeletonList items={5} className="p-4" />
            ) : (
              <MobileTransactionList
                transactions={paginatedTransactions}
                accounts={accounts}
                formatCurrency={formatCurrency}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleView}
                selectedTransactions={selectedTransactions}
                onSelectionChange={bulkSelectMode ? setSelectedTransactions : undefined}
              />
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className={`hidden sm:block bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/20 dark:border-gray-700/50 ${isWideView ? 'w-full' : ''}`} style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
            {isLoading ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600">
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
            ) : (transactionsPerPage > 100 || showAllTransactions) && filteredAndSortedTransactions.length > 100 ? (
              <div className="relative" style={{ height: '600px' }}>
                <VirtualizedTransactionList
                  transactions={filteredAndSortedTransactions}
                  formatCurrency={formatCurrency}
                  onTransactionClick={handleView}
                  onTransactionEdit={handleEdit}
                  onTransactionDelete={handleDelete}
                />
              </div>
            ) : (
              <div className={isWideView ? '' : 'overflow-x-auto'} role="region" aria-label="Transactions table">
                <table className="w-full" style={{ tableLayout: 'fixed' }} role="table" aria-label="Financial transactions">
                <caption className="sr-only">List of financial transactions with sortable columns. Use arrow keys to navigate and Enter to sort.</caption>
                <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600">
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
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div>
              <div className="hidden sm:block px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `Showing all ${filteredAndSortedTransactions.length} transactions`
                      : `Showing ${startIndex + 1} to ${Math.min(endIndex, filteredAndSortedTransactions.length)} of ${filteredAndSortedTransactions.length} transactions`
                    }
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredAndSortedTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-sm bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={200}>200 per page</option>
                    <option value="all">All transactions</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Pagination Controls */}
            <div className="sm:hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg px-4 py-3 border border-white/20 dark:border-gray-700/50">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `All ${filteredAndSortedTransactions.length}`
                      : `${startIndex + 1}-${Math.min(endIndex, filteredAndSortedTransactions.length)} of ${filteredAndSortedTransactions.length}`
                    }
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredAndSortedTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-xs bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                  >
                    <option value={10}>10/page</option>
                    <option value={20}>20/page</option>
                    <option value={50}>50/page</option>
                    <option value={100}>100/page</option>
                    <option value={200}>200/page</option>
                    <option value="all">All</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <EditTransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        transaction={editingTransaction}
      />

      <TransactionDetailsView
        isOpen={isDetailsViewOpen}
        onClose={handleCloseDetailsView}
        transaction={viewingTransaction}
        accounts={accounts}
        categories={categories}
      />
      
      </div>
      </div>
    </PageWrapper>
  );
}

