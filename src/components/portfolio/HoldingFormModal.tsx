/**
 * Holding Form Modal Component
 * World-class form with enterprise-grade validation
 */

import React, { useEffect, memo } from 'react';
import { Modal } from '../common/Modal';
import { LoadingButton } from '../loading/LoadingState';
import { SearchIcon, CheckIcon } from '../icons';
import type { HoldingFormData, StockHolding } from '../../services/portfolio/portfolioManagerService';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

interface HoldingFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  isValidating: boolean;
  formData: HoldingFormData;
  validationError: string;
  costBasisPreview: DecimalInstance | null;
  formatCurrency: (value: DecimalInstance) => string;
  onClose: () => void;
  onFormChange: (field: keyof HoldingFormData, value: string) => void;
  onSave: () => void;
}

/**
 * Premium holding form with institutional validation
 */
export const HoldingFormModal = memo(function HoldingFormModal({
  isOpen,
  isEditing,
  isValidating,
  formData,
  validationError,
  costBasisPreview,
  formatCurrency,
  onClose,
  onFormChange,
  onSave
}: HoldingFormModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingFormModal component initialized', {
      componentName: 'HoldingFormModal'
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Holding' : 'Add Stock Holding'}
    >
      <div className="space-y-4">
        <SymbolInput
          value={formData.symbol}
          onChange={(value) => onFormChange('symbol', value)}
          disabled={isValidating}
        />
        <SharesInput
          value={formData.shares}
          onChange={(value) => onFormChange('shares', value)}
          disabled={isValidating}
        />
        <AverageCostInput
          value={formData.averageCost}
          onChange={(value) => onFormChange('averageCost', value)}
          disabled={isValidating}
        />
        <CostBasisPreview
          preview={costBasisPreview}
          formatCurrency={formatCurrency}
        />
        <ErrorMessage error={validationError} />
        <FormActions
          isEditing={isEditing}
          isValidating={isValidating}
          onClose={onClose}
          onSave={onSave}
        />
      </div>
    </Modal>
  );
});

/**
 * Symbol input field
 */
const SymbolInput = memo(function SymbolInput({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Stock Symbol
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="AAPL, MSFT, GOOGL..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white uppercase"
          disabled={disabled}
        />
        <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
});

/**
 * Shares input field
 */
const SharesInput = memo(function SharesInput({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Number of Shares
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        step="0.01"
        min="0"
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
        disabled={disabled}
      />
    </div>
  );
});

/**
 * Average cost input field
 */
const AverageCostInput = memo(function AverageCostInput({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Average Cost per Share
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        step="0.01"
        min="0"
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
        disabled={disabled}
      />
    </div>
  );
});

/**
 * Cost basis preview
 */
const CostBasisPreview = memo(function CostBasisPreview({
  preview,
  formatCurrency
}: {
  preview: DecimalInstance | null;
  formatCurrency: (value: DecimalInstance) => string;
}): React.JSX.Element {
  if (!preview) {
    return <div />;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Cost Basis: {formatCurrency(preview)}
      </p>
    </div>
  );
});

/**
 * Error message display
 */
const ErrorMessage = memo(function ErrorMessage({
  error
}: {
  error: string;
}): React.JSX.Element {
  if (!error) {
    return <div />;
  }

  return (
    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
    </div>
  );
});

/**
 * Form action buttons
 */
const FormActions = memo(function FormActions({
  isEditing,
  isValidating,
  onClose,
  onSave
}: {
  isEditing: boolean;
  isValidating: boolean;
  onClose: () => void;
  onSave: () => void;
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button
        onClick={onClose}
        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Cancel
      </button>
      <LoadingButton
        isLoading={isValidating}
        onClick={onSave}
        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
        loadingText="Validating..."
      >
        <CheckIcon size={16} className="mr-2" />
        {isEditing ? 'Update' : 'Add'} Holding
      </LoadingButton>
    </div>
  );
});