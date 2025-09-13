import React, { useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { BuildingIcon as Building2 } from '../icons';
import { useAddAccount } from './useAddAccount';
import { AccountTypeSelector, getSelectedType } from './AccountTypeSelector';
import { BalanceCurrencyInput } from './BalanceCurrencyInput';
import { BankDetailsInput } from './BankDetailsInput';
import { ErrorMessage } from './ErrorMessage';
import type { AddAccountModalProps } from './types';
import { logger } from '../../services/loggingService';

const AddAccountModal = memo(function AddAccountModal({ isOpen, onClose }: AddAccountModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AddAccountModal component initialized', {
      componentName: 'AddAccountModal'
    });
  }, []);

  const {
    formData,
    updateField,
    handleSubmit,
    isSubmitting,
    error,
    validationErrors,
    shouldShowBankDetails
  } = useAddAccount(isOpen, onClose);

  const selectedType = getSelectedType(formData.type);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Account" size="lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-6">
            <ErrorMessage error={error} />

            {/* Account Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 ${
                  validationErrors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                } rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200`}
                placeholder="e.g., Main Checking Account"
                required
                autoFocus
                disabled={isSubmitting}
              />
              {validationErrors.name && (
                <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                  {validationErrors.name}
                </div>
              )}
            </div>

            <AccountTypeSelector
              value={formData.type}
              onChange={(type) => updateField('type', type)}
              isDisabled={isSubmitting}
            />

            <BalanceCurrencyInput
              balance={formData.balance}
              currency={formData.currency}
              onBalanceChange={(value) => updateField('balance', value)}
              onCurrencyChange={(value) => updateField('currency', value)}
              isDisabled={isSubmitting}
            />

            {shouldShowBankDetails() && (
              <BankDetailsInput
                sortCode={formData.sortCode}
                accountNumber={formData.accountNumber}
                onSortCodeChange={(value) => updateField('sortCode', value)}
                onAccountNumberChange={(value) => updateField('accountNumber', value)}
                validationError={validationErrors.bankDetails || ''}
                isDisabled={isSubmitting}
              />
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
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
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
});

export default AddAccountModal;
