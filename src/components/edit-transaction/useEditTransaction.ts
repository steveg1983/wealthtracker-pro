import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useTransactionNotifications } from '../../hooks/useTransactionNotifications';
import { useModalForm } from '../../hooks/useModalForm';
import { ValidationService } from '../../services/validationService';
import { z } from 'zod';
import { logger } from '../../services/loggingService';
import type { Transaction } from '../../types';
import type { FormData, ValidationErrors } from './types';
import { getInitialFormData } from './types';

export function useEditTransaction(
  transaction: Transaction | null,
  onClose: () => void
) {
  const { accounts, categories, updateTransaction, deleteTransaction, getSubCategories, getDetailCategories } = useApp();
  const { addTransaction } = useTransactionNotifications();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formattedAmount, setFormattedAmount] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const initialFormData = getInitialFormData(transaction, accounts);
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
    initialFormData,
    {
      onSubmit: (data) => {
        try {
          setValidationErrors({});
          
          const validatedData = ValidationService.validateTransaction({
            id: transaction?.id,
            description: data.description,
            amount: data.amount,
            type: data.type === 'transfer' ? 'expense' : data.type,
            category: data.category,
            accountId: data.accountId,
            date: data.date,
            tags: data.tags.length > 0 ? data.tags : undefined,
            notes: data.notes.trim() || undefined,
          });
          
          const transactionData = {
            date: new Date(validatedData.date),
            description: validatedData.description,
            amount: parseFloat(validatedData.amount),
            type: data.type,
            category: validatedData.category,
            accountId: validatedData.accountId,
            tags: validatedData.tags,
            notes: validatedData.notes,
            cleared: data.cleared,
            reconciledWith: data.reconciledWith.trim() || undefined
          };

          if (transaction) {
            updateTransaction(transaction.id, transactionData);
          } else {
            addTransaction(transactionData);
          }
          
          onClose();
        } catch (error) {
          if (error instanceof z.ZodError) {
            setValidationErrors(ValidationService.formatErrors(error));
          } else {
            logger.error('Failed to update transaction:', error);
            setValidationErrors({ general: 'Failed to update transaction. Please try again.' });
          }
        }
      },
      onClose: () => {
        setValidationErrors({});
        onClose();
      }
    }
  );

  const availableSubCategories = getSubCategories(`type-${formData.type}`);

  const formatWithCommas = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    
    const isNegative = num < 0;
    const formatted = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num));
    
    return isNegative ? `-${formatted}` : formatted;
  };

  const parseFormattedAmount = (value: string): string => {
    return value.replace(/,/g, '');
  };

  useEffect(() => {
    if (transaction) {
      const categoryObj = categories.find(c => c.id === transaction.category);
      const subCategoryId = categoryObj?.parentId || '';
      const categoryId = categoryObj?.parentId ? transaction.category : '';
      
      const amountValue = transaction.type === 'transfer' 
        ? transaction.amount.toString()
        : Math.abs(transaction.amount).toString();
        
      setFormData({
        date: transaction.date instanceof Date 
          ? transaction.date.toISOString().split('T')[0] 
          : new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        amount: amountValue,
        type: transaction.type,
        category: categoryId,
        subCategory: subCategoryId,
        accountId: transaction.accountId,
        tags: transaction.tags || [],
        notes: transaction.notes || '',
        cleared: transaction.cleared || false,
        reconciledWith: transaction.reconciledWith || ''
      });
      setFormattedAmount(formatWithCommas(amountValue));
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        date: today,
        description: '',
        amount: '',
        type: 'expense',
        subCategory: '',
        category: '',
        accountId: accounts.length > 0 ? accounts[0].id : '',
        tags: [],
        notes: '',
        cleared: false,
        reconciledWith: ''
      });
      setFormattedAmount('');
    }
    setShowDeleteConfirm(false);
  }, [transaction, accounts, categories, setFormData]);

  const handleDelete = () => {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    onClose();
  };

  const handleAmountChange = (value: string) => {
    if (value === '' || value === '-' || /^-?[0-9,]*\.?[0-9]{0,2}$/.test(value)) {
      setFormattedAmount(value);
      const numericValue = parseFormattedAmount(value);
      if (numericValue === '' || numericValue === '-' || !isNaN(parseFloat(numericValue))) {
        updateField('amount', numericValue);
      }
    }
  };

  const handleAmountBlur = () => {
    if (formData.amount && formData.amount !== '') {
      setFormattedAmount(formatWithCommas(formData.amount));
    }
  };

  const handleAmountFocus = () => {
    if (amountInputRef.current) {
      amountInputRef.current.select();
    }
  };

  const handleCategoryCreated = (categoryId: string) => {
    const createdCategory = categories.find(c => c.id === categoryId);
    if (createdCategory) {
      if (createdCategory.level === 'detail') {
        updateField('subCategory', createdCategory.parentId || '');
        updateField('category', categoryId);
      } else {
        updateField('subCategory', categoryId);
        updateField('category', '');
      }
    }
    setShowCategoryModal(false);
  };

  return {
    formData,
    updateField,
    handleSubmit,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCategoryModal,
    setShowCategoryModal,
    validationErrors,
    formattedAmount,
    amountInputRef,
    availableSubCategories,
    accounts,
    categories,
    getDetailCategories,
    handleDelete,
    handleAmountChange,
    handleAmountBlur,
    handleAmountFocus,
    handleCategoryCreated,
    transaction
  };
}