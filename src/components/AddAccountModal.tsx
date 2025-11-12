import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { Building2, Wallet, CreditCard, TrendingUp, PiggyBank, Banknote, Package, AlertCircle } from 'lucide-react';
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
  const { addAccount } = useApp();
  const { currency: defaultCurrency } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'current',
    balance: '',
    currency: defaultCurrency,
    institution: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: defaultCurrency,
        institution: ''
      });
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultCurrency]);

  const updateField = <K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('[AddAccountModal] Submitting account:', formData);
      
      // Validate the form data
      if (!formData.name.trim()) {
        throw new Error('Account name is required');
      }
      
      const balance = parseFloat(formData.balance);
      if (isNaN(balance)) {
        throw new Error('Please enter a valid balance');
      }
      
      const newAccountPayload: Omit<Account, 'id'> & { initialBalance?: number } = {
        name: formData.name.trim(),
        type: formData.type === 'checking' ? 'current' : formData.type,
        balance,
        initialBalance: balance,
        currency: formData.currency,
        institution: formData.institution.trim() || undefined,
        lastUpdated: new Date(),
        openingBalance: balance,
        openingBalanceDate: new Date(),
        isActive: true,
      };

      // Create the account
      const result = await addAccount(newAccountPayload);
      
      console.log('[AddAccountModal] Account added successfully:', result);
      
      // Reset form and close modal only after successful creation
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: formData.currency, // Keep the same currency
        institution: ''
      });
      setIsSubmitting(false);
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      console.error('[AddAccountModal] Failed to add account:', error);
      setError(error instanceof Error ? error.message : 'Failed to add account. Please try again.');
      setIsSubmitting(false); // Only reset on error, not on success
    }
  };

  const selectedType = accountTypes.find(t => t.value === formData.type);
  const selectedCurrency = currencies.find(c => c.value === formData.currency);

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
                className="w-full px-4 py-3 bg-[#d4dce8] dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
                placeholder="e.g., Main Checking Account"
                required
                autoFocus
                disabled={isSubmitting}
              />
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
                    className="w-full pl-8 pr-4 py-3 bg-[#d4dce8] dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
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
                  className="w-full px-4 py-3 bg-[#d4dce8] dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200 appearance-none cursor-pointer"
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
                  className="w-full pl-11 pr-4 py-3 bg-[#d4dce8] dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
                  placeholder="e.g., Barclays, HSBC, NatWest"
                  disabled={isSubmitting}
                />
              </div>
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
              disabled={isSubmitting}
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
