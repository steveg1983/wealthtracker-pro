import { memo, useEffect } from 'react';
import { PlusIcon } from '../../icons';
import { UKMortgageForm } from '../forms/UKMortgageForm';
import { USMortgageForm } from '../forms/USMortgageForm';
import type { UKFormData, USFormData } from '../../../services/mortgageCalculatorService';
import { logger } from '../../../services/loggingService';

interface CalculatorModalProps {
  show: boolean;
  region: 'UK' | 'US';
  ukFormData?: UKFormData;
  usFormData?: USFormData;
  useRealAccountData: boolean;
  useRealIncomeData?: boolean;
  selectedAccountIds: string[];
  financialData?: any;
  formatCurrency: (amount: number) => string;
  onClose: () => void;
  onCalculate: () => void;
  onUKFormChange?: (updates: Partial<UKFormData>) => void;
  onUSFormChange?: (updates: Partial<USFormData>) => void;
  onAccountSelection: (accountIds: string[]) => void;
  setUseRealAccountData: (value: boolean) => void;
  setUseRealIncomeData?: (value: boolean) => void;
}

/**
 * Calculator Modal component
 * Modal wrapper for mortgage calculation forms
 */
export const CalculatorModal = memo(function CalculatorModal({
  show,
  region,
  ukFormData,
  usFormData,
  useRealAccountData,
  useRealIncomeData,
  selectedAccountIds,
  financialData,
  formatCurrency,
  onClose,
  onCalculate,
  onUKFormChange,
  onUSFormChange,
  onAccountSelection,
  setUseRealAccountData,
  setUseRealIncomeData
}: CalculatorModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CalculatorModal component initialized', {
      componentName: 'CalculatorModal'
    });
  }, []);

  if (!show) return <></>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <ModalHeader region={region} onClose={onClose} />

          {region === 'UK' && ukFormData && onUKFormChange ? (
            <UKMortgageForm
              formData={ukFormData}
              onFormChange={onUKFormChange}
              useRealAccountData={useRealAccountData || false}
              setUseRealAccountData={setUseRealAccountData || (() => {})}
              selectedAccountIds={selectedAccountIds}
              onAccountSelection={onAccountSelection}
              useRealIncomeData={useRealIncomeData || false}
              setUseRealIncomeData={setUseRealIncomeData || (() => {})}
              financialData={financialData}
              formatCurrency={formatCurrency}
            />
          ) : usFormData && onUSFormChange ? (
            <USMortgageForm
              formData={usFormData}
              onFormChange={onUSFormChange}
              useRealAccountData={useRealAccountData || false}
              setUseRealAccountData={setUseRealAccountData || (() => {})}
              selectedAccountIds={selectedAccountIds}
              onAccountSelection={onAccountSelection}
            />
          ) : null}

          <ModalFooter onClose={onClose} onCalculate={onCalculate} />
        </div>
      </div>
    </div>
  );
});

/**
 * Modal header component
 */
const ModalHeader = memo(function ModalHeader({ 
  region, 
  onClose 
}: { 
  region: 'UK' | 'US';
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Calculate Mortgage - {region}
      </h3>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600"
      >
        <PlusIcon size={20} className="rotate-45" />
      </button>
    </div>
  );
});

/**
 * Modal footer component
 */
const ModalFooter = memo(function ModalFooter({ 
  onClose, 
  onCalculate 
}: { 
  onClose: () => void;
  onCalculate: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <button
        onClick={onClose}
        className="px-4 py-2 text-gray-700 dark:text-gray-300"
      >
        Cancel
      </button>
      <button
        onClick={onCalculate}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Calculate
      </button>
    </div>
  );
});