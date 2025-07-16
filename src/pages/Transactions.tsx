import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useLayout } from '../contexts/LayoutContext';
import { useCurrency } from '../hooks/useCurrency';
import EditTransactionModal from '../components/EditTransactionModal';
import { Plus, TrendingUp, TrendingDown, Calendar, Trash2, Minimize2, Maximize2, Edit2, Search, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Expand, Shrink } from 'lucide-react';

export default function Transactions() {
  const { transactions, accounts, deleteTransaction, categories } = useApp();
  const { compactView, setCompactView, currency: displayCurrency } = usePreferences();
  const { isWideView, setIsWideView } = useLayout();
  const { formatCurrency } = useCurrency();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(20);
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

  // Helper function to get category path
  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return categoryId;
    
    if (category.level === 'detail' && category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    
    return category.name;
  };

  // Get account ID from URL params
  const accountIdFromUrl = searchParams.get('account');
  
  // Set filter from URL on mount
  useEffect(() => {
    if (accountIdFromUrl) {
      setFilterAccountId(accountIdFromUrl);
    }
  }, [accountIdFromUrl]);


  // Sort handler
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle column resize
  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column as keyof typeof columnWidths]);
  };

  // Handle column drag start
  const handleDragStart = (column: string, e: React.DragEvent) => {
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
  };

  // Handle column drag over
  const handleDragOver = (column: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  // Handle column drag leave
  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // Handle column drop
  const handleDrop = (targetColumn: string, e: React.DragEvent) => {
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
  };


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

  // Sort transactions based on current sort field and direction
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'account':
          const accountA = accounts.find(acc => acc.id === a.accountId);
          const accountB = accounts.find(acc => acc.id === b.accountId);
          aValue = accountA?.name || '';
          bValue = accountB?.name || '';
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'category':
          const categoryA = categories.find(c => c.id === a.category);
          const categoryB = categories.find(c => c.id === b.category);
          
          // Get full category path for sorting
          if (categoryA && categoryA.level === 'detail' && categoryA.parentId) {
            const parentA = categories.find(c => c.id === categoryA.parentId);
            aValue = `${parentA?.name || ''} > ${categoryA.name}`;
          } else {
            aValue = categoryA?.name || a.categoryName || a.category || '';
          }
          
          if (categoryB && categoryB.level === 'detail' && categoryB.parentId) {
            const parentB = categories.find(c => c.id === categoryB.parentId);
            bValue = `${parentB?.name || ''} > ${categoryB.name}`;
          } else {
            bValue = categoryB?.name || b.categoryName || b.category || '';
          }
          
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [transactions, sortField, sortDirection, accounts, categories]);

  // Apply filters and search (memoized)
  const filteredTransactions = useMemo(() => 
    sortedTransactions.filter(transaction => {
      // Type filter
      if (filterType !== 'all' && transaction.type !== filterType) return false;
      
      // Account filter
      if (filterAccountId && transaction.accountId !== filterAccountId) return false;
      
      // Date range filter
      const transactionDate = new Date(transaction.date);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (transactionDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire day
        if (transactionDate > toDate) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = transaction.description.toLowerCase().includes(query);
        const categoryPath = getCategoryPath(transaction.category);
        const matchesCategory = categoryPath.toLowerCase().includes(query);
        const matchesAmount = transaction.amount.toString().includes(query);
        const account = accounts.find(a => a.id === transaction.accountId);
        const matchesAccount = account?.name.toLowerCase().includes(query) || false;
        
        if (!matchesDescription && !matchesCategory && !matchesAmount && !matchesAccount) {
          return false;
        }
      }
      
      return true;
    }),
    [sortedTransactions, filterType, filterAccountId, dateFrom, dateTo, searchQuery, getCategoryPath, accounts]
  );

  // Pagination logic - show all transactions if account is selected
  const showAllTransactions = !!accountIdFromUrl;
  const totalPages = showAllTransactions ? 1 : Math.ceil(filteredTransactions.length / transactionsPerPage);
  const startIndex = showAllTransactions ? 0 : (currentPage - 1) * transactionsPerPage;
  const endIndex = showAllTransactions ? filteredTransactions.length : startIndex + transactionsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Add this to filter change handlers
  const handleFilterChange = (filterSetter: any) => (value: any) => {
    filterSetter(value);
    resetPagination();
  };

  const getTypeIcon = (type: string) => {
    return type === 'income' ? (
      <TrendingUp className="text-green-500" size={compactView ? 16 : 20} />
    ) : (
      <TrendingDown className="text-red-500" size={compactView ? 16 : 20} />
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id);
    }
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  // Calculate totals
  const totals = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  // Get filtered account name for display
  const filteredAccount = filterAccountId ? accounts.find(a => a.id === filterAccountId) : null;

  // Column configuration with display names and properties
  const columnConfig = {
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
  };

  // Render table header cell
  const renderHeaderCell = (columnKey: string) => {
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
        onClick={config.sortable ? () => handleSort(columnKey as any) : undefined}
      >
        <div className="flex items-center gap-1" style={{ justifyContent: config.className === 'text-right' ? 'flex-end' : 'flex-start' }}>
          {config.label}
          {config.sortable && sortField === columnKey && (
            <span className="font-bold text-white dark:text-gray-200">
              {sortDirection === 'asc' ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
            </span>
          )}
        </div>
        <div 
          className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-[#5A729A] dark:bg-gray-600"
          onMouseDown={(e) => handleMouseDown(columnKey, e)}
        />
      </th>
    );
  };

  // Render table data cell
  const renderDataCell = (columnKey: string, transaction: any, _index: number) => {
    const config = columnConfig[columnKey as keyof typeof columnConfig];
    if (!config) return null;

    const account = accounts.find(a => a.id === transaction.accountId);

    switch (columnKey) {
      case 'date':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-900 dark:text-gray-100`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            {new Date(transaction.date).toLocaleDateString()}
          </td>
        );
      case 'reconciled':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} text-center`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
              {transaction.cleared ? 'R' : 'N'}
            </span>
          </td>
        );
      case 'account':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-500 dark:text-gray-400`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            <div className="truncate">
              {account?.name || 'Unknown'}
            </div>
          </td>
        );
      case 'description':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            <div className="flex items-center gap-2">
              {getTypeIcon(transaction.type)}
              <span className={`${compactView ? 'text-sm' : 'text-sm'} text-gray-900 dark:text-gray-100 truncate`}>{transaction.description}</span>
            </div>
          </td>
        );
      case 'category':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${config.hidden}`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            <div className="truncate">
              {(() => {
                const category = categories.find(c => c.id === transaction.category);
                if (!category) return transaction.categoryName || transaction.category;
                
                if (category.level === 'detail' && category.parentId) {
                  const parent = categories.find(c => c.id === category.parentId);
                  return `${parent?.name} > ${category.name}`;
                }
                return category.name;
              })()}
            </div>
          </td>
        );
      case 'amount':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-right font-medium ${
            transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            {transaction.type === 'income' ? '+' : '-'}
            {formatCurrency(transaction.amount, account?.currency || 'GBP')}
          </td>
        );
      case 'actions':
        return (
          <td key={columnKey} className={`${config.cellClassName} ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-right text-sm font-medium`} style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(transaction);
                }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(transaction.id);
                }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className={isWideView ? "w-[100vw] relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw] px-4 md:px-6 lg:px-8" : ""}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-3">
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Transactions</h1>
          {filteredAccount && (
            <p className="text-sm text-white/80 mt-1">
              Showing transactions for: <span className="font-semibold">{filteredAccount.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Compact View Toggle */}
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-2 px-3 py-2 text-sm border-2 border-gray-400 dark:border-gray-600 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title={compactView ? "Switch to normal view" : "Switch to compact view"}
          >
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            <span className="hidden sm:inline dark:text-white">
              {compactView ? 'Normal View' : 'Compact View'}
            </span>
          </button>
          
          {/* Wide View Toggle */}
          <button
            onClick={() => setIsWideView(!isWideView)}
            className="flex items-center gap-2 px-3 py-2 text-sm border-2 border-gray-400 dark:border-gray-600 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title={isWideView ? "Switch to standard width" : "Switch to wide view"}
          >
            {isWideView ? <Shrink size={16} /> : <Expand size={16} />}
            <span className="hidden sm:inline dark:text-white">
              {isWideView ? 'Standard View' : 'Wide View'}
            </span>
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-white px-4 py-2 rounded-2xl hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </div>

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
            <TrendingUp className="text-green-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense, displayCurrency)}</p>
            </div>
            <TrendingDown className="text-red-500" size={20} />
          </div>
        </div>
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Net</p>
              <p className={`text-lg md:text-xl font-bold ${totals.income - totals.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totals.income - totals.expense, displayCurrency)}
              </p>
            </div>
            <Calendar className="text-primary" size={20} />
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
                onChange={(e) => handleFilterChange(setFilterType)(e.target.value as any)}
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
            <Calendar size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
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
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
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
          <div className="sm:hidden space-y-3 mb-4">
            {paginatedTransactions.map((transaction) => {
              const account = accounts.find(a => a.id === transaction.accountId);
              const category = categories.find(c => c.id === transaction.category);
              const categoryDisplay = category ? 
                (category.level === 'detail' && category.parentId ? 
                  `${categories.find(c => c.id === category.parentId)?.name} > ${category.name}` : 
                  category.name) : 
                transaction.categoryName || transaction.category;
              
              return (
                <div 
                  key={transaction.id}
                  className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow border border-white/20 dark:border-gray-700/50"
                  onClick={() => handleEdit(transaction)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(transaction.type)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            {transaction.cleared ? 'R' : 'N'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount, account?.currency || 'GBP')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>{categoryDisplay}</span>
                    <span>{account?.name || 'Unknown'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Desktop Table View */}
          <div className={`hidden sm:block bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/20 dark:border-gray-700/50 ${isWideView ? 'w-full' : ''}`} style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
            <div className={isWideView ? '' : 'overflow-x-auto'}>
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-[#6B86B3] dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600">
                <tr>
                  {columnOrder.map(renderHeaderCell)}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTransactions.map((transaction, index) => (
                  <tr 
                    key={transaction.id} 
                    className={`${index % 2 === 1 ? 'bg-[#D9E1F2]/25' : 'bg-white'} ${index % 2 === 1 ? 'dark:bg-gray-700/30' : 'dark:bg-gray-800'} cursor-pointer hover:shadow-[inset_2px_0_0_3px_rgb(209,213,219),inset_0_2px_0_3px_rgb(209,213,219),inset_0_-2px_0_3px_rgb(209,213,219),inset_-2px_0_0_3px_rgb(209,213,219)] dark:hover:shadow-[inset_2px_0_0_3px_rgb(75,85,99),inset_0_2px_0_3px_rgb(75,85,99),inset_0_-2px_0_3px_rgb(75,85,99),inset_-2px_0_0_3px_rgb(75,85,99)] transition-shadow relative`}
                    onClick={() => handleEdit(transaction)}
                  >
                    {columnOrder.map(columnKey => renderDataCell(columnKey, transaction, index))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `Showing all ${filteredTransactions.length} transactions`
                      : `Showing ${startIndex + 1} to ${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length} transactions`
                    }
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredTransactions.length : Number(e.target.value);
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
                    <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
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
                    <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
          
          {/* Mobile Pagination Controls */}
          {totalPages > 1 && (
            <div className="sm:hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg px-4 py-3 border border-white/20 dark:border-gray-700/50">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {showAllTransactions 
                      ? `All ${filteredTransactions.length}`
                      : `${startIndex + 1}-${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length}`
                    }
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      setTransactionsPerPage(Number(e.target.value));
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
                    <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
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
                    <ChevronRight size={18} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      <EditTransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        transaction={editingTransaction}
      />
    </div>
  );
}

