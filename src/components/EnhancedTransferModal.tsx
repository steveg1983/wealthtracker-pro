import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { XIcon } from './icons/XIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { AlertCircleIcon } from './icons/AlertCircleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import type { Transaction, Account } from '../types';
import { logger } from '../services/loggingService';

interface EnhancedTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction; // For editing existing transfers
  sourceAccountId?: string; // Pre-selected source account
}

interface TransferFormData {
  sourceAccountId: string;
  targetAccountId: string;
  amount: string;
  description: string;
  date: string;
  
  // Enhanced fields for wealth management
  transferType: 'internal' | 'wire' | 'ach' | 'crypto' | 'asset_sale' | 'dividend' | 'rebalance';
  transferPurpose: string;
  
  // Fees and conversion
  fees: string;
  exchangeRate: string;
  originalCurrency: string;
  
  // Asset details
  assetType?: 'cash' | 'stock' | 'bond' | 'crypto' | 'real_estate' | 'commodity' | 'other';
  units?: string;
  pricePerUnit?: string;
  
  // Settlement
  settlementDate: string;
  reference: string;
  
  // Notes
  notes: string;
  taxImplications: string;
}

export default function EnhancedTransferModal({
  isOpen,
  onClose,
  transaction,
  sourceAccountId
}: EnhancedTransferModalProps): React.JSX.Element | null {
  const { accounts, addTransaction, updateTransaction, categories } = useApp();
  
  const [formData, setFormData] = useState<TransferFormData>({
    sourceAccountId: sourceAccountId || '',
    targetAccountId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    transferType: 'internal',
    transferPurpose: '',
    fees: '',
    exchangeRate: '',
    originalCurrency: '',
    assetType: 'cash',
    units: '',
    pricePerUnit: '',
    settlementDate: '',
    reference: '',
    notes: '',
    taxImplications: ''
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Partial<TransferFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get available target accounts (exclude source)
  const targetAccounts = accounts.filter(acc => 
    acc.id !== formData.sourceAccountId && acc.isActive !== false
  );
  
  // Calculate net amount after fees
  const netAmount = () => {
    const amt = parseFloat(formData.amount) || 0;
    const fee = parseFloat(formData.fees) || 0;
    return amt - fee;
  };
  
  // Calculate converted amount if exchange rate provided
  const convertedAmount = () => {
    const amt = parseFloat(formData.amount) || 0;
    const rate = parseFloat(formData.exchangeRate) || 1;
    return amt * rate;
  };
  
  const validateForm = (): boolean => {
    const newErrors: Partial<TransferFormData> = {};
    
    if (!formData.sourceAccountId) {
      newErrors.sourceAccountId = 'Source account is required';
    }
    if (!formData.targetAccountId) {
      newErrors.targetAccountId = 'Target account is required';
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.description) {
      newErrors.description = 'Description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const sourceAccount = accounts.find(a => a.id === formData.sourceAccountId);
      const targetAccount = accounts.find(a => a.id === formData.targetAccountId);
      
      if (!sourceAccount || !targetAccount) {
        throw new Error('Invalid account selection');
      }
      
      // Find the transfer category for the target account
      const transferCategory = categories.find(cat => 
        cat.isTransferCategory === true && 
        cat.accountId === formData.targetAccountId
      );
      
      if (!transferCategory) {
        throw new Error('Transfer category not found for target account');
      }
      
      // Create the transaction with enhanced metadata
      const transactionData: Omit<Transaction, 'id'> = {
        date: new Date(formData.date),
        amount: -(parseFloat(formData.amount) || 0), // Negative for outgoing
        description: formData.description,
        category: transferCategory.id,
        accountId: formData.sourceAccountId,
        type: 'transfer',
        notes: formData.notes,
        
        // Add transfer metadata
        transferMetadata: {
          transferType: formData.transferType,
          transferPurpose: formData.transferPurpose,
          fees: parseFloat(formData.fees) || undefined,
          exchangeRate: parseFloat(formData.exchangeRate) || undefined,
          originalCurrency: formData.originalCurrency || undefined,
          assetType: formData.assetType,
          units: parseFloat(formData.units) || undefined,
          pricePerUnit: parseFloat(formData.pricePerUnit) || undefined,
          settlementDate: formData.settlementDate ? new Date(formData.settlementDate) : undefined,
          reference: formData.reference || undefined,
          taxImplications: formData.taxImplications || undefined,
          reconciliationStatus: 'pending'
        }
      };
      
      if (transaction) {
        await updateTransaction(transaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }
      
      onClose();
    } catch (error) {
      logger.error('Failed to create transfer:', error);
      setErrors({ description: 'Failed to create transfer. Please try again.' });
    } finally {
      setIsSubmitting(false);
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
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Account Selection */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Account
                </label>
                <select
                  value={formData.sourceAccountId}
                  onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency} {account.balance?.toLocaleString()})
                    </option>
                  ))}
                </select>
                {errors.sourceAccountId && (
                  <p className="text-red-500 text-xs mt-1">{errors.sourceAccountId}</p>
                )}
              </div>
              
              <div className="flex justify-center">
                <ArrowRightIcon size={24} className="text-gray-400" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Account
                </label>
                <select
                  value={formData.targetAccountId}
                  onChange={(e) => setFormData({ ...formData, targetAccountId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  disabled={!formData.sourceAccountId}
                >
                  <option value="">Select account...</option>
                  {targetAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency} {account.balance?.toLocaleString()})
                    </option>
                  ))}
                </select>
                {errors.targetAccountId && (
                  <p className="text-red-500 text-xs mt-1">{errors.targetAccountId}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Basic Transfer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              {errors.amount && (
                <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Quarterly rebalancing, Investment funding, Tax payment"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transfer Type
              </label>
              <select
                value={formData.transferType}
                onChange={(e) => setFormData({ ...formData, transferType: e.target.value as any })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="internal">Internal Transfer</option>
                <option value="wire">Wire Transfer</option>
                <option value="ach">ACH Transfer</option>
                <option value="crypto">Crypto Transfer</option>
                <option value="asset_sale">Asset Sale/Purchase</option>
                <option value="dividend">Dividend/Distribution</option>
                <option value="rebalance">Portfolio Rebalancing</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purpose
              </label>
              <input
                type="text"
                value={formData.transferPurpose}
                onChange={(e) => setFormData({ ...formData, transferPurpose: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., Monthly investment allocation"
              />
            </div>
          </div>
          
          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-primary hover:text-secondary font-medium text-sm"
          >
            {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
          </button>
          
          {/* Advanced Fields */}
          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Fees & Exchange</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transfer Fees
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fees}
                    onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                  {formData.fees && (
                    <p className="text-xs text-gray-500 mt-1">
                      Net amount: {netAmount().toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exchange Rate
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="1.0000"
                  />
                  {formData.exchangeRate && formData.exchangeRate !== '1' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Converted: {convertedAmount().toLocaleString()}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Original Currency
                  </label>
                  <input
                    type="text"
                    value={formData.originalCurrency}
                    onChange={(e) => setFormData({ ...formData, originalCurrency: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
              </div>
              
              <h3 className="font-medium text-gray-900 dark:text-white">Asset Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Asset Type
                  </label>
                  <select
                    value={formData.assetType}
                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="stock">Stocks</option>
                    <option value="bond">Bonds</option>
                    <option value="crypto">Cryptocurrency</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="commodity">Commodity</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Units/Shares
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.units}
                    onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price per Unit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <h3 className="font-medium text-gray-900 dark:text-white">Settlement & Reference</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Settlement Date
                  </label>
                  <input
                    type="date"
                    value={formData.settlementDate}
                    onChange={(e) => setFormData({ ...formData, settlementDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Wire ref, transaction ID, etc."
                  />
                </div>
              </div>
              
              <h3 className="font-medium text-gray-900 dark:text-white">Notes & Tax</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Additional notes about this transfer..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Implications
                  </label>
                  <textarea
                    value={formData.taxImplications}
                    onChange={(e) => setFormData({ ...formData, taxImplications: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={2}
                    placeholder="Capital gains, tax deductions, etc."
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Summary Box */}
          {formData.amount && formData.sourceAccountId && formData.targetAccountId && (
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Transfer Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-medium">{parseFloat(formData.amount).toLocaleString()}</span>
                </div>
                {formData.fees && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Fees:</span>
                    <span className="text-red-600">-{parseFloat(formData.fees).toLocaleString()}</span>
                  </div>
                )}
                {formData.fees && (
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-gray-600 dark:text-gray-400">Net Amount:</span>
                    <span className="font-medium">{netAmount().toLocaleString()}</span>
                  </div>
                )}
                {formData.exchangeRate && formData.exchangeRate !== '1' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">After Exchange:</span>
                    <span className="font-medium">{convertedAmount().toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
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
}