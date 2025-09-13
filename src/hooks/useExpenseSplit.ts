/**
 * Custom Hook for Expense Split
 * Manages expense split state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { expenseSplitService } from '../services/expenseSplitService';
import type { SplitMethod, CustomSplit, ValidationError } from '../services/expenseSplitService';
import type { HouseholdMember } from '../services/collaborationService';

export interface UseExpenseSplitReturn {
  totalAmount: number;
  description: string;
  splitMethod: SplitMethod;
  members: HouseholdMember[];
  selectedMembers: string[];
  customSplits: Record<string, CustomSplit>;
  errors: string[];
  totalSplitAmount: number;
  totalPercentage: number;
  setTotalAmount: (amount: number) => void;
  setDescription: (desc: string) => void;
  setSplitMethod: (method: SplitMethod) => void;
  handleMemberToggle: (memberId: string) => void;
  handleAmountChange: (memberId: string, amount: number) => void;
  handlePercentageChange: (memberId: string, percentage: number) => void;
  handleCreateSplit: () => void;
  resetForm: () => void;
}

export function useExpenseSplit(
  isOpen: boolean,
  onClose: () => void,
  transactionId?: string,
  initialAmount: number = 0,
  initialDescription: string = ''
): UseExpenseSplitReturn {
  const [totalAmount, setTotalAmount] = useState(initialAmount);
  const [description, setDescription] = useState(initialDescription);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, CustomSplit>>({});
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeMembers = expenseSplitService.getActiveMembers();
      setMembers(activeMembers);
      setSelectedMembers(activeMembers.map(m => m.id));
      
      const initialSplits = expenseSplitService.initializeCustomSplits(
        activeMembers,
        totalAmount
      );
      setCustomSplits(initialSplits);
    }
  }, [isOpen, totalAmount]);

  const handleMemberToggle = useCallback((memberId: string) => {
    setSelectedMembers(prev => {
      const newSelected = prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId];
      
      // Recalculate splits for equal method
      if (splitMethod === 'equal' && newSelected.length > 0) {
        const newSplits = expenseSplitService.recalculateEqualSplits(
          newSelected,
          totalAmount
        );
        
        setCustomSplits(prevSplits => ({
          ...prevSplits,
          ...newSplits
        }));
      }
      
      return newSelected;
    });
  }, [splitMethod, totalAmount]);

  const handleAmountChange = useCallback((memberId: string, amount: number) => {
    setCustomSplits(prev => ({
      ...prev,
      [memberId]: expenseSplitService.updateAmountAndPercentage(
        amount,
        totalAmount
      )
    }));
  }, [totalAmount]);

  const handlePercentageChange = useCallback((memberId: string, percentage: number) => {
    setCustomSplits(prev => ({
      ...prev,
      [memberId]: expenseSplitService.updatePercentageAndAmount(
        percentage,
        totalAmount
      )
    }));
  }, [totalAmount]);

  const handleCreateSplit = useCallback(() => {
    const validationErrors = expenseSplitService.validateSplit(
      description,
      totalAmount,
      selectedMembers,
      splitMethod,
      customSplits
    );
    
    if (validationErrors.length > 0) {
      setErrors(expenseSplitService.formatErrorMessages(validationErrors));
      return;
    }
    
    const success = expenseSplitService.createExpenseSplit(
      transactionId,
      totalAmount,
      description,
      splitMethod,
      selectedMembers,
      customSplits
    );
    
    if (success) {
      onClose();
      resetForm();
    }
  }, [description, totalAmount, selectedMembers, splitMethod, customSplits,
      transactionId, onClose]);

  const resetForm = useCallback(() => {
    setTotalAmount(0);
    setDescription('');
    setSplitMethod('equal');
    setSelectedMembers([]);
    setCustomSplits({});
    setErrors([]);
  }, []);

  const totalSplitAmount = expenseSplitService.calculateTotalSplitAmount(
    selectedMembers,
    customSplits
  );

  const totalPercentage = expenseSplitService.calculateTotalPercentage(
    selectedMembers,
    customSplits
  );

  return {
    totalAmount,
    description,
    splitMethod,
    members,
    selectedMembers,
    customSplits,
    errors,
    totalSplitAmount,
    totalPercentage,
    setTotalAmount,
    setDescription,
    setSplitMethod,
    handleMemberToggle,
    handleAmountChange,
    handlePercentageChange,
    handleCreateSplit,
    resetForm
  };
}