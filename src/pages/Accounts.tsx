import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { preserveDemoParam } from '../utils/navigation';
import AddAccountModal from '../components/AddAccountModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import PortfolioView from '../components/PortfolioView';
// No longer importing from lucide-react - all icons are now custom
import { DeleteIcon, SettingsIcon, WalletIcon, PiggyBankIcon, CreditCardIcon, TrendingDownIcon, TrendingUpIcon, CheckCircleIcon, HomeIcon, PieChartIcon, BankIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReconciliation } from '../hooks/useReconciliation';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { calculateTotalBalance } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import { SkeletonCard } from '../components/loading/Skeleton';

export default function Accounts({ onAccountClick }: { onAccountClick?: (accountId: string) => void }) {
  const { accounts, transactions, updateAccount, deleteAccount } = useApp();
  const { formatCurrency: formatDisplayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [portfolioAccountId, setPortfolioAccountId] = useState<string | null>(null);
  const [settingsAccountId, setSettingsAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'type' | 'institution'>(() => {
    return (localStorage.getItem('accountsGroupBy') as 'type' | 'institution') || 'type';
  });

  const { getUnreconciledCount, computeAccountBalance } = useReconciliation(accounts, transactions);

  // Convert accounts to decimal for calculations
  const decimalAccounts = useMemo(() => accounts.map(a => ({
    ...a,
    balance: toDecimal(a.balance),
    openingBalance: a.openingBalance ? toDecimal(a.openingBalance) : undefined,
    holdings: a.holdings ? a.holdings.map(h => ({
      ...h,
      shares: toDecimal(h.shares),
      value: toDecimal(h.value),
      averageCost: h.averageCost ? toDecimal(h.averageCost) : undefined,
      currentPrice: h.currentPrice ? toDecimal(h.currentPrice) : undefined,
      marketValue: h.marketValue ? toDecimal(h.marketValue) : undefined,
      gain: h.gain ? toDecimal(h.gain) : undefined,
      gainPercent: h.gainPercent ? toDecimal(h.gainPercent) : undefined,
      costBasis: h.costBasis ? toDecimal(h.costBasis) : undefined
    })) : undefined
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
  
  // Convert transactions to decimal for balance calculations
  const decimalTransactions = useMemo(() => transactions.map(t => ({
    ...t,
    amount: toDecimal(t.amount),
  })), [transactions]);

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
      color: 'text-emerald-700 dark:text-emerald-400',
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


  // Group accounts by institution
  const accountsByInstitution = useMemo(() => {
    const groups: Record<string, typeof accounts> = {};
    accounts.forEach(account => {
      const institution = account.institution || 'Other Accounts';
      if (!groups[institution]) {
        groups[institution] = [];
      }
      groups[institution].push(account);
    });
    // Sort institutions alphabetically, with "Other Accounts" last
    const sorted: Record<string, typeof accounts> = {};
    Object.keys(groups).sort((a, b) => {
      if (a === 'Other Accounts') return 1;
      if (b === 'Other Accounts') return -1;
      return a.localeCompare(b);
    }).forEach(key => { sorted[key] = groups[key]; });
    return sorted;
  }, [accounts]);

  const handleGroupByChange = (value: 'type' | 'institution') => {
    setGroupBy(value);
    localStorage.setItem('accountsGroupBy', value);
  };

  // Get icon for account type
  const getAccountTypeIcon = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === type);
    return typeConfig?.icon || WalletIcon;
  };

  const getAccountTypeColor = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === type);
    return typeConfig?.color || 'text-gray-600';
  };

  const handleDelete = (accountId: string) => {
    if (window.confirm('Are you sure you want to archive this account? It will be hidden from your accounts list but all transaction history will be preserved.')) {
      deleteAccount(accountId);
    }
  };


  return (
    <PageWrapper 
      title="Accounts"
      rightContent={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white text-sm font-medium rounded-lg hover:bg-[#2d3a4d] transition-colors shadow-sm"
          title="Add Account"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Account
        </button>
      }
    >


      {/* Net Worth Summary Bar */}
      {!isLoading && accounts.length > 0 && (() => {
        const totalBalance = calculateTotalBalance(decimalAccounts, decimalTransactions);
        const totalAssets = decimalAccounts
          .filter(a => {
            const bal = computeAccountBalance(a.id);
            return bal > 0;
          })
          .reduce((sum, a) => sum + computeAccountBalance(a.id), 0);
        const totalLiabilities = decimalAccounts
          .filter(a => {
            const bal = computeAccountBalance(a.id);
            return bal < 0;
          })
          .reduce((sum, a) => sum + Math.abs(computeAccountBalance(a.id)), 0);

        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a2332] dark:bg-gray-700 rounded-xl p-4 text-white">
              <p className="text-xs text-white/60 uppercase tracking-wider font-medium">Net Worth</p>
              <p className="text-2xl font-bold mt-1">{formatDisplayCurrency(totalBalance)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Assets</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{formatDisplayCurrency(totalAssets)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Liabilities</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{formatDisplayCurrency(totalLiabilities)}</p>
            </div>
          </div>
        );
      })()}

      {/* Group by toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Group by:</span>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
          <button
            onClick={() => handleGroupByChange('type')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              groupBy === 'type'
                ? 'bg-[#1a2332] dark:bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Account Type
          </button>
          <button
            onClick={() => handleGroupByChange('institution')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              groupBy === 'institution'
                ? 'bg-[#1a2332] dark:bg-emerald-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Institution
          </button>
        </div>
      </div>

      {/* Accounts grid */}
      <div className="grid gap-6">
        {isLoading ? (
          <>
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
          </>
        ) : groupBy === 'institution' ? (
          /* Institution grouping view */
          Object.entries(accountsByInstitution).map(([institution, instAccounts]) => {
            const instDecimalAccounts = decimalAccounts.filter(da => {
              const original = instAccounts.find(a => a.id === da.id);
              return !!original;
            });
            const instTotal = calculateTotalBalance(instDecimalAccounts, decimalTransactions);

            return (
            <div key={institution} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <BankIcon className="text-[#1a2332] dark:text-gray-400" size={20} />
                    <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{institution}</h2>
                    <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      ({instAccounts.length} {instAccounts.length === 1 ? 'account' : 'accounts'})
                    </span>
                  </div>
                  <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDisplayCurrency(instTotal)}
                  </p>
                </div>
              </div>
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {instAccounts.map(account => {
                  const balance = computeAccountBalance(account.id);
                  const unreconciledCount = getUnreconciledCount(account.id);
                  const TypeIcon = getAccountTypeIcon(account.type);
                  const typeColor = getAccountTypeColor(account.type);

                  return (
                    <div
                      key={account.id}
                      className="p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 transition-all duration-300 cursor-pointer"
                      onClick={() => onAccountClick ? onAccountClick(account.id) : navigate(preserveDemoParam(`/accounts/${account.id}`, location.search))}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <TypeIcon className={typeColor} size={16} />
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{account.type}</p>
                          </div>
                        </div>
                        <p className={`text-base font-bold ${balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {formatDisplayCurrency(balance)}
                        </p>
                      </div>
                      {unreconciledCount > 0 && (
                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          {unreconciledCount} unreconciled
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })
        ) : (
          /* Account type grouping view (original) */
          accountTypes.map(({ type, title, icon: Icon, color }) => {
            const typeAccounts = accountsByType[type] || [];
            if (typeAccounts.length === 0) return null;

            const decimalTypeAccounts = decimalAccountsByType[type] || [];
            const typeTotal = calculateTotalBalance(decimalTypeAccounts, decimalTransactions);

            return (
            <div key={type} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Icon className={color} size={20} />
                    <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                    <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                      ({typeAccounts.length} {typeAccounts.length === 1 ? 'account' : 'accounts'})
                    </span>
                  </div>
                  <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDisplayCurrency(typeTotal)}
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                {typeAccounts.map((account) => (
                  <div 
                    key={account.id} 
                    className="p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-gray-200 transition-all duration-300 cursor-pointer"
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
                        {account.institution && (
                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            {account.institution}
                          </p>
                        )}
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
                            <div className="flex items-center gap-4">
                              {/* Balance info columns */}
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Bank Bal</p>
                                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                                  {account.bankBalance != null
                                    ? formatDisplayCurrency(account.bankBalance, account.currency)
                                    : 'N/A'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Account Bal</p>
                                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                                  {formatDisplayCurrency(computeAccountBalance(account.id), account.currency)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Unreconciled</p>
                                <p className={`text-sm font-semibold tabular-nums ${
                                  getUnreconciledCount(account.id) > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {getUnreconciledCount(account.id)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
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
                                  onClick={() => navigate(preserveDemoParam(`/reconciliation?account=${account.id}`, location.search))}
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No accounts yet. Click "Add Account" to get started!
          </p>
        </div>
      )}


      <AddAccountModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
      
      {/* Balance Adjustment Modal */}
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
        onSave={async (accountId, updates) => {
          await updateAccount(accountId, updates);
        }}
      />

      <PageTip
        id="accounts-intro"
        title="Manage your accounts"
        description="Add bank accounts, credit cards, savings, and investments. Click any account to view its transactions. Use the settings icon on each account to configure alerts and reconciliation."
      />
    </PageWrapper>
  );}
  