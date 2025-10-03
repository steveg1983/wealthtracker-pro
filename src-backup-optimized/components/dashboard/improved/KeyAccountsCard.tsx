import { memo, useEffect } from 'react';
import { WalletIcon, SettingsIcon, CheckIcon, XIcon } from '../../icons';
import type { Account } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface KeyAccountsCardProps {
  accounts: Account[];
  selectedAccountIds: string[];
  showAccountSettings: boolean;
  formatCurrency: (amount: number) => string;
  onToggleSettings: () => void;
  onToggleAccountSelection: (accountId: string) => void;
}

/**
 * Key accounts card component
 */
export const KeyAccountsCard = memo(function KeyAccountsCard({ accounts,
  selectedAccountIds,
  showAccountSettings,
  formatCurrency,
  onToggleSettings,
  onToggleAccountSelection
 }: KeyAccountsCardProps): React.JSX.Element {
  const logger = useLogger();
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
          <WalletIcon size={24} className="text-gray-500" />
          Key Accounts
        </h3>
        <button
          onClick={onToggleSettings}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <SettingsIcon size={20} className="text-gray-500" />
        </button>
      </div>

      {showAccountSettings ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Select accounts to display on your dashboard:
          </p>
          {accounts.map(account => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
              onClick={() => onToggleAccountSelection(account.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded ${
                  selectedAccountIds.includes(account.id)
                    ? 'bg-blue-600 flex items-center justify-center'
                    : 'border-2 border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedAccountIds.includes(account.id) && (
                    <CheckIcon size={14} className="text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {account.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {account.type}
                  </p>
                </div>
              </div>
              <span className={`font-medium ${
                account.balance >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(account.balance)}
              </span>
            </div>
          ))}
          <button
            onClick={onToggleSettings}
            className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedAccounts.length > 0 ? (
            displayedAccounts.map(account => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <WalletIcon size={20} className="text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {account.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {account.type}
                    </p>
                  </div>
                </div>
                <span className={`font-bold ${
                  account.balance >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-gray-400 mb-3">
                No accounts selected
              </p>
              <button
                onClick={onToggleSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Select Accounts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});