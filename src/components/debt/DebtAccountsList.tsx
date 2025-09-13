import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

export interface DebtAccount {
  account: Account;
  balance: number;
  apr: number;
  minimumPayment: number;
  monthlyPayment: number;
  payoffMonths: number;
  totalInterest: number;
  isSelected: boolean;
}

interface DebtAccountsListProps {
  debtAccounts: DebtAccount[];
  onToggleSelection: (accountId: string) => void;
  onUpdateAccount: (accountId: string, updates: Partial<DebtAccount>) => void;
}

export const DebtAccountsList = memo(function DebtAccountsList({
  debtAccounts,
  onToggleSelection,
  onUpdateAccount
}: DebtAccountsListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DebtAccountsList component initialized', {
      componentName: 'DebtAccountsList'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        Your Debt Accounts
      </h3>
      <div className="space-y-4">
        {debtAccounts.map(debt => (
          <div 
            key={debt.account.id} 
            className={`border rounded-lg p-4 ${
              debt.isSelected 
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-gray-900/20' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={debt.isSelected}
                  onChange={() => onToggleSelection(debt.account.id)}
                  className="w-4 h-4 text-gray-600 rounded focus:ring-gray-500"
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {debt.account.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {debt.account.type.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(debt.balance)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Balance
                </p>
              </div>
            </div>
            
            {debt.isSelected && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    APR (%)
                  </label>
                  <input
                    type="number"
                    value={(debt.apr * 100).toFixed(2)}
                    onChange={(e) => onUpdateAccount(debt.account.id, { 
                      apr: Number(e.target.value) / 100 
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Min. Payment
                  </label>
                  <input
                    type="number"
                    value={debt.minimumPayment}
                    onChange={(e) => onUpdateAccount(debt.account.id, { 
                      minimumPayment: Number(e.target.value) 
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    step="1"
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">
                      {Math.ceil(debt.balance / debt.minimumPayment)} months
                    </span>
                    <span className="text-xs"> at minimum</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});