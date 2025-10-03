import { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useLogger } from '../services/ServiceProvider';
import type { AccountFormData, ValidationErrors } from './types';

export function useAddAccount(isOpen: boolean, onClose: () => void) {
  const logger = useLogger();
  const { accounts, addAccount } = useApp();
  const { currency: defaultCurrency } = usePreferences();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'current',
    balance: '',
    currency: defaultCurrency,
    institution: '',
    sortCode: '',
    accountNumber: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: defaultCurrency,
        institution: '',
        sortCode: '',
        accountNumber: ''
      });
      setError(null);
      setValidationErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, defaultCurrency]);

  const validateAccountName = (name: string): string | undefined => {
    if (!name.trim()) return undefined;
    const duplicate = accounts.find(a => 
      a.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      return `An account named '${duplicate.name}' already exists`;
    }
    return undefined;
  };

  const validateBankDetails = (sortCode: string, accountNumber: string): string | undefined => {
    if (!sortCode || !accountNumber) return undefined;
    if (sortCode === '00-00-00' && accountNumber === '00000000') return undefined;
    
    const duplicate = accounts.find(a => 
      a.sortCode === sortCode && 
      a.accountNumber === accountNumber
    );
    if (duplicate) {
      return `These bank details are already used by '${duplicate.name}'`;
    }
    return undefined;
  };

  const formatSortCode = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  const updateField = <K extends keyof AccountFormData>(field: K, value: AccountFormData[K]) => {
    let processedValue = value;
    
    if (field === 'sortCode' && typeof value === 'string') {
      processedValue = formatSortCode(value) as AccountFormData[K];
    }
    
    if (field === 'accountNumber' && typeof value === 'string') {
      processedValue = value.replace(/\D/g, '').slice(0, 8) as AccountFormData[K];
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    
    if (error) {
      setError(null);
    }
    
    if (field === 'name') {
      const nameError = validateAccountName(value as string);
      setValidationErrors(prev => {
        const next = { ...prev } as ValidationErrors;
        if (nameError) next.name = nameError; else delete next.name;
        return next;
      });
    }
    
    if (field === 'sortCode' || field === 'accountNumber') {
      const newFormData = { ...formData, [field]: processedValue };
      const bankError = validateBankDetails(newFormData.sortCode, newFormData.accountNumber);
      setValidationErrors(prev => {
        const next = { ...prev } as ValidationErrors;
        if (bankError) next.bankDetails = bankError; else delete next.bankDetails;
        return next;
      });
    }
  };

  const shouldShowBankDetails = (): boolean => {
    const bankAccountTypes = ['current', 'checking', 'savings', 'loan', 'credit', 'investment', 'mortgage'];
    return bankAccountTypes.includes(formData.type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (validationErrors.name || validationErrors.bankDetails) {
      setError('Please fix validation errors before saving');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      logger.info('[AddAccountModal] Submitting account:', formData);
      
      if (!formData.name.trim()) {
        throw new Error('Account name is required');
      }
      
      const nameError = validateAccountName(formData.name);
      if (nameError) {
        throw new Error(nameError);
      }
      
      if (shouldShowBankDetails() && formData.sortCode && formData.accountNumber) {
        const bankError = validateBankDetails(formData.sortCode, formData.accountNumber);
        if (bankError) {
          throw new Error(bankError);
        }
      }
      
      const balance = parseFloat(formData.balance);
      if (isNaN(balance)) {
        throw new Error('Please enter a valid balance');
      }
      
      const accountData: Omit<import('../../types').Account, 'id' | 'balance'> = {
        name: formData.name.trim(),
        type: formData.type === 'checking' ? 'current' : formData.type,
        lastUpdated: new Date(),
        currency: formData.currency,
        institution: formData.institution.trim() || '',
        isActive: true,
        openingBalance: balance,
      };
      
      if (formData.sortCode && formData.sortCode !== '00-00-00') {
        accountData.sortCode = formData.sortCode;
      }
      if (formData.accountNumber && formData.accountNumber !== '00000000') {
        accountData.accountNumber = formData.accountNumber;
      }
      
      const result = await addAccount(accountData);
      
      logger.info('[AddAccountModal] Account added successfully:', result);
      
      setFormData({
        name: '',
        type: 'current',
        balance: '',
        currency: formData.currency,
        institution: '',
        sortCode: '',
        accountNumber: ''
      });
      setValidationErrors({});
      setIsSubmitting(false);
      
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (error) {
      logger.error('[AddAccountModal] Failed to add account:', error);
      setError(error instanceof Error ? error.message : 'Failed to add account. Please try again.');
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    updateField,
    handleSubmit,
    isSubmitting,
    error,
    validationErrors,
    shouldShowBankDetails,
    accounts
  };
}
