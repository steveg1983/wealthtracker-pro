import { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';
import { useApp } from '../contexts/AppContextSupabase';
import type { Account as BaseAccount } from '../types';

// Extend the base Account type with additional fields needed for settings
interface Account extends BaseAccount {
  type: "current" | "savings" | "credit" | "loan" | "investment" | "assets" | "other";
  sortCode?: string;
  accountNumber?: string;
}

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (accountId: string, updates: Partial<Account>) => void;
}

interface FormData {
  type: Account['type'];
  openingBalance: string;
  openingBalanceDate: string;
  sortCode: string;
  accountNumber: string;
  institution: string;
  notes: string;
}

const accountTypeOptions = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'loan', label: 'Loan Account' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'investment', label: 'Investments' },
  { value: 'assets', label: 'Other Asset' },
  { value: 'other', label: 'Other Liability' }
];

export default function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onSave
}: AccountSettingsModalProps) {
  const { accounts } = useApp();
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    {
      type: 'current',
      openingBalance: '',
      openingBalanceDate: '',
      sortCode: '',
      accountNumber: '',
      institution: '',
      notes: ''
    },
    {
      onSubmit: (data) => {
        if (!account) return;
        
        // Professional validation for bank details
        if (data.sortCode && data.accountNumber && 
            data.sortCode !== '00-00-00' && data.accountNumber !== '00000000') {
          const duplicate = accounts.find(a => 
            a.sortCode === data.sortCode && 
            a.accountNumber === data.accountNumber &&
            a.id !== account.id // Exclude current account from check
          );
          
          if (duplicate) {
            setValidationError(`These bank details are already used by '${duplicate.name}'`);
            return;
          }
        }

        const updates: Partial<Account> = {
          type: data.type,
          institution: data.institution || undefined,
          notes: data.notes || undefined,
          sortCode: data.sortCode || undefined,
          accountNumber: data.accountNumber || undefined
        };

        if (data.openingBalance) {
          updates.openingBalance = parseFloat(data.openingBalance);
          updates.openingBalanceDate = new Date(data.openingBalanceDate);
        }

        onSave(account.id, updates);
      },
      onClose
    }
  );

  useEffect(() => {
    if (account) {
      setFormData({
        type: account.type || 'current',
        openingBalance: account.openingBalance?.toString() || '',
        openingBalanceDate: account.openingBalanceDate 
          ? new Date(account.openingBalanceDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        sortCode: account.sortCode || '',
        accountNumber: account.accountNumber || '',
        institution: account.institution || '',
        notes: account.notes || ''
      });
    }
  }, [account, setFormData]);


  const formatSortCode = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as XX-XX-XX
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  const handleSortCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSortCode(e.target.value);
    updateField('sortCode', formatted);
    setValidationError(null); // Clear error when user types
  };
  
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 8);
    updateField('accountNumber', cleaned);
    setValidationError(null); // Clear error when user types
  };
  
  // Check if account type should show bank details
  const shouldShowBankDetails = (): boolean => {
    const bankAccountTypes = ['current', 'checking', 'savings', 'loan', 'credit', 'investment', 'mortgage'];
    return bankAccountTypes.includes(formData.type);
  };

  if (!account) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Account Settings" size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-4">
            {account.name}
          </p>
          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value as Account['type'])}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Changing the type will relocate this account to the appropriate section
            </p>
          </div>

          {/* Opening Balance */}
          <div>
            <label htmlFor="opening-balance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Opening Balance
            </label>
            <div className="space-y-2">
              <input
                id="opening-balance"
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => updateField('openingBalance', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                aria-label="Opening balance amount"
              />
              <input
                id="opening-balance-date"
                type="date"
                value={formData.openingBalanceDate}
                onChange={(e) => updateField('openingBalanceDate', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                aria-label="Opening balance date"
              />
            </div>
          </div>

          {/* Bank Details - Professional approach for all relevant account types */}
          {shouldShowBankDetails() && (
            <>
              <div>
                <label htmlFor="sort-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort Code
                </label>
                <input
                  id="sort-code"
                  type="text"
                  value={formData.sortCode}
                  onChange={handleSortCodeChange}
                  placeholder="XX-XX-XX"
                  maxLength={8}
                  className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${validationError ? 'border-red-500' : 'border-gray-300/50 dark:border-gray-600/50'} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
                  aria-label="Bank sort code"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Used for automatic transaction import matching
                </p>
              </div>

              <div>
                <label htmlFor="account-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account Number
                </label>
                <input
                  id="account-number"
                  type="text"
                  value={formData.accountNumber}
                  onChange={handleAccountNumberChange}
                  placeholder="12345678"
                  aria-label="Bank account number"
                  maxLength={8}
                  className={`w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border ${validationError ? 'border-red-500' : 'border-gray-300/50 dark:border-gray-600/50'} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white`}
                />
              </div>
              
              {/* Professional validation error message */}
              {validationError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validationError}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Institution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Institution
            </label>
            <input
              type="text"
              value={formData.institution}
              onChange={(e) => updateField('institution', e.target.value)}
              placeholder="Bank or financial institution name"
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              placeholder="Additional information about this account"
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white resize-none"
            />
          </div>

        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3 w-full">
            <button
              type="submit"
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}