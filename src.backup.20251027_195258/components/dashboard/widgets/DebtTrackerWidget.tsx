import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { CreditCardIcon, TrendingDownIcon, AlertCircleIcon } from '../../icons';
import { formatPercentageValue, toDecimal } from '@wealthtracker/utils';
import type { Account } from '../../../types';

const getAccountMetadata = (account: Account): Record<string, unknown> | null => {
  const metadata = (account as { metadata?: unknown }).metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
};

interface DebtTrackerWidgetProps {
  isCompact?: boolean;
}

export default function DebtTrackerWidget({ isCompact = false }: DebtTrackerWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const debtData = useMemo(() => {
    // Get all debt accounts (credit cards, loans)
    const debtAccounts = accounts.filter(acc => 
      acc.type === 'credit' || acc.type === 'loan' || acc.balance < 0
    );

    // Calculate total debt
    const totalDebt = debtAccounts.reduce((sum, acc) => 
      sum.plus(toDecimal(acc.balance).abs()), toDecimal(0)
    );

    // Get recent payments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPayments = transactions.filter(t => 
      new Date(t.date) >= thirtyDaysAgo &&
      t.type === 'transfer' &&
      debtAccounts.some(acc => acc.id === t.accountId)
    );

    const totalPayments = recentPayments.reduce((sum, t) => 
      sum.plus(toDecimal(t.amount).abs()), toDecimal(0)
    );

    // Find highest APR
    const highestAPRDecimal = debtAccounts.reduce((max, acc) => {
      const metadata = getAccountMetadata(acc);
      const aprValue = metadata && typeof metadata.apr === 'number' ? toDecimal(metadata.apr) : toDecimal(0);
      return aprValue.greaterThan(max) ? aprValue : max;
    }, toDecimal(0));

    // Sort by balance (highest first)
    const sortedDebts = [...debtAccounts].sort((a, b) => 
      Math.abs(b.balance) - Math.abs(a.balance)
    );

    return {
      totalDebt,
      debtAccounts: sortedDebts,
      accountCount: debtAccounts.length,
      recentPayments: totalPayments,
      highestAPR: highestAPRDecimal
    };
  }, [accounts, transactions]);

  if (debtData.accountCount === 0) {
    return (
      <div className="text-center py-8">
        <CreditCardIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No debt accounts found</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Add credit cards or loans to track debt
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total Debt Summary */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-red-700 dark:text-red-300">Total Debt</span>
          <TrendingDownIcon size={16} className="text-red-600" />
        </div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
          {formatCurrency(debtData.totalDebt)}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {debtData.accountCount} {debtData.accountCount === 1 ? 'account' : 'accounts'}
          </span>
          {debtData.highestAPR.greaterThan(0) && (
            <span className="text-red-600 dark:text-red-400">
              Up to {formatPercentageValue(debtData.highestAPR, 2)} APR
            </span>
          )}
        </div>
      </div>

      {/* Recent Payments */}
          {debtData.recentPayments.greaterThan(0) && (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm text-green-700 dark:text-green-300">
                Paid Last 30 Days
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(debtData.recentPayments)}
              </span>
            </div>
          )}

      {/* Debt Accounts List */}
      <div className="space-y-2">
        {debtData.debtAccounts.slice(0, isCompact ? 3 : 5).map(account => {
          const balanceDecimal = toDecimal(account.balance).abs();
          const metadata = getAccountMetadata(account);
          const limit = metadata && typeof metadata.creditLimit === 'number' ? metadata.creditLimit : 0;
          const limitDecimal = toDecimal(limit);
          const utilizationDecimal = limitDecimal.greaterThan(0)
            ? balanceDecimal.dividedBy(limitDecimal).times(100)
            : toDecimal(0);
          const utilization = utilizationDecimal.toNumber();
          
          return (
            <div key={account.id} className="border-b border-gray-200 dark:border-gray-700 pb-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {account.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {account.type === 'credit' ? 'Credit Card' : 'Loan'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm text-red-600 dark:text-red-400">
                  {formatCurrency(balanceDecimal)}
                </div>
                {utilization > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatPercentageValue(utilizationDecimal, 0)} utilized
                  </div>
                )}
              </div>
            </div>
              
              {/* Utilization Bar */}
              {limit > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all ${
                        utilization > 90 ? 'bg-red-600' :
                        utilization > 70 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* High Utilization Warning */}
      {debtData.debtAccounts.some(acc => {
        const metadata = getAccountMetadata(acc);
        const limit = metadata && typeof metadata.creditLimit === 'number' ? metadata.creditLimit : 0;
        const limitDecimal = toDecimal(limit);
        const utilizationDecimal = limitDecimal.greaterThan(0)
          ? toDecimal(acc.balance).abs().dividedBy(limitDecimal).times(100)
          : toDecimal(0);
        return utilizationDecimal.greaterThan(90);
      }) && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300">
          <AlertCircleIcon size={14} />
          <span>High credit utilization detected</span>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={() => navigate('/accounts?filter=debt')}
        className="w-full text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 text-center py-2"
      >
        Manage Debt →
      </button>
    </div>
  );
}
