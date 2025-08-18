import { useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

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

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps): React.JSX.Element {
  const { addAccount } = useApp();
  const { currency: defaultCurrency } = usePreferences();

  const { formData, updateField, handleSubmit } = useModalForm<AccountFormData>(
    {
      name: '',
      type: 'current',
      balance: '',
      currency: defaultCurrency,
      institution: ''
    },
    {
      onSubmit: (data) => {
        addAccount({
          name: data.name,
          type: data.type === 'checking' ? 'current' : data.type,
          balance: parseFloat(data.balance) || 0,
          currency: data.currency,
          institution: data.institution,
        });
      },
      onClose
    }
  );

  useEffect(() => {
    if (isOpen) {
      updateField('currency', defaultCurrency);
    }
  }, [isOpen, defaultCurrency, updateField]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Account">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => updateField('type', e.target.value as AccountFormData['type'])}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              >
                <option value="current">Current</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
                <option value="loan">Loan</option>
                <option value="investment">Investment</option>
                <option value="assets">Other Assets</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => updateField('balance', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              >
                <option value="GBP">GBP £</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Institution
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => updateField('institution', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                placeholder="e.g., Barclays, HSBC"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 min-h-[44px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 min-h-[44px] bg-primary text-white rounded-lg hover:bg-secondary"
            >
              Add Account
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
