import React, { useEffect, memo } from 'react';
import { CheckIcon } from '../icons';
import type { HouseholdMember } from '../../services/collaborationService';
import type { CustomSplit } from '../../services/expenseSplitService';
import { logger } from '../../services/loggingService';

interface SplitSummaryProps {
  totalAmount: number;
  selectedMembers: string[];
  members: HouseholdMember[];
  customSplits: Record<string, CustomSplit>;
  formatCurrency: (amount: number) => string;
  remainingAmount: number;
}

const SplitSummary = memo(function SplitSummary({
  totalAmount,
  selectedMembers,
  members,
  customSplits,
  formatCurrency,
  remainingAmount
}: SplitSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SplitSummary component initialized', {
      componentName: 'SplitSummary'
    });
  }, []);

  const totalSplit = selectedMembers.reduce((sum, memberId) => {
    return sum + (customSplits[memberId]?.amount || 0);
  }, 0);

  const isBalanced = Math.abs(remainingAmount) < 0.01;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Split Summary
      </h4>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Total Split:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(totalSplit)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
          <span className={`font-medium ${
            isBalanced 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(remainingAmount)}
          </span>
        </div>
      </div>

      {isBalanced && selectedMembers.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckIcon size={16} />
          <span className="text-sm">Split is balanced</span>
        </div>
      )}

      {/* Member Summary */}
      {selectedMembers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase">
            Member Shares
          </h5>
          <div className="space-y-1">
            {selectedMembers.map(memberId => {
              const member = members.find(m => m.id === memberId);
              const split = customSplits[memberId];
              if (!member || !split) return null;
              
              return (
                <div key={memberId} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {member.name}:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(split.amount)} ({split.percentage.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default SplitSummary;