import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useModalForm } from '../../hooks/useModalForm';
import { useToast } from '../../contexts/ToastContext';
import { ValidationService } from '../../services/validationService';
import { z } from 'zod';
import { useLogger } from '../services/ServiceProvider';
import type { FormData, ValidationErrors } from './types';

export function useAddTransaction(onClose: () => void) {
  const logger = useLogger();
  const { accounts, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const { showSuccess, showError } = useToast();

  // Initialize hook with error handling
  useEffect(() => {
    try {
      logger.info('useAddTransaction hook initialized', { 
        accountsCount: accounts?.length || 0,
        categoriesCount: categories?.length || 0,
        hookName: 'useAddTransaction' 
      });
      
      if (!accounts || accounts.length === 0) {
        logger.warn('No accounts available for transaction creation', { hookName: 'useAddTransaction' });
        setValidationErrors(prev => ({ 
          ...prev, 
          general: 'No accounts available. Please add an account first.' 
        }));
      }
    } catch (error) {
      logger.error('useAddTransaction hook initialization failed:', error, 'useAddTransaction');
    }
  }, [accounts, categories]);
  
  const { formData, updateField, handleSubmit, isSubmitting } = useModalForm<FormData>(
    {
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      accountId: '',
      date: new Date().toISOString().split('T')[0] || '',
      notes: ''
    },
    {
      onSubmit: async (data) => {
        try {
          setValidationErrors({});
          
          logger.debug('Transaction submission started', {
            description: data.description,
            amount: data.amount,
            type: data.type,
            accountId: data.accountId,
            hookName: 'useAddTransaction'
          });
          
          // Pre-submission validation
          if (!data.description?.trim()) {
            throw new Error('Transaction description is required');
          }
          
          if (!data.amount || parseFloat(data.amount) === 0) {
            throw new Error('Transaction amount must be greater than zero');
          }
          
          if (!data.accountId) {
            throw new Error('Please select an account');
          }
          
          if (!addTransaction) {
            throw new Error('Transaction service is not available');
          }
          
          const validatedData = ValidationService.validateTransaction({
            description: data.description,
            amount: data.amount,
            type: data.type === 'transfer' ? 'expense' : data.type,
            category: data.category,
            accountId: data.accountId,
            date: data.date,
            notes: data.notes || undefined,
          });
          
          const amount = parseFloat(validatedData.amount);
          
          if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid amount greater than zero');
          }
          
          const finalAmount = data.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
          
          const transactionData: Omit<import('../../types').Transaction, 'id'> = {
            description: validatedData.description,
            amount: finalAmount,
            type: data.type,
            category: validatedData.category,
            accountId: validatedData.accountId,
            date: new Date(validatedData.date),
          };
          if (validatedData.notes) {
            (transactionData as any).notes = validatedData.notes;
          }
          
          logger.debug('Adding transaction with validated data', {
            ...transactionData,
            hookName: 'useAddTransaction'
          });
          
          await addTransaction(transactionData);
          
          logger.info('Transaction added successfully', {
            transactionId: transactionData.description,
            amount: finalAmount,
            type: data.type,
            hookName: 'useAddTransaction'
          });
          
          showSuccess('Transaction added successfully');
          onClose();
        } catch (error) {
          logger.error('Transaction submission failed:', error, 'useAddTransaction');
          
          if (error instanceof z.ZodError) {
            const formattedErrors = ValidationService.formatErrors(error);
            setValidationErrors(formattedErrors);
            logger.debug('Validation errors set', { errors: formattedErrors, hookName: 'useAddTransaction' });
          } else {
            let errorMessage = 'Failed to add transaction. Please try again.';
            
            if (error instanceof Error) {
              if (error.message.includes('description')) {
                errorMessage = 'Please enter a transaction description.';
              } else if (error.message.includes('amount')) {
                errorMessage = 'Please enter a valid amount greater than zero.';
              } else if (error.message.includes('account')) {
                errorMessage = 'Please select an account for this transaction.';
              } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
              } else if (error.message.includes('service')) {
                errorMessage = 'Transaction service is temporarily unavailable. Please try again.';
              }
            }
            
            showError(errorMessage);
            setValidationErrors({ general: errorMessage });
          }
        }
      },
      onClose
    }
  );

  const availableSubCategories = (() => {
    try {
      if (!formData?.type || !getSubCategories) {
        logger.debug('Missing form data or getSubCategories function', {
          hasFormData: !!formData,
          hasGetSubCategories: !!getSubCategories,
          hookName: 'useAddTransaction'
        });
        return [];
      }
      return getSubCategories(`type-${formData.type}`);
    } catch (error) {
      logger.error('Failed to get subcategories:', error, 'useAddTransaction');
      return [];
    }
  })();

  const handleCategoryCreated = (categoryId: string) => {
    try {
      logger.debug('Handling category creation', { categoryId, hookName: 'useAddTransaction' });
      
      if (!categoryId) {
        logger.error('Category ID is missing', { hookName: 'useAddTransaction' });
        return;
      }
      
      if (!categories || categories.length === 0) {
        logger.error('Categories array is not available', { hookName: 'useAddTransaction' });
        return;
      }
      
      const createdCategory = categories.find(c => c.id === categoryId);
      
      if (!createdCategory) {
        logger.error('Created category not found in categories list', { 
          categoryId, 
          availableCategories: categories.length,
          hookName: 'useAddTransaction' 
        });
        return;
      }
      
      logger.debug('Category found, updating form fields', {
        categoryId,
        level: createdCategory.level,
        parentId: createdCategory.parentId,
        hookName: 'useAddTransaction'
      });
      
      if (createdCategory.level === 'detail') {
        updateField('subCategory', createdCategory.parentId || '');
        updateField('category', categoryId);
      } else {
        updateField('subCategory', categoryId);
        updateField('category', '');
      }
      
      setShowCategoryModal(false);
      
      logger.info('Category successfully applied to form', {
        categoryId,
        level: createdCategory.level,
        hookName: 'useAddTransaction'
      });
    } catch (error) {
      logger.error('Failed to handle category creation:', error, 'useAddTransaction');
    }
  };

  return {
    formData,
    updateField,
    handleSubmit,
    isSubmitting,
    showCategoryModal,
    setShowCategoryModal,
    validationErrors,
    accounts,
    availableSubCategories,
    getDetailCategories,
    handleCategoryCreated
  };
}
