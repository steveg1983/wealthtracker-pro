import React, { useEffect, memo } from 'react';
import { UsersIcon } from '../icons';
import type { HouseholdMember } from '../../services/collaborationService';
import type { SplitMethod, CustomSplit } from '../../services/expenseSplitService';
import { useLogger } from '../services/ServiceProvider';

interface MemberSplitListProps {
  members: HouseholdMember[];
  selectedMembers: string[];
  customSplits: Record<string, CustomSplit>;
  splitMethod: SplitMethod;
  onMemberToggle: (memberId: string) => void;
  onAmountChange: (memberId: string, amount: number) => void;
  onPercentageChange: (memberId: string, percentage: number) => void;
  formatCurrency: (amount: number) => string;
}

const MemberSplitList = memo(function MemberSplitList({ members,
  selectedMembers,
  customSplits,
  splitMethod,
  onMemberToggle,
  onAmountChange,
  onPercentageChange,
  formatCurrency
 }: MemberSplitListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('MemberSplitList component initialized', {
      componentName: 'MemberSplitList'
    });
  }, []);

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <UsersIcon size={16} />
        Select Members & Set Amounts
      </h4>
      
      <div className="space-y-3">
        {members.map(member => {
          const isSelected = selectedMembers.includes(member.id);
          const splitData = customSplits[member.id];
          
          return (
            <div key={member.id} className="flex items-center gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onMemberToggle(member.id)}
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
              
              {isSelected && (
                <div className="flex items-center gap-2">
                  {(splitMethod === 'custom' || splitMethod === 'percentage') && (
                    <>
                      <input
                        type="number"
                        step="0.01"
                        value={splitData?.amount || 0}
                        onChange={(e) => onAmountChange(member.id, Number(e.target.value))}
                        // Not disabled here; this block only renders for custom/percentage
                        className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        placeholder="Amount"
                      />
                      
                      {splitMethod === 'percentage' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={splitData?.percentage || 0}
                            onChange={(e) => onPercentageChange(member.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="%"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {splitMethod === 'equal' && (
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(splitData?.amount || 0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default MemberSplitList;
