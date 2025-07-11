import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import AddTransactionModal from '../components/AddTransactionModal';
import { Plus, TrendingUp, TrendingDown, Filter, Calendar, Trash2, Minimize2, Maximize2 } from 'lucide-react';

export default function Transactions() {
  const { transactions, accounts, deleteTransaction } = useApp();
  const { compactView, setCompactView } = usePreferences();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('');

  // Helper function to format currency properly
  const formatCurrency = (amount: number, currency: string = 'GBP'): string => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return symbol + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Apply filters
  const filteredTransactions = sortedTransactions.filter(transaction => {
    if (filterType !== 'all' && transaction.type !== filterType) return false;
    if (filterAccountId && transaction.accountId !== filterAccountId) return false;
    return true;
  });

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

  // Calculate totals
  const totals = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') acc.income += t.amount;
    else if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <div className="flex items-center gap-2">
          {/* Compact View Toggle */}
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={compactView ? "Switch to normal view" : "Switch to compact view"}
          >
            {compactView ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            <span className="hidden sm:inline dark:text-white">
              {compactView ? 'Normal View' : 'Compact View'}
            </span>
          </button>
          
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Income</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totals.income)}</p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.expense)}</p>
            </div>
            <TrendingDown className="text-red-500" size={24} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net</p>
              <p className={`text-xl font-bold ${totals.income - totals.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totals.income - totals.expense)}
              </p>
            </div>
            <Calendar className="text-primary" size={24} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-500 dark:text-gray-400" />
            <select
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
          <div>
            <select
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {transactions.length === 0 
              ? "No transactions yet. Click 'Add Transaction' to record your first one!"
              : "No transactions match your filters."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
                {filteredTransactions.map((transaction) => {
                  const account = accounts.find(a => a.id === transaction.accountId);
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                        {transaction.category}
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
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddTransactionModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
}
