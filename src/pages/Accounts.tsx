import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import AddAccountModal from '../components/AddAccountModal';
import AccountReconciliationModal from '../components/AccountReconciliationModal';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import PortfolioView from '../components/PortfolioView';
import { Plus, Wallet, PiggyBank, CreditCard, TrendingDown, TrendingUp, Edit, Trash2, CheckCircle, Home, PieChart, Settings } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

export default function Accounts() {
  const { accounts, updateAccount, deleteAccount } = useApp();
  const { formatCurrency: formatDisplayCurrency } = useCurrency();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const [reconcileAccountId, setReconcileAccountId] = useState<string | null>(null);
  const [balanceAdjustmentData, setBalanceAdjustmentData] = useState<{
    accountId: string;
    currentBalance: number;
    newBalance: string;
  } | null>(null);
  const [portfolioAccountId, setPortfolioAccountId] = useState<string | null>(null);
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);

  // Group accounts by type (memoized)
  const accountsByType = useMemo(() => 
    accounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<string, typeof accounts>),
    [accounts]
  );

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
    { 
      type: 'assets', 
      title: 'Other Assets', 
      icon: Home, 
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    },
  ];


  const handleEdit = (accountId: string, currentBalance: number) => {
    setEditingId(accountId);
    setEditBalance(currentBalance.toString());
  };

  const handleSaveEdit = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setBalanceAdjustmentData({
        accountId,
        currentBalance: account.balance,
        newBalance: editBalance
      });
    }
    setEditingId(null);
    setEditBalance('');
  };

  const handleDelete = (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account? All related transactions will also be deleted.')) {
      deleteAccount(accountId);
    }
  };


  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-white">Accounts</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2 self-end sm:self-auto"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Account</span>
          <span className="sm:hidden">Add</span>
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
              <div className={`${bgColor} ${borderColor} border-b px-4 md:px-6 py-3 md:py-4`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Icon className={color} size={20} />
                    <h2 className="text-base md:text-lg font-semibold text-blue-800 dark:text-white">{title}</h2>
                    <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      ({typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'})
                    </span>
                  </div>
                  <p className={`text-base md:text-lg font-semibold ${typeTotal >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                    {typeTotal < 0 ? '-' : ''}{formatDisplayCurrency(Math.abs(typeTotal))}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {typeAccounts.map((account) => (
                  <div 
                    key={account.id} 
                    className="p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/70 transition-colors cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on buttons or inputs
                      if ((e.target as HTMLElement).closest('button, input')) return;
                      navigate(`/transactions?account=${account.id}`);
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {account.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          {account.institution || 'Unknown Institution'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
                        </p>
                        {account.openingBalance !== undefined && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Opening balance: {formatDisplayCurrency(account.openingBalance, account.currency)} 
                            {account.openingBalanceDate && ` on ${new Date(account.openingBalanceDate).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                        {editingId === account.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editBalance}
                              onChange={(e) => setEditBalance(e.target.value)}
                              className="w-24 sm:w-32 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(account.id)}
                              className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <p className={`text-lg md:text-xl font-semibold min-w-[120px] sm:min-w-[140px] text-right ${
                                account.balance >= 0 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {account.balance < 0 ? '-' : ''}{formatDisplayCurrency(Math.abs(account.balance), account.currency)}
                              </p>
                              <div className="flex items-center gap-1">
                              {account.type === 'investment' && account.holdings && account.holdings.length > 0 && (
                                <button
                                  onClick={() => setPortfolioAccountId(account.id)}
                                  className="p-1.5 sm:p-1 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded relative group"
                                  title="View Portfolio"
                                >
                                  <PieChart size={16} />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                                    View Portfolio
                                  </span>
                                </button>
                              )}
                              <button
                                onClick={() => setSettingsAccountId(account.id)}
                                className="p-1.5 sm:p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded relative group"
                                title="Account Settings"
                              >
                                <Settings size={16} />
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                                  Account Settings
                                </span>
                              </button>
                              <button
                                onClick={() => setReconcileAccountId(account.id)}
                                className="p-1.5 sm:p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded relative group"
                                title="Reconcile Account"
                              >
                                <CheckCircle size={16} />
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                                  Reconcile Account
                                </span>
                              </button>
                              <button
                                onClick={() => handleEdit(account.id, account.balance)}
                                className="p-1.5 sm:p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded relative group"
                                title="Edit Balance"
                              >
                                <Edit size={16} />
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                                  Edit Balance
                                </span>
                              </button>
                              <button
                                onClick={() => handleDelete(account.id)}
                                className="p-1.5 sm:p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded relative group"
                                title="Delete Account"
                              >
                                <Trash2 size={16} />
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none">
                                  Delete Account
                                </span>
                              </button>
                              </div>
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
      
      {/* Account Reconciliation Modal */}
      {reconcileAccountId && (
        <AccountReconciliationModal
          isOpen={true}
          onClose={() => setReconcileAccountId(null)}
          accountId={reconcileAccountId}
        />
      )}
      
      {/* Balance Adjustment Modal */}
      {balanceAdjustmentData && (
        <BalanceAdjustmentModal
          isOpen={true}
          onClose={() => {
            setBalanceAdjustmentData(null);
            // Update the account balance after transaction is created
            if (balanceAdjustmentData.accountId) {
              const newBalance = parseFloat(balanceAdjustmentData.newBalance) || 0;
              updateAccount(balanceAdjustmentData.accountId, {
                balance: newBalance,
                lastUpdated: new Date()
              });
            }
          }}
          accountId={balanceAdjustmentData.accountId}
          currentBalance={balanceAdjustmentData.currentBalance}
          newBalance={balanceAdjustmentData.newBalance}
        />
      )}
      
      {/* Portfolio View Modal */}
      {portfolioAccountId && (() => {
        const account = accounts.find(a => a.id === portfolioAccountId);
        if (!account || !account.holdings) return null;
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <PortfolioView
                  accountId={portfolioAccountId}
                  accountName={account.name}
                  holdings={account.holdings}
                  currency={account.currency}
                  onClose={() => setPortfolioAccountId(null)}
                />
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={!!settingsAccountId}
        onClose={() => setSettingsAccountId(null)}
        account={accounts.find(a => a.id === settingsAccountId) || null}
        onSave={(accountId, updates) => {
          updateAccount(accountId, updates);
          setSettingsAccountId(null);
        }}
      />
    </div>
  );}
  