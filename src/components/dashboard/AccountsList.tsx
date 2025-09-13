import React, { memo, useState, useEffect } from 'react';
import { WalletIcon, SettingsIcon, XIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface AccountsListProps {
  accounts: any[];
  formatCurrency: (value: number, currency?: string) => string;
  displayCurrency?: string;
  t: (key: string, defaultValue: string) => string;
  onNavigate: (path: string) => void;
}

export const AccountsList = memo(function AccountsList({
  accounts,
  formatCurrency,
  displayCurrency,
  t,
  onNavigate
}: AccountsListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AccountsList component initialized', {
      componentName: 'AccountsList'
    });
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboardKeyAccounts');
    if (saved) {
      setSelectedIds(JSON.parse(saved));
    } else {
      setSelectedIds(accounts.slice(0, 4).map(a => a.id));
    }
  }, [accounts]);

  const toggleSelection = (id: string) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter(sid => sid !== id)
      : [...selectedIds, id];
    setSelectedIds(newSelection);
    localStorage.setItem('dashboardKeyAccounts', JSON.stringify(newSelection));
  };

  const displayedAccounts = accounts.filter(a => selectedIds.includes(a.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <WalletIcon size={24} className="text-gray-500" />
          {t('dashboard.keyAccountBalances', 'Key Account Balances')}
          {displayedAccounts.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({displayedAccounts.length} {t('dashboard.of', 'of')} {accounts.length})
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label={t('dashboard.customizeAccounts', 'Customize accounts')}
        >
          <SettingsIcon size={20} className="text-gray-500" />
        </button>
      </div>
      
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('dashboard.selectAccountsToDisplay', 'Select accounts to display on dashboard:')}
            </p>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <XIcon size={16} className="text-gray-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {accounts.map(account => (
              <label
                key={account.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(account.id)}
                  onChange={() => toggleSelection(account.id)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {account.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {formatCurrency(account.balance, displayCurrency)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {displayedAccounts.length > 0 ? (
          displayedAccounts.map(account => (
            <div 
              key={account.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              onClick={() => onNavigate(`/accounts/${account.id}`)}
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {account.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {account.institution || account.subtype}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${
                  account.balance < 0
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {formatCurrency(account.balance, displayCurrency)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
            <SettingsIcon size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">{t('dashboard.noAccountsSelected', 'No accounts selected')}</p>
            <p className="text-sm mt-1">{t('dashboard.clickSettingsToSelect', 'Click the settings icon above to select accounts to display')}</p>
          </div>
        )}
      </div>
    </div>
  );
});