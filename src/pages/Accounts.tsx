import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { DataService } from '../services/api/dataService';
import { preserveDemoParam } from '../utils/navigation';
import AddAccountModal from '../components/AddAccountModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import PortfolioView from '../components/PortfolioView';
// No longer importing from lucide-react - all icons are now custom
import { ArchiveIcon, SettingsIcon, WalletIcon, PiggyBankIcon, CreditCardIcon, TrendingDownIcon, TrendingUpIcon, CheckCircleIcon, HomeIcon, PieChartIcon, BankIcon, RefreshCwIcon, AlertTriangleIcon, ChevronRightIcon, ChevronDownIcon } from '../components/icons';
import type { Account } from '../types';

type AccountSortMode = 'default' | 'name' | 'balance-desc' | 'balance-asc';
import { IconButton } from '../components/icons/IconButton';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReconciliation } from '../hooks/useReconciliation';
import { useAccountBankSync } from '../hooks/useAccountBankSync';
import PageWrapper from '../components/PageWrapper';
import PageTip from '../components/PageTip';
import { calculateTotalBalance } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import { SkeletonCard } from '../components/loading/Skeleton';

export default function Accounts({ onAccountClick }: { onAccountClick?: (accountId: string) => void }) {
  const { accounts, transactions, updateAccount, deleteAccount, refreshAccountsAndTransactions, refreshCategories } = useApp();
  const { showError } = useToast();
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
  const [sortMode, setSortMode] = useState<AccountSortMode>(() => {
    const stored = localStorage.getItem('accountsSortMode');
    return stored === 'name' || stored === 'balance-desc' || stored === 'balance-asc'
      ? stored
      : 'default';
  });

  const { getUnreconciledCount, computeAccountBalance } = useReconciliation(accounts, transactions);
  // Per-account bank connection metadata + one-click "pull fresh bank data".
  const { getAccountLink, isAccountSyncing, syncAccount } = useAccountBankSync({ onSynced: refreshAccountsAndTransactions });

  // Only OPEN accounts appear in the main list and totals; closed ones live in
  // the Closed Accounts section below (the Microsoft Money model — closing
  // hides an account without touching its history, and it can be reopened).
  const openAccounts = useMemo(() => accounts.filter(a => a.isActive !== false), [accounts]);
  const [closedAccounts, setClosedAccounts] = useState<Account[]>([]);
  const [showClosedAccounts, setShowClosedAccounts] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const loadClosedAccounts = useCallback(async () => {
    try {
      setClosedAccounts(await DataService.getClosedAccounts());
    } catch {
      // Non-fatal: the section simply shows empty; a retry happens on next open.
      setClosedAccounts([]);
    }
  }, []);

  useEffect(() => {
    void loadClosedAccounts();
  }, [loadClosedAccounts]);

  const handleReopenAccount = useCallback(async (accountId: string) => {
    if (reopeningId) return;
    setReopeningId(accountId);
    try {
      await updateAccount(accountId, { isActive: true });
      // The reopened account isn't in context state (closed ones are filtered
      // out at load), so re-pull actives and refresh the closed list. The DB
      // trigger also re-activated its transfer category — refresh categories
      // so it reappears in dropdowns without a reload.
      await refreshAccountsAndTransactions();
      await refreshCategories();
      await loadClosedAccounts();
    } catch (error) {
      showError(error);
    } finally {
      setReopeningId(null);
    }
  }, [reopeningId, updateAccount, refreshAccountsAndTransactions, refreshCategories, loadClosedAccounts, showError]);

  // Convert accounts to decimal for calculations
  const decimalAccounts = useMemo(() => openAccounts.map(a => ({
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
  })), [openAccounts]);

  // Group accounts by type (memoized)
  const accountsByType = useMemo(() =>
    openAccounts.reduce((groups, account) => {
      const type = account.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<string, typeof accounts>),
    [openAccounts]
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
      color: 'text-blue-700 dark:text-blue-400',
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
    openAccounts.forEach(account => {
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
  }, [openAccounts]);

  const handleGroupByChange = (value: 'type' | 'institution') => {
    setGroupBy(value);
    localStorage.setItem('accountsGroupBy', value);
  };

  const handleSortChange = (value: AccountSortMode) => {
    setSortMode(value);
    localStorage.setItem('accountsSortMode', value);
  };

  // Order accounts WITHIN each group. 'default' keeps insertion order (as
  // loaded); balance sorts use Decimal comparison on the computed ledger
  // balance — ordering only, never arithmetic.
  const sortAccounts = useCallback((list: Account[]): Account[] => {
    if (sortMode === 'default') {
      return list;
    }
    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else {
      sorted.sort((a, b) => {
        const comparison = toDecimal(computeAccountBalance(a.id))
          .comparedTo(toDecimal(computeAccountBalance(b.id)));
        return sortMode === 'balance-desc' ? -comparison : comparison;
      });
    }
    return sorted;
  }, [sortMode, computeAccountBalance]);

  // Get icon for account type
  const getAccountTypeIcon = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === type);
    return typeConfig?.icon || WalletIcon;
  };

  const getAccountTypeColor = (type: string) => {
    const typeConfig = accountTypes.find(t => t.type === type);
    return typeConfig?.color || 'text-gray-600';
  };

  const handleClose = (accountId: string) => {
    if (window.confirm('Close this account? It moves to the Closed Accounts section — every transaction is preserved and you can reopen it at any time. Its transfer category is hidden from transaction dropdowns while closed.')) {
      void (async () => {
        try {
          await deleteAccount(accountId);
          // The DB trigger deactivated the account's transfer category —
          // refresh categories so it leaves dropdowns without a reload.
          await refreshCategories();
          await loadClosedAccounts();
        } catch (error) {
          showError(error);
        }
      })();
    }
  };


  // ONE card for every grouping view — identical layout, stats and actions
  // (settings / sync / reconcile / close) regardless of how the list is
  // grouped (Steve: 'similar looking format across all our views').
  const renderAccountCard = (account: Account) => {
    const bankLink = getAccountLink(account.id);
    const syncing = isAccountSyncing(account.id);
    const TypeIcon = getAccountTypeIcon(account.type);
    const typeColor = getAccountTypeColor(account.type);
                  return (
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
                        <div className="flex items-center gap-2">
                          <TypeIcon className={typeColor} size={16} />
                          <h3 className="text-base md:text-lg font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {account.name}
                          </h3>
                        </div>
                        {account.institution && (
                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                            {account.institution}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-300">
                          Last updated: {new Date(account.lastUpdated).toLocaleDateString()}
                        </p>
                        {bankLink && (
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            Last bank sync:{' '}
                            {bankLink.lastSync
                              ? new Date(bankLink.lastSync).toLocaleString()
                              : 'Never'}
                            {bankLink.status === 'reauth_required' && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400">
                                · reconnect needed
                              </span>
                            )}
                          </p>
                        )}
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
                                    : 'text-blue-600 dark:text-blue-400'
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
                                {bankLink && (bankLink.status === 'reauth_required' ? (
                                  <div className="relative group">
                                    <IconButton
                                      onClick={() => navigate(preserveDemoParam('/open-banking', location.search))}
                                      icon={<AlertTriangleIcon size={20} />}
                                      variant="ghost"
                                      size="md"
                                      className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 min-w-[48px] min-h-[48px]"
                                      title="Reconnect bank"
                                    />
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                      Reconnect bank
                                    </span>
                                  </div>
                                ) : (
                                  <div className="relative group">
                                    <IconButton
                                      onClick={() => void syncAccount(account.id)}
                                      icon={<RefreshCwIcon size={20} className={syncing ? 'animate-spin' : ''} />}
                                      variant="ghost"
                                      size="md"
                                      disabled={syncing}
                                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 min-w-[48px] min-h-[48px]"
                                      title="Sync bank data"
                                    />
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                      {syncing ? 'Syncing…' : 'Sync bank data'}
                                    </span>
                                  </div>
                                ))}
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
                                    onClick={() => handleClose(account.id)}
                                    icon={<ArchiveIcon size={20} />}
                                    variant="ghost"
                                    size="md"
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-900/30 min-w-[48px] min-h-[48px]"
                                    title="Close account"
                                  />
                                  <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
                                    Close
                                  </span>
                                </div>
                              </div>
                            </div>
                      </div>
                    </div>
                  </div>
    );
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


      {/* Desktop: the net-worth summary + controls stay pinned while the
          account list scrolls in its own region — Add Account, view switches
          and the totals remain reachable from anywhere in a long list. */}
      <div className="lg:flex lg:flex-col lg:h-[calc(100vh-13rem)]">
      <div className="lg:shrink-0">
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
              <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{formatDisplayCurrency(totalAssets)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Liabilities</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{formatDisplayCurrency(totalLiabilities)}</p>
            </div>
          </div>
        );
      })()}

      {/* Group + sort controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Group by:</span>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              onClick={() => handleGroupByChange('type')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                groupBy === 'type'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Account Type
            </button>
            <button
              onClick={() => handleGroupByChange('institution')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                groupBy === 'institution'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Institution
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            <button
              onClick={() => handleSortChange('default')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'default'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Default
            </button>
            <button
              onClick={() => handleSortChange('name')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'name'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Name A–Z
            </button>
            <button
              onClick={() => handleSortChange(sortMode === 'balance-desc' ? 'balance-asc' : 'balance-desc')}
              title={sortMode === 'balance-desc'
                ? 'Sorted highest value first — click for lowest first'
                : sortMode === 'balance-asc'
                  ? 'Sorted lowest value first — click for highest first'
                  : 'Sort by account value'}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                sortMode === 'balance-desc' || sortMode === 'balance-asc'
                  ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Value {sortMode === 'balance-asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      </div>{/* end pinned chrome */}

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
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
              <div className="p-3 sm:p-4 space-y-3">
                {sortAccounts(instAccounts).map(renderAccountCard)}
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
                {sortAccounts(typeAccounts).map(renderAccountCard)}
              </div>
            </div>
          );
        })
        )}
      </div>

      {openAccounts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No accounts yet. Click "Add Account" to get started!
          </p>
        </div>
      )}

      {/* Closed Accounts (Microsoft Money model: hidden, never deleted) */}
      {closedAccounts.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowClosedAccounts(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              {showClosedAccounts ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
              Closed Accounts ({closedAccounts.length})
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              History preserved — reopen any time
            </span>
          </button>

          {showClosedAccounts && (
            <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {closedAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {account.name}
                    </p>
                    {account.institution && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {account.institution}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {formatDisplayCurrency(account.balance, account.currency)}
                    </p>
                    <button
                      onClick={() => void handleReopenAccount(account.id)}
                      disabled={reopeningId !== null}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reopeningId === account.id ? 'Reopening…' : 'Reopen'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </div>{/* end scroll region */}
      </div>{/* end desktop flex column */}

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
          // Closing/reopening (or renaming) via settings also updates the
          // account's transfer category via the DB trigger — keep the Closed
          // Accounts section and category dropdowns in sync without a reload.
          if (updates.isActive !== undefined) {
            await loadClosedAccounts();
          }
          if (updates.isActive !== undefined || updates.name !== undefined) {
            await refreshCategories();
          }
        }}
      />

      <PageTip
        id="accounts-intro"
        title="Manage your accounts"
        description="Add bank accounts, credit cards, savings, and investments. Click any account to view its transactions. Use the settings icon on each account to configure alerts and reconciliation."
      />
    </PageWrapper>
  );}
  