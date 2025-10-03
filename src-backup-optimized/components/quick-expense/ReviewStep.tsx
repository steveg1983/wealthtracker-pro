import { memo, useEffect } from 'react';
import { DollarSignIcon, MapPinIcon, AlertCircleIcon, LoadingIcon } from '../icons';
import { mobileService } from '../../services/mobileService';
import type { CameraCapture, MerchantLocation } from '../../services/mobileService';
import { useLogger } from '../services/ServiceProvider';

interface ReviewStepProps {
  capture: CameraCapture | null;
  selectedMerchant: MerchantLocation | null;
  amount: number;
  description: string;
  category: string;
  selectedAccount: string;
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  error: string | null;
  isLoading: boolean;
  onAmountChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
}

export const ReviewStep = memo(function ReviewStep({ capture,
  selectedMerchant,
  amount,
  description,
  category,
  selectedAccount,
  categories,
  accounts,
  error,
  isLoading,
  onAmountChange,
  onDescriptionChange,
  onCategoryChange,
  onAccountChange,
  onBack,
  onSave
 }: ReviewStepProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReviewStep component initialized', {
      componentName: 'ReviewStep'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <DollarSignIcon size={32} className="mx-auto mb-4 text-green-600 dark:text-green-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Review Expense
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Verify the details and save your expense
        </p>
      </div>
      
      {capture && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <img 
              src={capture.imageData} 
              alt="Receipt" 
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Receipt captured
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {capture.timestamp.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {selectedMerchant && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-center gap-3">
            <MapPinIcon size={20} className="text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedMerchant.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {selectedMerchant.address}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount *
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="0.00"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Coffee, lunch, etc."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Account *
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircleIcon size={16} className="inline mr-2" />
          {error}
        </div>
      )}
      
      {mobileService.isOffline() && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
          <AlertCircleIcon size={16} className="inline mr-2" />
          You're offline. Expense will be saved and synced when connection is restored.
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={isLoading || !amount || !description || !selectedAccount}
          className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingIcon size={16} className="animate-spin inline mr-2" />
              Saving...
            </>
          ) : (
            'Save Expense'
          )}
        </button>
      </div>
    </div>
  );
});