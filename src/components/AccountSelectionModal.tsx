import { useState } from 'react';
import { Check, AlertCircle, FileText } from 'lucide-react';

interface Account {
  name: string;
  type: string;
  balance: number;
  isPrimary?: boolean;
  transactionCount?: number;
}

interface AccountSelectionModalProps {
  isOpen: boolean;
  accounts: Account[];
  primaryAccountName?: string;
  onConfirm: (selectedAccounts: string[]) => void;
  onCancel: () => void;
}

export default function AccountSelectionModal({ 
  isOpen, 
  accounts, 
  primaryAccountName,
  onConfirm, 
  onCancel 
}: AccountSelectionModalProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set(primaryAccountName ? [primaryAccountName] : [])
  );
  const [importMode, setImportMode] = useState<'single' | 'multiple'>('single');

  const handleAccountToggle = (accountName: string) => {
    const newSelected = new Set(selectedAccounts);
    if (importMode === 'single') {
      // Single mode - only one account can be selected
      newSelected.clear();
      newSelected.add(accountName);
    } else {
      // Multiple mode - toggle selection
      if (newSelected.has(accountName)) {
        newSelected.delete(accountName);
      } else {
        newSelected.add(accountName);
      }
    }
    setSelectedAccounts(newSelected);
  };

  const handleModeChange = (mode: 'single' | 'multiple') => {
    setImportMode(mode);
    if (mode === 'single') {
      // When switching to single mode, keep only the primary account or first selected
      const firstSelected = primaryAccountName || Array.from(selectedAccounts)[0] || accounts[0]?.name;
      setSelectedAccounts(new Set(firstSelected ? [firstSelected] : []));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedAccounts));
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold dark:text-white mb-4">Select Accounts to Import</h2>

        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Multiple accounts detected</p>
              <p>We found {accounts.length} account{accounts.length > 1 ? 's' : ''} in this QIF file. 
                {primaryAccountName && ` "${primaryAccountName}" appears to be the main account.`}</p>
            </div>
          </div>
        </div>

        {/* Import Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Import Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange('single')}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                importMode === 'single'
                  ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-medium">Single Account</div>
              <div className="text-xs mt-1">Import one account with all its transactions</div>
            </button>
            <button
              onClick={() => handleModeChange('multiple')}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                importMode === 'multiple'
                  ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-medium">Multiple Accounts</div>
              <div className="text-xs mt-1">Set up all accounts (import primary transactions)</div>
            </button>
          </div>
        </div>

        {/* Account List */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Available Accounts
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {accounts.map((account) => (
              <div
                key={account.name}
                onClick={() => handleAccountToggle(account.name)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedAccounts.has(account.name)
                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {importMode === 'single' ? (
                      <input
                        type="radio"
                        checked={selectedAccounts.has(account.name)}
                        onChange={() => {}}
                        className="text-primary"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedAccounts.has(account.name)}
                        onChange={() => {}}
                        className="rounded text-primary"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </h3>
                      {account.isPrimary && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>Type: {account.type}</span>
                      {account.balance !== 0 && (
                        <span>Balance: {formatCurrency(account.balance)}</span>
                      )}
                      {account.transactionCount !== undefined && account.transactionCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText size={14} />
                          {account.transactionCount} transactions
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Message */}
        {importMode === 'multiple' && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <p>Note: When importing multiple accounts, only transactions from the primary account will be imported. 
            This helps set up your account structure for future imports.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedAccounts.size === 0}
            className={`flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 ${
              selectedAccounts.size > 0
                ? 'bg-primary text-white hover:bg-secondary'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <Check size={20} />
            Import {selectedAccounts.size} Account{selectedAccounts.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
