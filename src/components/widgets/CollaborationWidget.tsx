import React, { useState, useEffect } from 'react';
import { collaborationService } from '../../services/collaborationService';
import { 
  UsersIcon,
  DollarSignIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { toDecimal } from '../../utils/decimal';
import { useNavigate } from 'react-router-dom';
import type { Household, ExpenseSplit } from '../../services/collaborationService';
import type { BaseWidgetProps } from '../../types/widget-types';

type CollaborationWidgetProps = BaseWidgetProps;

export default function CollaborationWidget({ size = 'medium' }: CollaborationWidgetProps) {
  const { formatCurrency } = useCurrencyDecimal();
  const navigate = useNavigate();
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [pendingSplits, setPendingSplits] = useState<ExpenseSplit[]>([]);
  const [totalOwed, setTotalOwed] = useState(toDecimal(0));
  const [totalOwedTo, setTotalOwedTo] = useState(toDecimal(0));

  const loadData = React.useCallback(() => {
    const household = collaborationService.getCurrentHousehold();
    setCurrentHousehold(household);
    
    if (household) {
      const splits = collaborationService.getExpenseSplits();
      const pendingSplitsData = splits.filter(s => s.status === 'pending');
      setPendingSplits(pendingSplitsData);
      
      const calculatedSettlements = collaborationService.calculateSettlements();
      
      // Calculate totals
      let owed = toDecimal(0);
      let owedTo = toDecimal(0);
      
      calculatedSettlements.forEach(settlement => {
        if (settlement.fromMemberId === 'current-user') {
          owed = owed.plus(settlement.amount);
        } else if (settlement.toMemberId === 'current-user') {
          owedTo = owedTo.plus(settlement.amount);
        }
      });
      
      setTotalOwed(owed);
      setTotalOwedTo(owedTo);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewHousehold = () => {
    navigate('/household');
  };

  if (size === 'small') {
    return (
      <div 
        className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3"
        onClick={handleViewHousehold}
      >
        <div className="flex items-center justify-between mb-2">
          <UsersIcon size={20} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Household</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {currentHousehold ? (
              <>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {currentHousehold.members.filter(m => m.isActive).length}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Members
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No household
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UsersIcon size={20} className="text-blue-600 dark:text-blue-400" />
          Collaboration
        </h3>
        {currentHousehold && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentHousehold.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {!currentHousehold ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <UsersIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-2">No household setup</p>
              <button
                onClick={handleViewHousehold}
                className="text-sm text-[var(--color-primary)] hover:underline"
              >
                Create household
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Household Info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Members</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {currentHousehold.members.filter(m => m.isActive).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active Splits</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pendingSplits.length}
                </span>
              </div>
            </div>

            {/* Balance Summary */}
            {(totalOwed.greaterThan(0) || totalOwedTo.greaterThan(0)) && (
              <div className="space-y-2">
                {totalOwed.greaterThan(0) && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        You owe: {formatCurrency(totalOwed)}
                      </p>
                    </div>
                  </div>
                )}
                
                {totalOwedTo.greaterThan(0) && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Owed to you: {formatCurrency(totalOwedTo)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recent Activity
              </h4>
              
              {pendingSplits.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No pending splits
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingSplits.slice(0, 2).map(split => (
                    <div key={split.id} className="flex items-center gap-2">
                      <DollarSignIcon size={12} className="text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {split.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(split.totalAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {pendingSplits.length > 2 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      +{pendingSplits.length - 2} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* View Household Button */}
            <button
              onClick={handleViewHousehold}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Manage Household
              <ArrowRightIcon size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
