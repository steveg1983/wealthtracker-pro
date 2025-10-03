import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { 
  BuildingIcon as Building2,
  WalletIcon as Wallet,
  CreditCardIcon as CreditCard,
  TrendingUpIcon as TrendingUp,
  PiggyBankIcon as PiggyBank,
  BanknoteIcon as Banknote,
  PackageIcon as Package,
  AlertCircleIcon as AlertCircle
} from './icons';
import { logger } from '../services/loggingService';
import type { Account } from '../types';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountFormData {
  name: string;
  type: 'current' | 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other';
  balance: string;
  currency: string;
  institution: string;
  sortCode: string;
  accountNumber: string;
}

const accountTypes = [
  { value: 'current', label: 'Current Account', icon: Wallet, description: 'Everyday spending account' },
  { value: 'savings', label: 'Savings Account', icon: PiggyBank, description: 'Long-term savings' },
  { value: 'credit', label: 'Credit Card', icon: CreditCard, description: 'Credit line account' },
  { value: 'loan', label: 'Loan', icon: Banknote, description: 'Mortgages, personal loans' },
  { value: 'investment', label: 'Investment', icon: TrendingUp, description: 'Stocks, bonds, funds' },
  { value: 'assets', label: 'Other Assets', icon: Package, description: 'Property, valuables' },
];

const currencies = [
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
];

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps): React.JSX.Element {
  const { accounts, addAccount } = useApp();
  const { currency: defaultCurrency } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    bankDetails?: string;
  }>({});
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'current',
    balance: '',
    currency: defaultCurrency,
    institution: '',
    sortCode: '',
    accountNumber: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: defaultCurrency,
        institution: '',
        sortCode: '',
        accountNumber: ''
      });
      setError(null);
      setValidationErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, defaultCurrency]);

  // Professional validation functions
  const validateAccountName = (name: string): string | undefined => {
    if (!name.trim()) return undefined;
    const duplicate = accounts.find(a => 
      a.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return `An account named '${duplicate.name}' already exists`;
    }
    return undefined;
  };

  const validateBankDetails = (sortCode: string, accountNumber: string): string | undefined => {
    // Don't validate if empty or default values
    if (!sortCode || !accountNumber) return undefined;
    if (sortCode === '00-00-00' && accountNumber === '00000000') return undefined;
    
    const duplicate = accounts.find(a => 
      a.sortCode === sortCode && 
      a.accountNumber === accountNumber
    );
    if (duplicate) {
      return `These bank details are already used by '${duplicate.name}'`;
    }
    return undefined;
  };

  const formatSortCode = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as XX-XX-XX
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  const updateField = <K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) => {
    let processedValue = value;
    
    // Format sort code if that's what's being updated
    if (field === 'sortCode' && typeof value === 'string') {
      processedValue = formatSortCode(value) as AccountFormData[K];
    }
    
    // Only allow digits for account number
    if (field === 'accountNumber' && typeof value === 'string') {
      processedValue = value.replace(/\D/g, '').slice(0, 8) as AccountFormData[K];
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    
    // Clear general error when user starts typing
    if (error) {
      setError(null);
    }
    
    // Perform real-time validation
    if (field === 'name') {
      const nameError = validateAccountName(value as string);
      setValidationErrors(prev => ({ ...prev, name: nameError }));
    }
    
    if (field === 'sortCode' || field === 'accountNumber') {
      const newFormData = { ...formData, [field]: processedValue };
      const bankError = validateBankDetails(newFormData.sortCode, newFormData.accountNumber);
      setValidationErrors(prev => ({ ...prev, bankDetails: bankError }));
    }
  };

  // Check if account type should show bank details
  const shouldShowBankDetails = (): boolean => {
    const bankAccountTypes = ['current', 'checking', 'savings', 'loan', 'credit', 'investment', 'mortgage'];
    return bankAccountTypes.includes(formData.type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent double submission
    
    // Check for validation errors before submitting
    if (validationErrors.name || validationErrors.bankDetails) {
      setError('Please fix validation errors before saving');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      logger.info('[AddAccountModal] Submitting account:', formData);
      
      // Validate the form data
      if (!formData.name.trim()) {
        throw new Error('Account name is required');
      }
      
      // Professional validation before submission
      const nameError = validateAccountName(formData.name);
      if (nameError) {
        throw new Error(nameError);
      }
      
      if (shouldShowBankDetails() && formData.sortCode && formData.accountNumber) {
        const bankError = validateBankDetails(formData.sortCode, formData.accountNumber);
        if (bankError) {
          throw new Error(bankError);
        }
      }
      
      const balance = parseFloat(formData.balance);
      if (isNaN(balance)) {
        throw new Error('Please enter a valid balance');
      }
      
      // Create the account with bank details if provided
      const accountData: (Omit<Account, 'id'> & { initialBalance?: number }) = {
        name: formData.name.trim(),
        type: (formData.type === 'checking' ? 'current' : formData.type) as Account['type'],
        balance: balance,
        currency: formData.currency,
        institution: formData.institution.trim() || '',
        isActive: true,
        lastUpdated: new Date(),
        initialBalance: balance,
      };
      
      // Add bank details if provided and not default values
      if (formData.sortCode && formData.sortCode !== '00-00-00') {
        accountData.sortCode = formData.sortCode;
      }
      if (formData.accountNumber && formData.accountNumber !== '00000000') {
        accountData.accountNumber = formData.accountNumber;
      }
      
      await addAccount(accountData);
      logger.info('[AddAccountModal] Account added successfully');
      
      // Reset form and close modal only after successful creation
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: formData.currency, // Keep the same currency
        institution: '',
        sortCode: '',
        accountNumber: ''
      });
      setValidationErrors({});
      setIsSubmitting(false);
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      logger.error('[AddAccountModal] Failed to add account:', error);
      setError(error instanceof Error ? error.message : 'Failed to add account. Please try again.');
      setIsSubmitting(false); // Only reset on error, not on success
    }
  };

  const selectedType = accountTypes.find(t => t.value === formData.type);
  const selectedCurrency = currencies.find(c => c.value === formData.currency);

  // Force refresh
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Account" size="lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex gap-3">
                  <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                </div>
              </div>
            )}

            {/* Account Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationErrors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
                placeholder="e.g., Main Checking Account"
                required
                autoFocus
                disabled={isSubmitting}
              />
              {/* Name Validation Error */}
              {validationErrors.name && (
                <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {validationErrors.name}
                </div>
              )}
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Account Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {accountTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField('type', type.value as AccountFormData['type'])}
                      disabled={isSubmitting}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/10 dark:bg-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon 
                          size={20} 
                          className={isSelected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}
                        />
                        <div className="text-left flex-1">
                          <div className={`text-sm font-medium ${
                            isSelected ? 'text-primary' : 'text-gray-700 dark:text-gray-200'
                          }`}>
                            {type.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {type.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance and Currency Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Current Balance */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Current Balance *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                    {selectedCurrency?.symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => updateField('balance', e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
                    placeholder="0.00"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Currency *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {currencies.map(curr => (
                    <option key={curr.value} value={curr.value}>
                      {curr.symbol} {curr.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bank Details - Show for relevant account types */}
            {shouldShowBankDetails() && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Sort Code */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Sort Code
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sortCode}
                      onChange={(e) => updateField('sortCode', e.target.value)}
                      className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationErrors.bankDetails ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
                      placeholder="XX-XX-XX"
                      maxLength={8}
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  {/* Account Number */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      Account Number
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => updateField('accountNumber', e.target.value)}
                      className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationErrors.bankDetails ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
                      placeholder="12345678"
                      maxLength={8}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                
                {/* Bank Details Validation Error */}
                {validationErrors.bankDetails && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {validationErrors.bankDetails}
                  </div>
                )}
                
                {/* Professional help text */}
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <strong>Pro Tip:</strong> Adding bank details enables automatic transaction import matching, ensuring your statements are imported to the correct account.
                </div>
              </div>
            )}

            {/* Institution */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Financial Institution
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Optional)</span>
              </label>
              <div className="relative">
                <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) => updateField('institution', e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border-2 ${validationErrors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
                  placeholder="e.g., Barclays, HSBC, NatWest"
                  disabled={isSubmitting}
                />
              </div>
              {/* Name Validation Error */}
              {validationErrors.name && (
                <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {validationErrors.name}
                </div>
              )}
            </div>

            {/* Account Type Info Banner */}
            {selectedType && (
              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex gap-3">
                  <selectedType.icon size={20} className="text-primary mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {selectedType.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {selectedType.description}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!validationErrors.name || !!validationErrors.bankDetails}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg hover:scale-[1.02] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
