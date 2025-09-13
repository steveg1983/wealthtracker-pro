import React, { useEffect, memo } from 'react';
import { CreditCardIcon, SettingsIcon, CheckIcon, ChevronRightIcon } from '../icons';
import type { Account } from '../../types';
import { logger } from '../../services/loggingService';

interface KeyAccountsCardProps {
  accounts: Account[];
  selectedAccountIds: string[];
  showAccountSettings: boolean;
  formatCurrency: (value: number) => string;
  t: (key: string, defaultValue: string) => string;
  onToggleSettings: () => void;
  onToggleAccount: (id: string) => void;
  onNavigateToAccount?: (id: string) => void;
}

export const KeyAccountsCard = memo(function KeyAccountsCard({
  accounts,
  selectedAccountIds,
  showAccountSettings,
  formatCurrency,
  t,
  onToggleSettings,
  onToggleAccount,
  onNavigateToAccount
}: KeyAccountsCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('KeyAccountsCard component initialized', {
      componentName: 'KeyAccountsCard'
    });
  }, []);

  const displayedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCardIcon size={20} className="text-gray-500" />
          {t('dashboard.keyAccounts', 'Key Accounts')}
        </h3>
        <button
          onClick={onToggleSettings}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Account Settings Panel */}
      {showAccountSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {t('dashboard.selectAccountsToDisplay', 'Select accounts to display')}
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {accounts.map(account => (
              <label 
                key={account.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-800 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedAccountIds.includes(account.id)}
                  onChange={() => onToggleAccount(account.id)}
                  className="text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {account.name}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(account.balance)}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={onToggleSettings}
            className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <CheckIcon size={14} />
            {t('common.done', 'Done')}
          </button>
        </div>
      )}

      {/* Displayed Accounts */}
      {displayedAccounts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t('dashboard.selectAccountsToView', 'Click settings to select accounts to view')}
        </p>
      ) : (
        <div className="space-y-3">
          {displayedAccounts.map(account => (
            <div 
              key={account.id}
              onClick={() => onNavigateToAccount?.(account.id)}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {account.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {account.type} • {account.institution || t('dashboard.noInstitution', 'No institution')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${
                  account.balance >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(account.balance)}
                </span>
                <ChevronRightIcon size={16} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});