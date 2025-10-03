import React, { memo } from 'react';
import { ArrowLeftIcon, SettingsIcon } from '../../components/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { preserveDemoParam } from '../../utils/navigation';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Account } from '../../types';

interface AccountHeaderProps {
  account: Account;
  unreconciledTotal: number;
}

export const AccountHeader = memo(function AccountHeader({ 
  account, 
  unreconciledTotal 
}: AccountHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatCurrency } = useCurrencyDecimal();

  return (
    <>
      {/* Back button */}
      <button
        onClick={() => navigate(preserveDemoParam('/accounts', location.search))}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeftIcon size={20} />
        Back to Accounts
      </button>

      {/* Full-width header with overlaid stat boxes */}
      <div className="relative mb-6">
        <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">
            {account.name}
          </h1>
          <div className="mt-2 flex items-center gap-4">
            <div className="text-sm text-white/80">
              <span>00-00-00</span>
              <span className="ml-4">00000000</span>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Account Settings"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
        
        {/* Right side boxes - positioned absolutely over the header */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 grid grid-cols-2 gap-2">
          {/* Account Balance Box */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 px-4 py-2 flex items-center justify-between min-w-[220px] gap-4">
            <span className="text-xs text-gray-600 dark:text-gray-400">Account Balance</span>
            <span className={`text-sm font-bold ${
              account.balance >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(account.balance, account.currency)}
            </span>
          </div>
          
          {/* Bank Balance Box */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 px-4 py-2 flex items-center justify-between min-w-[220px] gap-4">
            <span className="text-xs text-gray-600 dark:text-gray-400">Bank Balance</span>
            <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
              {formatCurrency(0, account.currency)}
            </span>
          </div>
          
          {/* Unreconciled Box */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 px-4 py-2 flex items-center justify-between min-w-[220px] gap-4">
            <span className="text-xs text-gray-600 dark:text-gray-400">Unreconciled</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrency(unreconciledTotal, account.currency)}
            </span>
          </div>
          
          {/* Difference Box */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 dark:border-gray-700/50 px-4 py-2 flex items-center justify-between min-w-[220px] gap-4">
            <span className="text-xs text-gray-600 dark:text-gray-400">Difference</span>
            <span className={`text-sm font-bold ${
              account.balance === 0 
                ? 'text-gray-900 dark:text-white'
                : account.balance > 0
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(account.balance - 0, account.currency)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
});