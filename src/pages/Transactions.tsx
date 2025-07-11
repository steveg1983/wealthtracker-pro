import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Search, Filter, Tag, Edit2, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import SplitTransactionModal from '../components/SplitTransactionModal';
import RecurringTransactionModal from '../components/RecurringTransactionModal';

export default function Transactions() {
  const { transactions, accounts, updateTransaction, deleteTransaction } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => cats.add(t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Search filter
      if (searchTerm && !transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !transaction.category.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(transaction.tags && transaction.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'all' && transaction.category !== filterCategory) {
        return false;
      }

      // Type filter
      if (filterType !== 'all' && transaction.type !== filterType) {
        return false;
      }

      // Account filter
      if (filterAccount !== 'all' && transaction.accountId !== filterAccount) {
        return false;
      }

      // Date range filter
      if (dateFrom && new Date(transaction.date) < new Date(dateFrom)) {
        return false;
      }
      if (dateTo && new Date(transaction.date) > new Date(dateTo)) {
        return false;
      }

      return true;
    });
  }, [transactions, searchTerm, filterCategory, filterType, filterAccount, dateFrom, dateTo]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTransactions, sortBy, sortOrder]);

  const handleSelectAll = () => {
    if (selectedTransactions.size === sortedTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(sortedTransactions.map(t => t.id)));
    }
  };

  const handleSelectTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedTransactions.size} transactions?`)) {
      selectedTransactions.forEach(id => deleteTransaction(id));
      setSelectedTransactions(new Set());
    }
  };

  const handleBulkCategorize = () => {
    const newCategory = prompt('Enter new category for selected transactions:');
    if (newCategory) {
      selectedTransactions.forEach(id => {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
          updateTransaction(id, { ...transaction, category: newCategory });
        }
      });
      setSelectedTransactions(new Set());
    }
  };

  const handleBulkTag = () => {
    const newTag = prompt('Enter tag to add to selected transactions:');
    if (newTag) {
      selectedTransactions.forEach(id => {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) {
          const currentTags = transaction.tags || [];
          updateTransaction(id, { 
            ...transaction, 
            tags: [...currentTags, newTag].filter((tag, index, self) => self.indexOf(tag) === index)
          });
        }
      });
      setSelectedTransactions(new Set());
    }
  };

  const handleDuplicateTransaction = (transaction: any) => {
    const newTransaction = {
      ...transaction,
      id: undefined,
      date: new Date(),
      description: `Copy of ${transaction.description}`
    };
    setEditingTransaction(newTransaction);
    setShowEditModal(true);
  };

  const handleSplitTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setShowSplitModal(true);
  };

  const handleSort = (field: 'date' | 'amount' | 'description') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown Account';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRecurringModal(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Recurring
          </button>
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowEditModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors"
          >
            Add Transaction
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                showFilters 
                  ? 'bg-primary text-white border-primary' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter size={20} />
              Filters
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Accounts</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From date"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To date"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Results count and bulk actions */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {sortedTransactions.length} of {transactions.length} transactions
              {selectedTransactions.size > 0 && ` (${selectedTransactions.size} selected)`}
            </p>
            
            {selectedTransactions.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleBulkCategorize}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Categorize
                </button>
                <button
                  onClick={handleBulkTag}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Tag
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.size === sortedTransactions.length && sortedTransactions.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1">
                    Description
                    {sortBy === 'description' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-1">
                    Amount
                    {sortBy === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedTransactions.map((transaction) => (
                <tr 
                  key={transaction.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    selectedTransactions.has(transaction.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(transaction.id)}
                      onChange={() => handleSelectTransaction(transaction.id)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </p>
                      {transaction.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {transaction.notes}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {transaction.category}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {getAccountName(transaction.accountId)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${
                    transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.tags && transaction.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {transaction.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleDuplicateTransaction(transaction)}
                        className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleSplitTransaction(transaction)}
                        className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="Split"
                      >
                        <Tag size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(transaction);
                          setShowEditModal(true);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this transaction?')) {
                            deleteTransaction(transaction.id);
                          }
                        }}
                        className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <TransactionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
      />

      <SplitTransactionModal
        isOpen={showSplitModal}
        onClose={() => {
          setShowSplitModal(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
      />

      <RecurringTransactionModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
      />
    </div>
  );
}
