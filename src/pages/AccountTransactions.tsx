import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeft, Search, ChevronUp, ChevronDown, Plus, Calendar, Banknote, FileText, Tag as TagIcon, ArrowRightLeft, X, Settings, Minimize2, Maximize2 } from 'lucide-react';
import EditTransactionModal from '../components/EditTransactionModal';
import CategorySelector from '../components/CategorySelector';
import { usePreferences } from '../contexts/PreferencesContext';
import type { Transaction } from '../types';

export default function AccountTransactions() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { accounts, transactions, categories, deleteTransaction, addTransaction } = useApp();
  const { formatCurrency } = useCurrency();
  const { compactView, setCompactView } = usePreferences();
  
  // Find the specific account
  const account = accounts.find(acc => acc.id === accountId);
  
  // State for search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [sortField, setSortField] = useState<'date' | 'description' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
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
  
  // State for drag and drop columns
  const [columnOrder, setColumnOrder] = useState(['date', 'reconciled', 'description', 'category', 'tags', 'amount']);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  // State for column resizing
  const [columnWidths, setColumnWidths] = useState({
    date: 120,
    reconciled: 40,
    description: 300,
    category: 200,
    tags: 200,
    amount: 150
  });
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
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
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];
        
        if (sortField === 'date') {
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
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
    
    let runningBalance = account.balance;
    const sortedByDate = [...accountTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return sortedByDate.map((transaction) => {
      const balance = runningBalance;
      if (transaction.type === 'income') {
        runningBalance -= transaction.amount;
      } else if (transaction.type === 'expense') {
        runningBalance += transaction.amount;
      }
      return { ...transaction, balance };
    }).reverse();
  }, [account, accountTransactions]);
  
  // Calculate unreconciled total
  const unreconciledTotal = useMemo(() => {
    if (!account) return 0;
    
    return accountTransactions
      .filter(t => !t.cleared)
      .reduce((sum, t) => {
        if (t.type === 'income') {
          return sum + t.amount;
        } else if (t.type === 'expense') {
          return sum - t.amount;
        }
        return sum;
      }, 0);
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
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransactionId(transaction.id);
    setSelectedTransaction(transaction);
  };
  
  // Handle transaction double click
  const handleTransactionDoubleClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditModalOpen(true);
  };
  
  // Column configuration
  const columnConfig = {
    date: {
      label: 'Date',
      sortable: true,
      className: 'text-left',
      cellClassName: 'text-left'
    },
    reconciled: {
      label: '✓',
      sortable: false,
      className: 'text-center',
      cellClassName: 'text-center'
    },
    description: {
      label: 'Description',
      sortable: true,
      className: 'text-left',
      cellClassName: 'text-left'
    },
    category: {
      label: 'Category',
      sortable: false,
      className: 'text-left',
      cellClassName: 'text-left'
    },
    tags: {
      label: 'Tags',
      sortable: false,
      className: 'text-left',
      cellClassName: 'text-left'
    },
    amount: {
      label: 'Amount',
      sortable: true,
      className: 'text-right',
      cellClassName: 'text-right'
    }
  };
  
  // Handle column drag and drop
  const handleDragStart = (columnKey: string, e: React.DragEvent) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (columnKey: string, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };
  
  const handleDragLeave = () => {
    setDragOverColumn(null);
  };
  
  const handleDrop = (columnKey: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === columnKey) return;
    
    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const dropIndex = newOrder.indexOf(columnKey);
    
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedColumn);
    
    setColumnOrder(newOrder);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };
  
  // Handle column resizing
  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = columnWidths[column as keyof typeof columnWidths];
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle sort
  const handleSort = (field: 'date' | 'description' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
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
        className={`px-6 ${compactView ? 'py-2' : 'py-3'} ${config.className} text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider ${
          config.sortable ? 'cursor-pointer hover:text-white/80 dark:hover:text-gray-100' : ''
        } relative ${
          isDragging ? 'opacity-70 shadow-2xl border-2 border-white/50 dark:border-gray-300/50 bg-white/10 dark:bg-gray-700/50 transform scale-105 z-50' : ''
        } ${
          isDragOver ? 'bg-white/20 border-l-4 border-l-white/80 dark:border-l-gray-300/80' : ''
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
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Accounts
        </button>
        
        <div className="flex items-start justify-between">
          {/* Account Name and Details Box */}
          <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
            <h1 className="text-3xl font-bold text-white">
              {account.name}
            </h1>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-white/80">
                <span>{(account as any).sortCode || '00-00-00'}</span>
                <span className="ml-4">{(account as any).accountNumber || '00000000'}</span>
              </div>
              <button
                onClick={() => navigate(`/settings/accounts/${account.id}`)}
                className="p-2 text-white/60 hover:text-white transition-colors"
                title="Account Settings"
              >
                <Settings size={20} />
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
                <span className={`text-xl font-bold ${
                  0 >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by description, amount, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm md:text-base bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
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
                className="flex items-center gap-2 px-3 py-2 text-sm border-2 border-gray-400 dark:border-gray-600 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title={compactView ? "Expand view" : "Compact view"}
              >
                {compactView ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                <span className="hidden sm:inline">{compactView ? 'Expand' : 'Compact'}</span>
              </button>
            </div>
          </div>
          
          {/* Date Range and Additional Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-500 dark:text-gray-400 hidden sm:block" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
                placeholder="From"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:text-white"
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
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="flex-1">
              {/* Space for additional filters */}
            </div>
          </div>
        </div>
      </div>
      
      {/* Transactions Table - Scrollable */}
      <div 
        className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col border-2 border-[#6B86B3]"
      >
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <table ref={tableRef} className="w-full">
            <thead className="bg-[#6B86B3] dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
              <tr>
                {columnOrder.map(columnKey => renderHeaderCell(columnKey))}
              </tr>
            </thead>
            <tbody>
              {transactionsWithBalance.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  onClick={() => handleTransactionClick(transaction)}
                  onDoubleClick={() => handleTransactionDoubleClick(transaction)}
                  className={`${
                    index % 2 === 1 ? 'bg-[#D9E1F2]/25' : 'bg-white'
                  } dark:${
                    index % 2 === 1 ? 'bg-gray-800/50' : 'bg-gray-800'
                  } cursor-pointer ${
                    selectedTransactionId === transaction.id 
                      ? 'shadow-[inset_2px_0_0_3px_rgb(209,213,219),inset_0_2px_0_3px_rgb(209,213,219),inset_0_-2px_0_3px_rgb(209,213,219),inset_-2px_0_0_3px_rgb(209,213,219)] dark:shadow-[inset_2px_0_0_3px_rgb(75,85,99),inset_0_2px_0_3px_rgb(75,85,99),inset_0_-2px_0_3px_rgb(75,85,99),inset_-2px_0_0_3px_rgb(75,85,99)]'
                      : 'hover:shadow-[inset_2px_0_0_3px_rgb(209,213,219),inset_0_2px_0_3px_rgb(209,213,219),inset_0_-2px_0_3px_rgb(209,213,219),inset_-2px_0_0_3px_rgb(209,213,219)] dark:hover:shadow-[inset_2px_0_0_3px_rgb(75,85,99),inset_0_2px_0_3px_rgb(75,85,99),inset_0_-2px_0_3px_rgb(75,85,99),inset_-2px_0_0_3px_rgb(75,85,99)]'
                  } transition-shadow relative`}
                >
                  {columnOrder.map(columnKey => {
                    const config = columnConfig[columnKey as keyof typeof columnConfig];
                    const className = `px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap ${compactView ? 'text-xs' : 'text-sm'} ${config?.cellClassName || ''}`;
                    
                    switch (columnKey) {
                      case 'date':
                        return (
                          <td key={columnKey} className={className}>
                            {new Date(transaction.date).toLocaleDateString('en-GB')}
                          </td>
                        );
                      case 'reconciled':
                        return (
                          <td key={columnKey} className={className}>
                            {transaction.cleared && (
                              <span className="text-green-600 dark:text-green-400">✓</span>
                            )}
                          </td>
                        );
                      case 'description':
                        return (
                          <td key={columnKey} className={className}>
                            <span className="text-gray-900 dark:text-white">
                              {transaction.description}
                            </span>
                          </td>
                        );
                      case 'category':
                        return (
                          <td key={columnKey} className={className}>
                            <span className="text-gray-600 dark:text-gray-400">
                              {getCategoryName(transaction.category)}
                            </span>
                          </td>
                        );
                      case 'tags':
                        return (
                          <td key={columnKey} className={className}>
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
                          </td>
                        );
                      case 'amount':
                        return (
                          <td key={columnKey} className={className}>
                            <span className={`font-medium ${
                              transaction.type === 'income' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatCurrency(transaction.amount, account.currency)}
                            </span>
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Quick Add Transaction Form */}
      <div className="flex-shrink-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Add Transaction</h3>
        <form onSubmit={handleQuickAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date and Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={16} />
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
                <ArrowRightLeft size={16} />
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
              <FileText size={16} />
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
                <Banknote size={16} />
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
              <Plus size={18} />
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