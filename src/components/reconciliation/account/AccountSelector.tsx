import React, { useEffect } from 'react';
import { ChevronRightIcon, Building2Icon, CreditCardIcon, CheckCircleIcon } from '../../icons';
import type { Account } from '../../../types';
import { logger } from '../../../services/loggingService';

interface ReconciliationSummary {
  account: Account;
  unreconciledCount: number;
  totalToReconcile: number;
  lastImportDate: Date | null;
}

interface AccountSelectorProps {
  totalUnreconciledCount: number;
  accountSummaries: ReconciliationSummary[];
  formatCurrency: (amount: number) => string;
  onSelectAccount: (accountId: string) => void;
}

export function AccountSelector({
  totalUnreconciledCount,
  accountSummaries,
  formatCurrency,
  onSelectAccount
}: AccountSelectorProps): React.JSX.Element {
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (totalUnreconciledCount === 0) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-8 text-center border border-white/20 dark:border-gray-700/50">
        <CheckCircleIcon className="mx-auto text-green-500 mb-4" size={64} />
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          All accounts reconciled!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Great job! All your transactions are reconciled.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-800 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-full">
              <CheckCircleIcon className="text-orange-700 dark:text-orange-200" size={20} />
            </div>
          </div>
          <div>
            <h3 className="font-medium text-orange-900 dark:text-orange-100">
              {totalUnreconciledCount} transactions to reconcile
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
              Select an account below to start reconciling transactions.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <div className="grid gap-4">
          {accountSummaries.map(({ account, unreconciledCount, totalToReconcile, lastImportDate }) => (
            <div
              key={account.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSelectAccount(account.id)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {account.type === 'credit' ? (
                        <CreditCardIcon className="text-gray-400" size={24} />
                      ) : (
                        <Building2Icon className="text-gray-400" size={24} />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {account.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {account.institution} • Last import: {formatDate(lastImportDate)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Transactions to reconcile</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{unreconciledCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total amount</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(totalToReconcile)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ChevronRightIcon size={24} className="text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}