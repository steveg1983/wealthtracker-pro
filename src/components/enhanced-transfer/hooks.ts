import { useState, useCallback, useMemo } from 'react';
import type { TransferFormData, TransferErrors } from './types';
import type { Transaction } from '../../types';
import { useApp } from '../../contexts/AppContextSupabase';
import { lazyLogger as logger } from '../../services/serviceFactory';

export function useTransferForm(
  sourceAccountId: string,
  transaction?: Transaction
) {
  const { accounts, categories, addTransaction, updateTransaction } = useApp();

  const initialFormData = {
    sourceAccountId: sourceAccountId,
    targetAccountId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    transferType: 'internal',
    transferPurpose: '',
    fees: '',
    exchangeRate: '',
    originalCurrency: '',
    assetType: 'cash' as NonNullable<TransferFormData['assetType']>,
    units: '',
    pricePerUnit: '',
    settlementDate: '',
    reference: '',
    notes: '',
    taxImplications: ''
  } as TransferFormData;

  const [formData, setFormData] = useState<TransferFormData>(initialFormData);
  const [errors, setErrors] = useState<TransferErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetAccounts = useMemo(
    () => accounts.filter(acc => 
      acc.id !== formData.sourceAccountId && acc.isActive !== false
    ),
    [accounts, formData.sourceAccountId]
  );

  const netAmount = useMemo(() => {
    const amt = parseFloat(formData.amount) || 0;
    const fee = parseFloat(formData.fees) || 0;
    return amt - fee;
  }, [formData.amount, formData.fees]);

  const convertedAmount = useMemo(() => {
    const amt = parseFloat(formData.amount) || 0;
    const rate = parseFloat(formData.exchangeRate) || 1;
    return amt * rate;
  }, [formData.amount, formData.exchangeRate]);

  const validateForm = useCallback((): boolean => {
    const newErrors: TransferErrors = {};
    
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
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      const sourceAccount = accounts.find(a => a.id === formData.sourceAccountId);
      const targetAccount = accounts.find(a => a.id === formData.targetAccountId);
      
      if (!sourceAccount || !targetAccount) {
        throw new Error('Invalid account selection');
      }
      
      const transferCategory = categories.find(cat => 
        cat.isTransferCategory === true && 
        cat.accountId === formData.targetAccountId
      );
      
      if (!transferCategory) {
        throw new Error('Transfer category not found for target account');
      }
      
      const transferMetadata: NonNullable<Transaction['transferMetadata']> = {
        transferType: formData.transferType,
        reconciliationStatus: 'pending'
      };
      if (formData.transferPurpose) transferMetadata.transferPurpose = formData.transferPurpose;
      if (formData.fees) {
        const n = parseFloat(formData.fees);
        if (!Number.isNaN(n)) transferMetadata.fees = n;
      }
      if (formData.exchangeRate) {
        const n = parseFloat(formData.exchangeRate);
        if (!Number.isNaN(n)) transferMetadata.exchangeRate = n;
      }
      if (formData.originalCurrency) transferMetadata.originalCurrency = formData.originalCurrency;
      if (formData.assetType) transferMetadata.assetType = formData.assetType;
      if (formData.units) {
        const n = parseFloat(formData.units);
        if (!Number.isNaN(n)) transferMetadata.units = n;
      }
      if (formData.pricePerUnit) {
        const n = parseFloat(formData.pricePerUnit);
        if (!Number.isNaN(n)) transferMetadata.pricePerUnit = n;
      }
      if (formData.settlementDate) transferMetadata.settlementDate = new Date(formData.settlementDate);
      if (formData.reference) transferMetadata.reference = formData.reference;
      if (formData.taxImplications) transferMetadata.taxImplications = formData.taxImplications;

      const transactionData: Omit<Transaction, 'id'> = {
        date: new Date(formData.date),
        amount: -(parseFloat(formData.amount) || 0),
        description: formData.description,
        category: transferCategory.id,
        accountId: formData.sourceAccountId,
        type: 'transfer',
        notes: formData.notes,
        transferMetadata
      };
      
      if (transaction) {
        await updateTransaction(transaction.id, transactionData);
      } else {
        await addTransaction(transactionData);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to create transfer:', error);
      setErrors({ description: 'Failed to create transfer. Please try again.' });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, accounts, categories, transaction, addTransaction, updateTransaction]);

  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    targetAccounts,
    netAmount,
    convertedAmount,
    handleSubmit
  };
}
