import { memo, useState, useEffect } from 'react';
import { XIcon } from '../icons';
import { useApp } from '../../contexts/AppContextSupabase';
import { useTransferForm } from './hooks';
import { AccountSelectionRow } from './AccountSelectionRow';
import { BasicDetailsForm } from './BasicDetailsForm';
import { AdvancedOptions } from './AdvancedOptions';
import { TransferSummary } from './TransferSummary';
import type { EnhancedTransferModalProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export default memo(function EnhancedTransferModal({ isOpen,
  onClose,
  transaction,
  sourceAccountId
 }: EnhancedTransferModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('EnhancedTransferModal component initialized', {
      componentName: 'EnhancedTransferModal'
    });
  }, []);

  const { accounts } = useApp();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    formData,
    setFormData,
    errors,
    isSubmitting,
    targetAccounts,
    netAmount,
    convertedAmount,
    handleSubmit
  } = useTransferForm(sourceAccountId ?? '', transaction);

  const onSubmit = async (e: React.FormEvent) => {
    const success = await handleSubmit(e);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Enhanced Transfer
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XIcon size={24} />
            </button>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <AccountSelectionRow
            formData={formData}
            setFormData={setFormData}
            accounts={accounts}
            targetAccounts={targetAccounts}
            errors={errors}
          />
          
          <BasicDetailsForm
            formData={formData}
            setFormData={setFormData}
            errors={errors}
          />
          
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-primary hover:text-secondary font-medium text-sm"
          >
            {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
          </button>
          
          {showAdvanced && (
            <AdvancedOptions
              formData={formData}
              setFormData={setFormData}
              netAmount={netAmount}
              convertedAmount={convertedAmount}
            />
          )}
          
          <TransferSummary
            amount={formData.amount}
            fees={formData.fees}
            exchangeRate={formData.exchangeRate}
            sourceAccountId={formData.sourceAccountId}
            targetAccountId={formData.targetAccountId}
            netAmount={netAmount}
            convertedAmount={convertedAmount}
          />
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating Transfer...' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
