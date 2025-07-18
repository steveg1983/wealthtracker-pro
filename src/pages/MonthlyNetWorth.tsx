import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon, BanknoteIcon, Building2Icon, CreditCardIcon, LandmarkIcon, PiggyBankIcon } from '../components/icons';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

export default function MonthlyNetWorth() {
  const { accounts } = useApp();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  // const { month } = useParams<{ month: string }>();
  const [isLoading, setIsLoading] = useState(true);
  interface ConvertedAccount {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
    institution?: string;
    convertedBalance: number;
  }
  
  const [convertedAccounts, setConvertedAccounts] = useState<ConvertedAccount[]>([]);

  // Convert account balances to display currency
  useEffect(() => {
    let cancelled = false;

    const convertAccounts = async () => {
      setIsLoading(true);
      
      try {
        const converted = await Promise.all(
          accounts.map(async (account) => {
            const convertedBalance = await convertAndSum([{ 
              amount: account.balance, 
              currency: account.currency 
            }]);
            return {
              ...account,
              convertedBalance
            };
          })
        );
        
        if (!cancelled) {
          setConvertedAccounts(converted);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error converting accounts:', error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    convertAccounts();

    return () => {
      cancelled = true;
    };
  }, [accounts, displayCurrency, convertAndSum]);

  // Calculate totals
  const totalAssets = convertedAccounts
    .filter(acc => acc.balance > 0)
    .reduce((sum, acc) => sum + acc.convertedBalance, 0);
  
  const totalLiabilities = convertedAccounts
    .filter(acc => acc.balance < 0)
    .reduce((sum, acc) => sum + Math.abs(acc.convertedBalance), 0);
  
  const netWorth = totalAssets - totalLiabilities;

  // Separate assets and liabilities
  const assetAccounts = convertedAccounts.filter(acc => acc.balance > 0);
  const liabilityAccounts = convertedAccounts.filter(acc => acc.balance < 0);

  const getIcon = (accountType: string) => {
    switch (accountType) {
      case 'current':
        return <Building2Icon size={20} className="text-gray-500" />;
      case 'savings':
        return <PiggyBankIcon size={20} className="text-gray-500" />;
      case 'credit':
        return <CreditCardIcon size={20} className="text-gray-500" />;
      case 'loan':
        return <LandmarkIcon size={20} className="text-gray-500" />;
      case 'investment':
        return <TrendingUpIcon size={20} className="text-gray-500" />;
      default:
        return <BanknoteIcon size={20} className="text-gray-500" />;
    }
  };

  const getAccountTypeLabel = (accountType: string) => {
    switch (accountType) {
      case 'current':
        return 'Current Account';
      case 'savings':
        return 'Savings Account';
      case 'credit':
        return 'Credit Card';
      case 'loan':
        return 'Loan';
      case 'investment':
        return 'Investment';
      default:
        return 'Other';
    }
  };

  // Group accounts by type
  const groupAccountsByType = (accountList: ConvertedAccount[]) => {
    return accountList.reduce((groups, account) => {
      const type = account.type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(account);
      return groups;
    }, {} as Record<string, ConvertedAccount[]>);
  };

  const groupedAssets = groupAccountsByType(assetAccounts);
  const groupedLiabilities = groupAccountsByType(liabilityAccounts);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">
            Monthly Net Worth
          </h1>
        </div>
      </div>

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Worth</p>
              <p className={`text-2xl font-bold ${
                netWorth >= 0 
                  ? 'text-gray-900 dark:text-white' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isLoading ? '...' : formatCurrency(netWorth)}
              </p>
            </div>
            <BanknoteIcon className="text-primary" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Assets</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {isLoading ? '...' : formatCurrency(totalAssets)}
              </p>
            </div>
            <TrendingUpIcon className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Liabilities</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {isLoading ? '...' : formatCurrency(totalLiabilities)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>
        </div>

        <div className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assets Section */}
        <div>
          <h2 className="text-2xl font-bold text-theme-heading dark:text-white mb-6">Assets</h2>
          {Object.keys(groupedAssets).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No assets to display</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssets).map(([accountType, accountsList]) => {
                const typeTotal = accountsList.reduce((sum, acc) => sum + acc.convertedBalance, 0);
                
                return (
                  <div key={accountType} className="bg-white dark:bg-gray-800 rounded-2xl shadow">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getIcon(accountType)}
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {getAccountTypeLabel(accountType)}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {accountsList.length} {accountsList.length === 1 ? 'account' : 'accounts'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(typeTotal)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {accountsList.map((account) => (
                        <div
                          key={account.id}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          onClick={() => navigate(`/transactions?account=${account.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {account.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {account.institution || 'No institution'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(account.convertedBalance)}
                              </p>
                              {account.currency !== displayCurrency && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {account.currency} {account.balance.toLocaleString()}
                                </p>
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
          )}
        </div>

        {/* Liabilities Section */}
        <div>
          <h2 className="text-2xl font-bold text-theme-heading dark:text-white mb-6">Liabilities</h2>
          {Object.keys(groupedLiabilities).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No liabilities to display</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedLiabilities).map(([accountType, accountsList]) => {
                const typeTotal = accountsList.reduce((sum, acc) => sum + Math.abs(acc.convertedBalance), 0);
                
                return (
                  <div key={accountType} className="bg-white dark:bg-gray-800 rounded-2xl shadow">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getIcon(accountType)}
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {getAccountTypeLabel(accountType)}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {accountsList.length} {accountsList.length === 1 ? 'account' : 'accounts'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(typeTotal)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {accountsList.map((account) => (
                        <div
                          key={account.id}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          onClick={() => navigate(`/transactions?account=${account.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {account.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {account.institution || 'No institution'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600 dark:text-red-400">
                                {formatCurrency(Math.abs(account.convertedBalance))}
                              </p>
                              {account.currency !== displayCurrency && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {account.currency} {Math.abs(account.balance).toLocaleString()}
                                </p>
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
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}