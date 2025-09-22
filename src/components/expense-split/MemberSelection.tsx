/**
 * Member Selection Component
 * Member selection and split amount configuration
 */

import React, { useEffect } from 'react';
import { UsersIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '../../utils/decimal';
import type { HouseholdMember } from '../../services/collaborationService';
import type { SplitMethod, CustomSplit } from '../../services/expenseSplitService';
import { useLogger } from '../services/ServiceProvider';

interface MemberSelectionProps {
  members: HouseholdMember[];
  selectedMembers: string[];
  customSplits: Record<string, CustomSplit>;
  splitMethod: SplitMethod;
  onMemberToggle: (memberId: string) => void;
  onAmountChange: (memberId: string, amount: number) => void;
  onPercentageChange: (memberId: string, percentage: number) => void;
}

const MemberSelection = React.memo(({
  members,
  selectedMembers,
  customSplits,
  splitMethod,
  onMemberToggle,
  onAmountChange,
  onPercentageChange
}: MemberSelectionProps) => {
  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <UsersIcon size={16} />
        Select Members & Set Amounts
      </h4>
      
      <div className="space-y-3">
        {members.map(member => (
          <div 
            key={member.id} 
            className="flex items-center gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={() => onMemberToggle(member.id)}
                className="h-4 w-4 text-[var(--color-primary)] rounded border-gray-300 dark:border-gray-600"
                aria-label={`Select ${member.name}`}
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
                      onChange={(e) => onAmountChange(member.id, Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      aria-label={`Amount for ${member.name}`}
                    />
                    
                    {splitMethod === 'percentage' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={customSplits[member.id]?.percentage || 0}
                          onChange={(e) => onPercentageChange(member.id, Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          aria-label={`Percentage for ${member.name}`}
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
  );
});

MemberSelection.displayName = 'MemberSelection';

export default MemberSelection;