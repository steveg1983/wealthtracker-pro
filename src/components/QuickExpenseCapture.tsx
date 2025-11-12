import React, { useState, useEffect } from 'react';
import { mobileService } from '../services/mobileService';
import { useApp } from '../contexts/AppContextSupabase';
import { 
  CameraIcon,
  MapPinIcon,
  DollarSignIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  LoadingIcon,
  AlertCircleIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { formatDecimal } from '../utils/decimal-format';
import { toDecimal } from '../utils/decimal';
import type { CameraCapture, MerchantLocation } from '../services/mobileService';
import type { Transaction } from '../types';

interface QuickExpenseCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCreated?: (expense: Transaction) => void;
}

export default function QuickExpenseCapture({ isOpen, onClose, onExpenseCreated }: QuickExpenseCaptureProps) {
  const { accounts, categories, addTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [step, setStep] = useState<'camera' | 'review' | 'location' | 'complete'>('camera');
  const [capture, setCapture] = useState<CameraCapture | null>(null);
  const [nearbyMerchants, setNearbyMerchants] = useState<MerchantLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantLocation | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setStep('camera');
      setCapture(null);
      setNearbyMerchants([]);
      setError(null);
      setAmount(0);
      setDescription('');
      setCategory('');
      setSelectedAccount(accounts[0]?.id || '');
      setSelectedMerchant(null);
    }
  }, [isOpen, accounts]);

  const handleCameraCapture = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const cameraCapture = await mobileService.captureExpense();
      if (cameraCapture) {
        setCapture(cameraCapture);
        setAmount(cameraCapture.suggestedAmount || 0);
        setDescription(cameraCapture.suggestedMerchant || '');
        setCategory(cameraCapture.suggestedCategory || '');
        
        // Get nearby merchants if location is available
        if (cameraCapture.location) {
          const merchants = await mobileService.findNearbyMerchants(cameraCapture.location);
          setNearbyMerchants(merchants);
          setStep('location');
        } else {
          setStep('review');
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to capture expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerchantSelection = (merchant: MerchantLocation | null) => {
    setSelectedMerchant(merchant);
    if (merchant) {
      setDescription(merchant.name);
      setCategory(merchant.category);
    }
    setStep('review');
  };

  const handleSaveExpense = async () => {
    if (!amount || !description || !selectedAccount) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    
    try {
      const expense = {
        id: Date.now().toString(),
        date: new Date(),
        amount: -Math.abs(amount), // Negative for expenses
        description,
        category: category || 'other',
        accountId: selectedAccount,
        type: 'expense' as const,
        notes: selectedMerchant ? `Location: ${selectedMerchant.address}` : undefined,
        tags: selectedMerchant ? ['mobile-capture', 'location-tagged'] : ['mobile-capture']
      };

      // Check if offline
      if (mobileService.isOffline()) {
        mobileService.addOfflineTransaction(expense, 'create');
        // Show offline indicator
        setStep('complete');
      } else {
        await addTransaction(expense);
        setStep('complete');
      }

      onExpenseCreated?.(expense);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save expense');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCameraStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <CameraIcon size={48} className="text-gray-400" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Capture Receipt
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Take a photo of your receipt to automatically extract expense details
        </p>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircleIcon size={16} className="inline mr-2" />
          {error}
        </div>
      )}
      
      <div className="space-y-3">
        <button
          onClick={handleCameraCapture}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingIcon size={20} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CameraIcon size={20} />
              Take Photo
            </>
          )}
        </button>
        
        <button
          onClick={() => setStep('review')}
          className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Enter Manually
        </button>
      </div>
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <MapPinIcon size={32} className="mx-auto mb-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Select Merchant
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We found these nearby merchants. Select one or continue without location.
        </p>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {nearbyMerchants.map((merchant, index) => (
          <button
            key={index}
            onClick={() => handleMerchantSelection(merchant)}
            className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {merchant.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {merchant.address}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {merchant.distance !== undefined ? `${formatDecimal(merchant.distance, 1)} mi` : ''}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={() => handleMerchantSelection(null)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Skip Location
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
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
      
      {/* Captured Image Preview */}
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
      
      {/* Location Info */}
      {selectedMerchant && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPinIcon size={20} className="text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {selectedMerchant.name}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {selectedMerchant.address}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount *
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
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
            onChange={(e) => setDescription(e.target.value)}
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
            onChange={(e) => setCategory(e.target.value)}
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
            onChange={(e) => setSelectedAccount(e.target.value)}
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
      
      {/* Offline Indicator */}
      {mobileService.isOffline() && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
          <AlertCircleIcon size={16} className="inline mr-2" />
          You're offline. Expense will be saved and synced when connection is restored.
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          onClick={() => setStep('camera')}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handleSaveExpense}
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

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Expense Saved!
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatCurrency(toDecimal(amount))} expense has been {mobileService.isOffline() ? 'queued for sync' : 'saved'}
        </p>
      </div>
      
      {mobileService.isOffline() && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 text-sm">
          <ClockIcon size={16} className="inline mr-2" />
          Will sync automatically when you're back online
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Expense
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={20} />
            </button>
          </div>

          {/* Step Content */}
          {step === 'camera' && renderCameraStep()}
          {step === 'location' && renderLocationStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>
      </div>
    </div>
  );
}
