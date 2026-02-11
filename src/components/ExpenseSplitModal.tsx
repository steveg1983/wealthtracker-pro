import React, { useState, useEffect } from 'react';
import { collaborationService } from '../services/collaborationService';
import { 
  DollarSignIcon,
  UsersIcon,
  XIcon,
  CheckIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import type { HouseholdMember } from '../services/collaborationService';

interface ExpenseSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId?: string;
  initialAmount?: number;
  initialDescription?: string;
}

export default function ExpenseSplitModal({ 
  isOpen, 
  onClose, 
  transactionId,
  initialAmount = 0,
  initialDescription = ''
}: ExpenseSplitModalProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const [totalAmount, setTotalAmount] = useState(initialAmount);
  const [description, setDescription] = useState(initialDescription);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom' | 'percentage'>('equal');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<{ [memberId: string]: { amount: number; percentage: number } }>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const household = collaborationService.getCurrentHousehold();
      if (household) {
        const activeMembers = household.members.filter(m => m.isActive);
        setMembers(activeMembers);
        setSelectedMembers(activeMembers.map(m => m.id)); // Select all by default
        
        // Initialize custom splits
        const initialCustomSplits: typeof customSplits = {};
        activeMembers.forEach(member => {
          initialCustomSplits[member.id] = {
            amount: totalAmount / activeMembers.length,
            percentage: 100 / activeMembers.length
          };
        });
        setCustomSplits(initialCustomSplits);
      }
    }
  }, [isOpen, totalAmount]);

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => {
      const newSelected = prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId];
      
      // Recalculate splits for equal method
      if (splitMethod === 'equal' && newSelected.length > 0) {
        const equalAmount = totalAmount / newSelected.length;
        const equalPercentage = 100 / newSelected.length;
        
        const newCustomSplits = { ...customSplits };
        newSelected.forEach(id => {
          newCustomSplits[id] = {
            amount: equalAmount,
            percentage: equalPercentage
          };
        });
        setCustomSplits(newCustomSplits);
      }
      
      return newSelected;
    });
  };

  const handleAmountChange = (memberId: string, amount: number) => {
    setCustomSplits(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
      }
    }));
  };

  const handlePercentageChange = (memberId: string, percentage: number) => {
    setCustomSplits(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        percentage,
        amount: (totalAmount * percentage) / 100
      }
    }));
  };

  const validateSplit = (): string[] => {
    const errors: string[] = [];
    
    if (!description.trim()) {
      errors.push('Description is required');
    }
    
    if (totalAmount <= 0) {
      errors.push('Total amount must be greater than 0');
    }
    
    if (selectedMembers.length === 0) {
      errors.push('At least one member must be selected');
    }
    
    if (splitMethod === 'custom' || splitMethod === 'percentage') {
      const totalSplitAmount = selectedMembers.reduce((sum, memberId) => 
        sum + (customSplits[memberId]?.amount || 0), 0
      );
      
      const totalPercentage = selectedMembers.reduce((sum, memberId) => 
        sum + (customSplits[memberId]?.percentage || 0), 0
      );
      
      if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
        errors.push('Split amounts must equal the total amount');
      }
      
      if (splitMethod === 'percentage' && Math.abs(totalPercentage - 100) > 0.01) {
        errors.push('Percentages must add up to 100%');
      }
    }
    
    return errors;
  };

  const handleCreateSplit = () => {
    const validationErrors = validateSplit();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    const splits = selectedMembers.map(memberId => ({
      memberId,
      amount: toDecimal(customSplits[memberId]?.amount || 0),
      percentage: splitMethod === 'percentage' ? customSplits[memberId]?.percentage : undefined
    }));
    
    const expenseSplit = collaborationService.createExpenseSplit(
      transactionId || 'manual-' + Date.now(),
      toDecimal(totalAmount),
      description.trim(),
      splitMethod,
      splits
    );
    
    if (expenseSplit) {
      onClose();
      // Reset form
      setTotalAmount(0);
      setDescription('');
      setSplitMethod('equal');
      setSelectedMembers([]);
      setCustomSplits({});
      setErrors([]);
    }
  };

  const getTotalSplitAmount = () => {
    return selectedMembers.reduce((sum, memberId) => 
      sum + (customSplits[memberId]?.amount || 0), 0
    );
  };

  const getTotalPercentage = () => {
    return selectedMembers.reduce((sum, memberId) => 
      sum + (customSplits[memberId]?.percentage || 0), 0
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSignIcon size={20} className="text-green-600 dark:text-green-400" />
              Split Expense
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XIcon size={20} />
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner at restaurant"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Split Method
              </label>
              <select
                value={splitMethod}
                onChange={(e) => setSplitMethod(e.target.value as typeof splitMethod)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="equal">Equal Split</option>
                <option value="custom">Custom Amounts</option>
                <option value="percentage">Percentage Split</option>
              </select>
            </div>
          </div>

          {/* Member Selection & Splits */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <UsersIcon size={16} />
              Select Members & Set Amounts
            </h4>
            
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => handleMemberToggle(member.id)}
                      className="h-4 w-4 text-[var(--color-primary)] rounded border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {member.email}
                    </p>
                  </div>
                  
                  {selectedMembers.includes(member.id) && (
                    <div className="flex items-center gap-2">
                      {(splitMethod === 'custom' || splitMethod === 'percentage') && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            value={customSplits[member.id]?.amount || 0}
                            onChange={(e) => handleAmountChange(member.id, Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          
                          {splitMethod === 'percentage' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                value={customSplits[member.id]?.percentage || 0}
                                onChange={(e) => handlePercentageChange(member.id, Number(e.target.value))}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {splitMethod === 'equal' && (
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(toDecimal(customSplits[member.id]?.amount || 0))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total Amount:
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatCurrency(toDecimal(totalAmount))}
              </span>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Split Total:
              </span>
              <span className={`font-bold ${
                Math.abs(getTotalSplitAmount() - totalAmount) < 0.01
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(toDecimal(getTotalSplitAmount()))}
              </span>
            </div>
            
            {splitMethod === 'percentage' && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Percentage:
                </span>
                <span className={`font-bold ${
                  Math.abs(getTotalPercentage() - 100) < 0.01
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatDecimal(getTotalPercentage(), 1)}%
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSplit}
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 flex items-center justify-center gap-2"
            >
              <CheckIcon size={16} />
              Create Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
