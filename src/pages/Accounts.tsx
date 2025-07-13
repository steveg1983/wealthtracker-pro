import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import AddAccountModal from '../components/AddAccountModal';
import { Plus, Wallet, PiggyBank, CreditCard, TrendingDown, TrendingUp, Edit, Trash2, Calculator } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

export default function Accounts() {
  const { accounts, updateAccount, deleteAccount } = useApp();
  const { formatCurrency: formatDisplayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [openingBalanceAccountId, setOpeningBalanceAccountId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState('');
  // Helper function to format currency in account's own currency
  const formatAccountCurrency = (amount: number, currency: string = 'GBP'): string => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
    return symbol + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  };

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
      type: 'current', 
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

  const handleOpeningBalance = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setOpeningBalanceAccountId(accountId);
      setOpeningBalance(account.openingBalance?.toString() || '0');
      const date = account.openingBalanceDate ? new Date(account.openingBalanceDate) : new Date();
      setOpeningBalanceDate(date.toISOString().split('T')[0]);
    }
  };

  const handleSaveOpeningBalance = () => {
    if (openingBalanceAccountId) {
      updateAccount(openingBalanceAccountId, {
        openingBalance: parseFloat(openingBalance) || 0,
        openingBalanceDate: new Date(openingBalanceDate)
      });
      setOpeningBalanceAccountId(null);
      setOpeningBalance('');
      setOpeningBalanceDate('');
    }
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
                    {formatDisplayCurrency(typeTotal)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {typeAccounts.map((account) => (
                  <div 
                    key={account.id} 
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on buttons or inputs
                      if ((e.target as HTMLElement).closest('button, input')) return;
                      navigate(`/transactions?account=${account.id}`);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {account.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {account.institution || 'Unknown Institution'} • Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
                        </p>
                        {account.openingBalance !== undefined && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Opening balance: {formatAccountCurrency(account.openingBalance, account.currency)} 
                            {account.openingBalanceDate && ` on ${new Date(account.openingBalanceDate).toLocaleDateString()}`}
                          </p>
                        )}
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
                              {formatAccountCurrency(account.balance, account.currency)}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpeningBalance(account.id)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                title="Adjust Opening Balance"
                              >
                                <Calculator size={18} />
                              </button>
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

      {/* Opening Balance Modal */}
      {openingBalanceAccountId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Adjust Opening Balance
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set the opening balance for this account. This is useful when importing partial transaction history.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Opening Balance Date
                </label>
                <input
                  type="date"
                  value={openingBalanceDate}
                  onChange={(e) => setOpeningBalanceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setOpeningBalanceAccountId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOpeningBalance}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <AddAccountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );}
  