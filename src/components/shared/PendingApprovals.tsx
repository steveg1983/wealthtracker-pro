import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { CheckIcon, XIcon } from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { BudgetApproval } from '../../services/sharedFinanceService';
import { logger } from '../../services/loggingService';

interface PendingApprovalsProps {
  pendingApprovals: BudgetApproval[];
  currentMemberRole?: string;
  onReviewApproval: (approvalId: string, approved: boolean) => void;
}

export const PendingApprovals = memo(function PendingApprovals({
  pendingApprovals,
  currentMemberRole,
  onReviewApproval
}: PendingApprovalsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PendingApprovals component initialized', {
      componentName: 'PendingApprovals'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();
  
  if (pendingApprovals.length === 0 || currentMemberRole === 'viewer') {
    return <></>;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
      <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
        Pending Approvals
      </h3>
      <div className="space-y-2">
        {pendingApprovals.map(approval => (
          <div key={approval.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium">
                {approval.requestedByName} requested to change budget to {formatCurrency(approval.amount)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {approval.reason} • {format(approval.requestedAt, 'MMM d, h:mm a')}
              </p>
            </div>
            {currentMemberRole === 'owner' || currentMemberRole === 'admin' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => onReviewApproval(approval.id, true)}
                  className="p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200"
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  onClick={() => onReviewApproval(approval.id, false)}
                  className="p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200"
                >
                  <XIcon size={16} />
                </button>
              </div>
            ) : (
              <span className="text-sm text-yellow-600 dark:text-yellow-400">Pending</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});