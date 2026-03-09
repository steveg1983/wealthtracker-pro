import React from 'react';
import { Building2Icon, ChevronRightIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { ReconciliationSummary } from '../../hooks/useReconciliation';

interface ReconciliationAccountListProps {
  summaries: ReconciliationSummary[];
  onSelectAccount: (accountId: string) => void;
}

export default function ReconciliationAccountList({
  summaries,
  onSelectAccount,
}: ReconciliationAccountListProps): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No accounts to reconcile</p>
        <p className="text-sm mt-1">All accounts are fully reconciled</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {summaries.map(({ account, unreconciledCount, bankBalance, accountBalance, difference }) => {
        const hasDifference = difference != null && Math.abs(difference) > 0.005;

        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelectAccount(account.id)}
            className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl border-2 transition-all hover:shadow-md ${
              hasDifference
                ? 'border-amber-400 dark:border-amber-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary'
            } p-5`}
          >
            <div className="flex items-center gap-4">
              {/* Icon + Name */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
                  <Building2Icon size={20} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {account.institution ?? account.type}
                  </p>
                </div>
              </div>

              {/* Unreconciled badge */}
              <div className="min-w-[120px]">
                {unreconciledCount > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {unreconciledCount} unreconciled
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    All cleared
                  </span>
                )}
              </div>

              {/* Spacer to push balances right */}
              <div className="flex-1" />

              {/* Balance columns — spread across */}
              <div className="text-right min-w-[120px]">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Bank Balance</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {bankBalance != null
                    ? formatCurrency(bankBalance, account.currency)
                    : 'N/A'}
                </p>
              </div>
              <div className="text-right min-w-[120px]">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Account Balance</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(accountBalance, account.currency)}
                </p>
              </div>
              <div className="text-right min-w-[100px]">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Difference</p>
                <p className={`text-sm font-bold tabular-nums ${
                  difference == null
                    ? 'text-gray-400'
                    : Math.abs(difference) < 0.005
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {difference != null
                    ? formatCurrency(difference, account.currency)
                    : 'N/A'}
                </p>
              </div>
              <ChevronRightIcon size={20} className="text-gray-400 flex-shrink-0 ml-2" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
