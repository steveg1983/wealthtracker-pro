import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, TrendingUpIcon, BanknoteIcon, ChevronRightIcon, Building2Icon, CreditCardIcon, LandmarkIcon, PiggyBankIcon } from '../components/icons';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import type { Account } from '../types';

type SummaryType = 'networth' | 'assets' | 'liabilities';

interface ConvertedAccount extends Account {
  convertedBalance: number;
}

export default function NetWorthSummary() {
  const { accounts } = useApp();
  const { formatCurrency, convertAndSum, displayCurrency } = useCurrency();
  const navigate = useNavigate();
  const { type = 'networth' } = useParams<{ type: SummaryType }>();
  const [isLoading, setIsLoading] = useState(true);
  const [convertedAccounts, setConvertedAccounts] = useState<ConvertedAccount[]>([]);

  // Convert account balances to display currency
  useEffect(() => {
    let cancelled = false;

    const convertAccounts = async () => {
      setIsLoading(true);
      
      // Get relevant accounts based on type
      const getRelevantAccounts = () => {
        switch (type) {
          case 'assets':
            return accounts.filter(acc => acc.balance > 0);
          case 'liabilities':
            return accounts.filter(acc => acc.balance < 0);
          case 'networth':
          default:
            return accounts;
        }
      };
      
      const relevantAccounts = getRelevantAccounts();
      
      try {
        const converted = await Promise.all(
          relevantAccounts.map(async (account) => {
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
  }, [accounts, type, displayCurrency, convertAndSum]);

  const relevantAccounts = convertedAccounts;
  const totalAmount = relevantAccounts.reduce((sum, acc) => sum + acc.convertedBalance, 0);

  const getTitle = () => {
    switch (type) {
      case 'assets':
        return 'Total Assets';
      case 'liabilities':
        return 'Total Liabilities';
      case 'networth':
      default:
        return 'Net Worth';
    }
  };


  const getIcon = (accountType: string) => {
    switch (accountType) {
      case 'current':
        return <Building2Icon size={20} className="text-gray-600 dark:text-gray-300" />;
      case 'savings':
        return <PiggyBankIcon size={20} className="text-gray-600 dark:text-gray-300" />;
      case 'credit':
        return <CreditCardIcon size={20} className="text-gray-600 dark:text-gray-300" />;
      case 'loan':
        return <LandmarkIcon size={20} className="text-gray-600 dark:text-gray-300" />;
      case 'investment':
        return <TrendingUpIcon size={20} className="text-gray-600 dark:text-gray-300" />;
      default:
        return <BanknoteIcon size={20} className="text-gray-600 dark:text-gray-300" />;
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
  const groupedAccounts = relevantAccounts.reduce((groups, account) => {
    const type = account.type || 'other';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, typeof relevantAccounts>);

  // Calculate totals for net worth view
  const totalAssets = convertedAccounts
    .filter(acc => acc.balance > 0)
    .reduce((sum, acc) => sum + acc.convertedBalance, 0);
  const totalLiabilities = convertedAccounts
    .filter(acc => acc.balance < 0)
    .reduce((sum, acc) => sum + Math.abs(acc.convertedBalance), 0);

  const handleBackNavigation = () => {
    if (type === 'assets' || type === 'liabilities') {
      navigate('/networth');
    } else {
      // For 'networth' type or any other case, go back to dashboard (index route)
      navigate('/');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBackNavigation}
          className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Net Worth Summary</h1>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{getTitle()}</p>
          <p className={`text-4xl font-bold ${
            type === 'liabilities' 
              ? 'text-red-600 dark:text-red-400' 
              : totalAmount >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
          }`}>
            {isLoading ? '...' : formatCurrency(Math.abs(totalAmount))}
          </p>
          
          {type === 'networth' && !isLoading && (
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-2xl transition-colors"
                onClick={() => navigate('/networth/assets')}
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">Assets</p>
                <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(totalAssets)}
                </p>
              </div>
              <div 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-4 rounded-2xl transition-colors"
                onClick={() => navigate('/networth/liabilities')}
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">Liabilities</p>
                <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(totalLiabilities)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Accounts by Type */}
      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([accountType, accountsList]) => {
          const typeTotal = (accountsList as ConvertedAccount[]).reduce((sum, acc) => sum + acc.convertedBalance, 0);
          
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
                        {(accountsList as ConvertedAccount[]).length} {(accountsList as ConvertedAccount[]).length === 1 ? 'account' : 'accounts'}
                      </p>
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${
                    typeTotal >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(Math.abs(typeTotal))}
                  </p>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {(accountsList as ConvertedAccount[]).map((account) => (
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
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-semibold ${
                            account.balance >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatCurrency(Math.abs(account.convertedBalance))}
                          </p>
                          {account.currency !== displayCurrency && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {account.currency} {Math.abs(account.balance).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <ChevronRightIcon size={20} className="text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {relevantAccounts.length === 0 && !isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No {type === 'assets' ? 'assets' : type === 'liabilities' ? 'liabilities' : 'accounts'} to display
          </p>
        </div>
      )}
    </div>
  );
}