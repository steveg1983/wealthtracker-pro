import { memo } from 'react';
import type { Account } from '../../types';

interface AccountFilterProps {
  accounts: Account[];
  selectedAccountIds: string[];
  onAccountToggle: (accountId: string) => void;
  onClearSelection: () => void;
}

/**
 * Account filter component for forecast and seasonal tabs
 * Allows filtering data by specific accounts
 */
export const AccountFilter = memo(function AccountFilter({
  accounts,
  selectedAccountIds,
  onAccountToggle,
  onClearSelection
}: AccountFilterProps) {
  return (
    <div className="mb-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Filter by Accounts
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onClearSelection}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedAccountIds.length === 0
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All Accounts
        </button>
        {accounts.map(account => (
          <button
            key={account.id}
            onClick={() => onAccountToggle(account.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedAccountIds.includes(account.id)
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {account.name}
          </button>
        ))}
      </div>
    </div>
  );
});