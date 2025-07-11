import { formatCurrency } from "../utils/formatters";
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import AddAccountModal from '../components/AddAccountModal';
import { Plus, Wallet, PiggyBank, CreditCard, TrendingDown, TrendingUp, Edit, Trash2 } from 'lucide-react';

export default function Accounts() {
  const { accounts, updateAccount, deleteAccount } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');

  // Group accounts by type
  const accountsByType = accounts.reduce((groups, account) => {
    const type = account.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, typeof accounts>);

  // Define account type metadata
  const accountTypes = [
    { 
      type: 'checking', 
      title: 'Current Accounts', 
      icon: Wallet, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    { 
      type: 'savings', 
      title: 'Savings Accounts', 
      icon: PiggyBank, 
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    { 
      type: 'credit', 
      title: 'Credit Cards', 
      icon: CreditCard, 
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    { 
      type: 'loan', 
      title: 'Loans', 
      icon: TrendingDown, 
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    { 
      type: 'investment', 
      title: 'Investments', 
      icon: TrendingUp, 
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
  ];

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalAssets = accounts.filter(acc => acc.balance > 0).reduce((sum, acc) => sum + acc.balance, 0);
  const totalLiabilities = Math.abs(accounts.filter(acc => acc.balance < 0).reduce((sum, acc) => sum + acc.balance, 0));

  const handleEdit = (accountId: string, currentBalance: number) => {
    setEditingId(accountId);
    setEditBalance(currentBalance.toString());
  };

  const handleSaveEdit = (accountId: string) => {
    updateAccount(accountId, { 
      balance: parseFloat(editBalance) || 0,
      lastUpdated: new Date()
    });
    setEditingId(null);
    setEditBalance('');
  };

  const handleDelete = (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account? All related transactions will also be deleted.')) {
      deleteAccount(accountId);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Accounts</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Net Worth</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            £{totalBalance.toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            £{totalAssets.toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Liabilities</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            £{totalLiabilities.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Accounts by Category */}
      <div className="space-y-6">
        {accountTypes.map(({ type, title, icon: Icon, color, bgColor, borderColor }) => {
          const typeAccounts = accountsByType[type] || [];
          if (typeAccounts.length === 0) return null;

          const typeTotal = typeAccounts.reduce((sum, acc) => sum + acc.balance, 0);

          return (
            <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className={`${bgColor} ${borderColor} border-b px-6 py-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={color} size={24} />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'})
                    </span>
                  </div>
                  <p className={`text-lg font-semibold ${typeTotal >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                    £{Math.abs(typeTotal).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {typeAccounts.map((account) => (
                  <div key={account.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {account.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {account.institution} • Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {editingId === account.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editBalance}
                              onChange={(e) => setEditBalance(e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(account.id)}
                              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className={`text-xl font-semibold ${
                              account.balance >= 0 
                                ? 'text-gray-900 dark:text-white' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatCurrency(account.balance, account.currency)}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(account.id, account.balance)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(account.id)}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No accounts yet. Click "Add Account" to get started!
          </p>
        </div>
      )}

      <AddAccountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
