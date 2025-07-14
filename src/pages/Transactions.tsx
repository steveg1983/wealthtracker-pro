import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useCurrency } from '../hooks/useCurrency';
import EditTransactionModal from '../components/EditTransactionModal';
import { Plus, TrendingUp, TrendingDown, Calendar, Trash2, Minimize2, Maximize2, Edit2, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Transactions() {
  const { transactions, accounts, deleteTransaction, categories, getCategoryPath } = useApp();
  const { compactView, setCompactView, currency: displayCurrency } = usePreferences();
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

  // Get account ID from URL params
  const accountIdFromUrl = searchParams.get('account');
  
  // Set filter from URL on mount
  useEffect(() => {
    if (accountIdFromUrl) {
      setFilterAccountId(accountIdFromUrl);
    }
  }, [accountIdFromUrl]);


  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-white">Transactions</h1>
          {filteredAccount && (
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Showing transactions for: <span className="font-semibold">{filteredAccount.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Compact View Toggle */}
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            title={compactView ? "Switch to normal view" : "Switch to compact view"}
          >
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            <span className="hidden sm:inline dark:text-white">
              {compactView ? 'Normal View' : 'Compact View'}
            </span>
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Income</p>
              <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.income, displayCurrency)}</p>
            </div>
            <TrendingUp className="text-green-500" size={20} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense, displayCurrency)}</p>
            </div>
            <TrendingDown className="text-red-500" size={20} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow">
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
      <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow mb-4 md:mb-6">
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
                className="w-full pl-9 pr-3 py-2 text-sm md:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <div className="flex-1 min-w-[140px]">
              <select
                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="From"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
              className="flex-1 min-w-[130px] px-3 py-2 text-sm md:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleEdit(transaction)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(transaction.type)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
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
          <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>
                    Date
                  </th>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>
                    Description
                  </th>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell`}>
                    Category
                  </th>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell`}>
                    Account
                  </th>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>
                    Amount
                  </th>
                  <th className={`px-6 ${compactView ? 'py-2' : 'py-3'} text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTransactions.map((transaction) => {
                  const account = accounts.find(a => a.id === transaction.accountId);
                  return (
                    <tr 
                      key={transaction.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                      onClick={() => handleEdit(transaction)}
                    >
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-900 dark:text-gray-100`}>
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(transaction.type)}
                          <span className={`${compactView ? 'text-sm' : 'text-sm'} text-gray-900 dark:text-gray-100`}>{transaction.description}</span>
                        </div>
                      </td>
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell`}>
                        {(() => {
                          const category = categories.find(c => c.id === transaction.category);
                          if (!category) return transaction.categoryName || transaction.category;
                          
                          if (category.level === 'detail' && category.parentId) {
                            const parent = categories.find(c => c.id === category.parentId);
                            return `${parent?.name} > ${category.name}`;
                          }
                          return category.name;
                        })()}
                      </td>
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell`}>
                        {account?.name || 'Unknown'}
                      </td>
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-sm text-right font-medium ${
                        transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount, account?.currency || 'GBP')}
                      </td>
                      <td className={`px-6 ${compactView ? 'py-2' : 'py-4'} whitespace-nowrap text-right text-sm font-medium`}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(transaction);
                            }}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(transaction.id);
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      const value = e.target.value === 'all' ? filteredTransactions.length : Number(e.target.value);
                      setTransactionsPerPage(value);
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
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
            <div className="sm:hidden bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3">
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length}
                  </span>
                  <select
                    value={transactionsPerPage}
                    onChange={(e) => {
                      setTransactionsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-primary"
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

      <EditTransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        transaction={editingTransaction}
      />
    </div>
  );
}

