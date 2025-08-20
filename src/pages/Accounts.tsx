import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { preserveDemoParam } from '../utils/navigation';
import AddAccountModal from '../components/AddAccountModal';
import AccountReconciliationModal from '../components/AccountReconciliationModal';
import BalanceAdjustmentModal from '../components/BalanceAdjustmentModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import PortfolioView from '../components/PortfolioView';
// No longer importing from lucide-react - all icons are now custom
import { EditIcon, DeleteIcon, SettingsIcon, WalletIcon, PiggyBankIcon, CreditCardIcon, TrendingDownIcon, TrendingUpIcon, CheckCircleIcon, HomeIcon, PieChartIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import PageWrapper from '../components/PageWrapper';
import { calculateTotalBalance } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import { SkeletonCard } from '../components/loading/Skeleton';

export default function Accounts({ onAccountClick }: { onAccountClick?: (accountId: string) => void }) {
  const { accounts, updateAccount, deleteAccount } = useApp();
  const { formatCurrency: formatDisplayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isLoading, setIsLoading] = useState(true);

  // Convert accounts to decimal for calculations
  const decimalAccounts = useMemo(() => accounts.map(a => ({
    ...a,
    balance: toDecimal(a.balance),
    initialBalance: a.openingBalance ? toDecimal(a.openingBalance) : undefined
  })), [accounts]);
  
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

  // Set loading to false when accounts are loaded
  useEffect(() => {
    if (accounts !== undefined) {
      setIsLoading(false);
    }
  }, [accounts]);
  
  // Group decimal accounts by type for calculations
  const decimalAccountsByType = useMemo(() => 
    decimalAccounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<string, typeof decimalAccounts>),
    [decimalAccounts]
  );

  // Define account type metadata
  const accountTypes = [
    { 
      type: 'current', 
      title: 'Current Accounts', 
      icon: WalletIcon, 
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-200 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    { 
      type: 'savings', 
      title: 'Savings Accounts', 
      icon: PiggyBankIcon, 
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-200 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    { 
      type: 'credit', 
      title: 'Credit Cards', 
      icon: CreditCardIcon, 
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-200 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    { 
      type: 'loan', 
      title: 'Loans', 
      icon: TrendingDownIcon, 
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-200 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    { 
      type: 'investment', 
      title: 'Investments', 
      icon: TrendingUpIcon, 
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-200 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    { 
      type: 'asset', 
      title: 'Assets', 
      icon: HomeIcon, 
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-200 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    },
    { 
      type: 'liability', 
      title: 'Liabilities', 
      icon: TrendingDownIcon, 
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-200 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-800'
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
    <PageWrapper 
      title="Accounts"
      rightContent={
        <div 
          onClick={() => setIsAddModalOpen(true)}
          className="cursor-pointer"
          title="Add Account"
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
      }
    >


      {/* Accounts by Category */}
      <div className="grid gap-6">
        {isLoading ? (
          // Show skeleton cards while loading
          <>
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
          </>
        ) : (
          accountTypes.map(({ type, title, icon: Icon, color }) => {
            const typeAccounts = accountsByType[type] || [];
            if (typeAccounts.length === 0) return null;

            const decimalTypeAccounts = decimalAccountsByType[type] || [];
            const typeTotal = calculateTotalBalance(decimalTypeAccounts);

            return (
            <div key={type} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border-b border-blue-200/50 dark:border-gray-600/50 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Icon className={color} size={20} />
                    <h2 className="text-base md:text-lg font-semibold text-white">{title}</h2>
                    <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      ({typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'})
                    </span>
                  </div>
                  <p className={`text-base md:text-lg font-semibold ${typeTotal.greaterThanOrEqualTo(0) ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                    {formatDisplayCurrency(typeTotal)}
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                {typeAccounts.map((account) => (
                  <div 
                    key={account.id} 
                    className="p-3 sm:p-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 hover:shadow-xl hover:border-blue-200/50 transition-all duration-300 cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on buttons or inputs
                      if ((e.target as HTMLElement).closest('button, input')) return;
                      if (onAccountClick) {
                        onAccountClick(account.id);
                      } else {
                        navigate(preserveDemoParam(`/accounts/${account.id}`, location.search));
                      }
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
                        <p className="text-xs text-gray-500 dark:text-gray-300">
                          Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
                        </p>
                        {account.openingBalance !== undefined && (
                          <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                            Opening balance: {formatDisplayCurrency(account.openingBalance, account.currency)} 
                            {account.openingBalanceDate && ` on ${new Date(account.openingBalanceDate).toLocaleDateString()}`}
                          </p>
                        )}
                        {account.type === 'investment' && account.holdings && account.holdings.length > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1 space-y-1">
                            <p>
                              Cash Balance: {formatDisplayCurrency(
                                account.balance - account.holdings.reduce((sum, h) => sum + (h.marketValue || h.value || 0), 0), 
                                account.currency
                              )}
                            </p>
                            <p>
                              Holdings Value: {formatDisplayCurrency(
                                account.holdings.reduce((sum, h) => sum + (h.marketValue || h.value || 0), 0), 
                                account.currency
                              )} ({account.holdings.length} positions)
                            </p>
                            <p className="font-medium">
                              Total Value: {formatDisplayCurrency(account.balance, account.currency)}
                            </p>
                          </div>
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
                            <div className="flex items-center gap-2">
                              <p className={`text-lg md:text-xl font-semibold w-[140px] sm:w-[180px] text-right tabular-nums whitespace-nowrap ${
                                account.balance >= 0 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-900 dark:text-white'
                              }`}>
                                {formatDisplayCurrency(account.balance, account.currency)}
                              </p>
                              <div className="flex items-center gap-1 w-[120px] sm:w-[160px] justify-start">
                              {/* Space for future icons */}
                              <div className="w-[40px] sm:w-[60px]">
                                {account.type === 'investment' && account.holdings && account.holdings.length > 0 && (
                                <button
                                  onClick={() => setPortfolioAccountId(account.id)}
                                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 rounded-lg transition-all duration-200 relative group backdrop-blur-sm"
                                  title="View Portfolio"
                                >
                                  <PieChartIcon size={16} />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    View Portfolio
                                  </span>
                                </button>
                                )}
                              </div>
                              {/* Fixed icon positions with better spacing */}
                              <div className="flex items-center gap-2">
                                <div className="relative group">
                                  <IconButton
                                    onClick={() => setSettingsAccountId(account.id)}
                                    icon={<SettingsIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[48px] min-h-[48px]"
                                    title="Account Settings"
                                  />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Settings
                                  </span>
                                </div>
                                <button
                                  onClick={() => setReconcileAccountId(account.id)}
                                  className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 relative group backdrop-blur-sm"
                                  title="Reconcile transactions"
                                >
                                  <CheckCircleIcon size={20} />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Reconcile
                                  </span>
                                </button>
                                <div className="relative group">
                                  <IconButton
                                    onClick={() => handleEdit(account.id, account.balance)}
                                    icon={<EditIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[48px] min-h-[48px]"
                                    title="Adjust balance"
                                  />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Adjust
                                  </span>
                                </div>
                                <div className="relative group">
                                  <IconButton
                                    onClick={() => handleDelete(account.id)}
                                    icon={<DeleteIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/30 min-w-[48px] min-h-[48px]"
                                    title="Delete account"
                                  />
                                  <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Delete
                                  </span>
                                </div>
                              </div>
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
        })
        )}
      </div>

      {accounts.length === 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
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
      
    </PageWrapper>
  );}
  