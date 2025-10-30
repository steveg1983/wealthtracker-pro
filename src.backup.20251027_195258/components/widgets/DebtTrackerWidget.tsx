import React, { useMemo } from 'react';
import { Decimal } from '@wealthtracker/utils';
import type { DecimalInstance } from '@wealthtracker/utils';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';
import type { Account } from '../../types';

interface DebtTrackerWidgetProps {
  accounts: Account[];
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
  settings?: {
    showInterest?: boolean;
    showPayoffDate?: boolean;
  };
}

export default function DebtTrackerWidget({ 
  accounts, 
  formatCurrency, 
  navigate,
  settings = { showInterest: true, showPayoffDate: true }
}: DebtTrackerWidgetProps): React.JSX.Element {
  
  const debtAccounts = useMemo(() => {
    return accounts.filter(acc => 
      (acc.type === 'credit' || acc.type === 'loan') && 
      acc.balance < 0 &&
      acc.isActive
    ).map(acc => {
      // Calculate utilization for credit cards
      const utilization = 0;
      const isHighUtilization = false;
      
      // Skip credit limit calculation due to missing interface property
      // This would need proper Account interface extension
      
      // Estimate interest (this would ideally come from account data)
      const estimatedAPR = acc.type === 'credit' ? 19.99 : 5.99;
      const monthlyInterest = (Math.abs(acc.balance) * (estimatedAPR / 100)) / 12;
      
      // Estimate payoff time with minimum payment
      const minimumPayment = acc.type === 'credit' 
        ? Math.max(25, Math.abs(acc.balance) * 0.02) 
        : Math.abs(acc.balance) / 60; // 5-year loan assumption
      
      const monthsToPayoff = Math.ceil(
        Math.abs(acc.balance) / (minimumPayment - monthlyInterest)
      );
      
      return {
        ...acc,
        utilization,
        isHighUtilization,
        monthlyInterest,
        minimumPayment,
        monthsToPayoff,
        estimatedAPR
      };
    }).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [accounts]);
  
  const totalDebt = useMemo(() => {
    return debtAccounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  }, [debtAccounts]);
  
  const totalMonthlyInterest = useMemo(() => {
    return debtAccounts.reduce((sum, acc) => sum + acc.monthlyInterest, 0);
  }, [debtAccounts]);
  
  const highestAPR = useMemo(() => {
    if (debtAccounts.length === 0) {
      return new Decimal(0);
    }
    return debtAccounts.reduce((max, acc) => {
      const apr = new Decimal(acc.estimatedAPR ?? 0);
      return apr.greaterThan(max) ? apr : max;
    }, new Decimal(0));
  }, [debtAccounts]);

  const formatPercentage = (value: number | DecimalInstance, decimals: number = 0): string =>
    `${new Decimal(value ?? 0).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()}%`;
  
  if (debtAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <ProfessionalIcon name="creditCard" size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Debt-Free!
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You have no active credit card debt or loans. Great job!
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Total Debt
          </h3>
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalDebt)}
          </span>
        </div>
        
        {settings.showInterest && totalMonthlyInterest > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Est. Monthly Interest
            </span>
            <span className="text-red-500">
              {formatCurrency(totalMonthlyInterest)}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-600 dark:text-gray-400">
            Highest APR
          </span>
          <span className="text-gray-900 dark:text-white">
            {formatPercentage(highestAPR, 2)}
          </span>
        </div>
      </div>
      
      {/* Debt Accounts List */}
      <div className="space-y-3">
        {debtAccounts.slice(0, 3).map(account => (
          <div 
            key={account.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/accounts/${account.id}`)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center">
                <ProfessionalIcon name="creditCard" size={20} className="text-gray-400 mr-2" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {account.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {account.type === 'credit' ? 'Credit Card' : 'Loan'}
                  </p>
                </div>
              </div>
              <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(Math.abs(account.balance))}
              </span>
            </div>
            
            {/* Credit Utilization Bar (for credit cards) */}
            {account.type === 'credit' && 'creditLimit' in account && (
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>Utilization</span>
                  <span className={account.isHighUtilization ? 'text-red-500' : ''}>
                    {formatPercentage(account.utilization ?? 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      account.isHighUtilization 
                        ? 'bg-red-500' 
                        : (account.utilization ?? 0) > 30 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Decimal.min(
                        Decimal.max(new Decimal(account.utilization ?? 0), new Decimal(0)),
                        new Decimal(100)
                      ).toNumber()}%`
                    }}
                  />
                </div>
                {account.isHighUtilization && (
                  <div className="flex items-center mt-1">
                    <ProfessionalIcon name="warning" size={12} className="text-red-500 mr-1" />
                    <span className="text-xs text-red-500">High utilization</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Additional Info */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              {settings.showInterest && (
                <div className="flex items-center">
                  <ProfessionalIcon name="trendingDown" size={12} className="mr-1" />
                  <span>~{formatCurrency(account.monthlyInterest)}/mo interest</span>
                </div>
              )}
              
              {settings.showPayoffDate && account.monthsToPayoff < 999 && (
                <div className="flex items-center">
                  <ProfessionalIcon name="calendar" size={12} className="mr-1" />
                  <span>
                    {account.monthsToPayoff < 12 
                      ? `${account.monthsToPayoff} months` 
                      : `${Math.floor(account.monthsToPayoff / 12)} years`} to payoff
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* View All Link */}
      {debtAccounts.length > 3 && (
        <button
          onClick={() => navigate('/accounts?filter=debt')}
          className="w-full text-center text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium"
        >
          View all {debtAccounts.length} debt accounts →
        </button>
      )}
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('/financial-planning?tab=debt')}
          className="px-3 py-2 bg-blue-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-500 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          Payoff Planner
        </button>
        <button
          onClick={() => navigate('/reports?type=debt')}
          className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          Debt Report
        </button>
      </div>
    </div>
  );
}
