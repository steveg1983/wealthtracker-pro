import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { XIcon } from '../icons';
import { formatCurrency } from '../../utils/currency';
import CategoryCreationModal from '../CategoryCreationModal';
import { BalanceSummary } from './BalanceSummary';
import { InfoAlert } from './InfoAlert';
import { AdjustmentForm } from './AdjustmentForm';
import { ActionButtons } from './ActionButtons';
import { ErrorModal } from './ErrorModal';
import { useBalanceCalculations } from './useBalanceCalculations';
import { logger } from '../../services/loggingService';

interface BalanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  currentBalance: number;
  newBalance: string;
}

/**
 * Main balance adjustment modal component
 * Orchestrates the balance adjustment workflow with transaction creation
 */
export const BalanceAdjustmentModal = memo(function BalanceAdjustmentModal({ 
  isOpen, 
  onClose, 
  accountId,
  currentBalance,
  newBalance
}: BalanceAdjustmentModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('BalanceAdjustmentModal component initialized', {
      componentName: 'BalanceAdjustmentModal',
      isOpen,
      accountId,
      currentBalance,
      newBalance
    });
  }, [isOpen, accountId, currentBalance, newBalance]);

  const { accounts, addTransaction, categories, getSubCategories, getDetailCategories } = useApp();
  
  // Form state
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('cat-blank');
  const [subCategory, setSubCategory] = useState('sub-other-expense');
    const [description, setDescription] = useState('Balance Adjustment');
    const [notes, setNotes] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    
    // Memoize account lookup for performance
    const account = useMemo(() => 
      accounts.find(a => a.id === accountId), 
      [accounts, accountId]
    );
    
    // Use custom hook for balance calculations
    const { newBalanceNum, difference, isIncrease } = useBalanceCalculations({
      newBalance,
      currentBalance
    });
    
    // Memoize transaction type and available categories
    const transactionType = useMemo(() => isIncrease ? 'income' : 'expense', [isIncrease]);
    
    const availableSubCategories = useMemo(() => {
      try {
        const categories = getSubCategories(`type-${transactionType}`);
        logger.debug('Available subcategories computed', { 
          transactionType, 
          count: categories.length,
          componentName: 'BalanceAdjustmentModal'
        });
        return categories;
      } catch (error) {
        logger.error('Error getting subcategories:', error);
        return [];
      }
    }, [transactionType, getSubCategories]);

    const handleSubmit = useCallback((e: React.FormEvent): void => {
      try {
        e.preventDefault();
        
        logger.debug('Balance adjustment submit started', { 
          accountId, 
          currentBalance, 
          newBalance: newBalanceNum,
          difference,
          componentName: 'BalanceAdjustmentModal' 
        });
        
        if (Math.abs(difference) < 0.01) {
          logger.info('No adjustment needed, difference too small', { 
            difference, 
            componentName: 'BalanceAdjustmentModal' 
          });
          onClose();
          return;
        }
        
        // Validate required fields
        if (!description.trim()) {
          logger.warn('Description is required for balance adjustment', { componentName: 'BalanceAdjustmentModal' });
          alert('Please provide a description for this adjustment.');
          return;
        }
        
        if (!adjustmentDate) {
          logger.warn('Date is required for balance adjustment', { componentName: 'BalanceAdjustmentModal' });
          alert('Please select a date for this adjustment.');
          return;
        }
        
        if (!account) {
          logger.error('Account not found for balance adjustment', { accountId });
          alert('Account not found. Please try again.');
          return;
        }
        
        // Create an adjustment transaction
        const adjustmentTransaction = {
          date: new Date(adjustmentDate),
          description: description.trim(),
          amount: Math.abs(difference),
          type: isIncrease ? 'income' as const : 'expense' as const,
          category: category || 'cat-blank',
          accountId: accountId,
          notes: notes?.trim() || `Manual balance adjustment from ${formatCurrency(currentBalance, account.currency)} to ${formatCurrency(newBalanceNum, account.currency)}`,
          cleared: true,
          tags: ['balance-adjustment']
        };
        
        logger.debug('Creating balance adjustment transaction', { 
          transaction: adjustmentTransaction, 
          componentName: 'BalanceAdjustmentModal' 
        });
        
        addTransaction(adjustmentTransaction);
        
        logger.info('Balance adjustment transaction created successfully', { 
          transactionAmount: adjustmentTransaction.amount,
          type: adjustmentTransaction.type,
          componentName: 'BalanceAdjustmentModal' 
        });
        
        onClose();
      } catch (error) {
        logger.error('Balance adjustment failed:', error);
        alert('Failed to create balance adjustment. Please try again.');
      }
    }, [accountId, currentBalance, newBalanceNum, difference, description, adjustmentDate, account, category, notes, isIncrease, onClose, addTransaction]);
    
    // Optimized event handlers
    const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
      try {
        logger.debug('Adjustment date changed', { 
          newDate: e.target.value, 
          componentName: 'BalanceAdjustmentModal' 
        });
        setAdjustmentDate(e.target.value);
      } catch (error) {
        logger.error('Failed to update adjustment date:', error);
      }
    }, []);
    
    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
      try {
        setDescription(e.target.value);
      } catch (error) {
        logger.error('Failed to update description:', error);
      }
    }, []);
    
    const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      try {
        setNotes(e.target.value);
      } catch (error) {
        logger.error('Failed to update notes:', error);
      }
    }, []);
    
    const handleSubCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
      try {
        setSubCategory(e.target.value);
        setCategory('');
      } catch (error) {
        logger.error('Failed to update subcategory:', error);
      }
    }, []);
    
    const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
      try {
        setCategory(e.target.value);
      } catch (error) {
        logger.error('Failed to update category:', error);
      }
    }, []);
    
    const handleCloseModal = useCallback((): void => {
      try {
        logger.debug('Balance adjustment modal closed', { componentName: 'BalanceAdjustmentModal' });
        onClose();
      } catch (error) {
        logger.error('Failed to close balance adjustment modal:', error);
      }
    }, [onClose]);

    // Early return with error handling
    if (!isOpen || !account) {
      logger.debug('Modal not rendered', { isOpen, hasAccount: !!account });
      return <></>;
    }

    try {
      return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Balance Adjustment Required
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 -m-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XIcon size={24} />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            <InfoAlert />
            
            <div className="space-y-4">
              <BalanceSummary
                currentBalance={currentBalance}
                newBalanceNum={newBalanceNum}
                difference={difference}
                isIncrease={isIncrease}
                currency={account.currency}
              />
              
              <AdjustmentForm
                adjustmentDate={adjustmentDate}
                description={description}
                notes={notes}
                subCategory={subCategory}
                category={category}
                availableSubCategories={availableSubCategories}
                getDetailCategories={getDetailCategories}
                onDateChange={handleDateChange}
                onDescriptionChange={handleDescriptionChange}
                onNotesChange={handleNotesChange}
                onSubCategoryChange={handleSubCategoryChange}
                onCategoryChange={handleCategoryChange}
                onShowCategoryModal={() => setShowCategoryModal(true)}
              />
            </div>
            
            <ActionButtons onCancel={handleCloseModal} />
          </form>
          
          {/* Category Creation Modal */}
          <CategoryCreationModal
            isOpen={showCategoryModal}
            onClose={() => setShowCategoryModal(false)}
            initialType={transactionType}
            onCategoryCreated={(categoryId) => {
              const createdCategory = categories.find(c => c.id === categoryId);
              if (createdCategory) {
                if (createdCategory.level === 'detail') {
                  setSubCategory(createdCategory.parentId || '');
                  setCategory(categoryId);
                } else {
                  setSubCategory(categoryId);
                  setCategory('');
                }
              }
              setShowCategoryModal(false);
            }}
          />
        </div>
      </div>
    );
  } catch (error) {
    logger.error('BalanceAdjustmentModal render error:', error);
    return <ErrorModal onClose={onClose} />;
  }
});