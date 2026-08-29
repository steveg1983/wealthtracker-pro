import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { householdService } from '../services/householdService';
import {
  sharedFinanceService,
  type SharedBudget,
  type BudgetApproval,
  type SharedFinanceActivity
} from '../services/sharedFinanceService';
import {
  PlusIcon,
  UsersIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  ClockIcon
} from './icons';
import { CreateBudgetModal } from './SharedBudgetsModals';
import { useCurrency } from '../hooks/useCurrency';
import { toDecimal, toStorageNumber } from '../utils/decimal';
import { expandSplitTransactions } from '../utils/transactionSplits';
import type { DecimalInstance } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { format } from 'date-fns';

type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

const formatPercentage = (value: DecimalInstance | number, decimals: number = 0): string => {
  return formatDecimal(value, decimals);
};

interface BudgetFormState {
  name: string;
  categoryId: string;
  amount: string;
  period: BudgetPeriod;
  approvalRequired: boolean;
  approvalThreshold: string;
}

export default function SharedBudgets() {
  const { transactions: rawTransactions, transactionSplits, categories, addBudget } = useApp();
  // Split parents expand into per-line rows so shared-budget spending counts
  // split lines against their categories.
  const transactions = useMemo(
    () => expandSplitTransactions(rawTransactions, transactionSplits),
    [rawTransactions, transactionSplits]
  );
  const { formatCurrency } = useCurrency();
  const [household] = useState(householdService.getHousehold());
  const [currentMember] = useState(household?.members[0]); // Assume first member is current user
  
  const [sharedBudgets, setSharedBudgets] = useState<SharedBudget[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<BudgetApproval[]>([]);
  const [activities, setActivities] = useState<SharedFinanceActivity[]>([]);
  
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  
  // Form states
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>({
    name: '',
    categoryId: '',
    amount: '',
    period: 'monthly',
    approvalRequired: false,
    approvalThreshold: '100'
  });
  

  const loadSharedData = useCallback(() => {
    if (!household) return;
    
    const budgets = sharedFinanceService.getHouseholdBudgets(household.id, currentMember?.id);
    setSharedBudgets(budgets);
    
    const approvals = sharedFinanceService.getPendingApprovals(household.id);
    setPendingApprovals(approvals);
    const recentActivities = sharedFinanceService.getRecentActivities(household.id);
    setActivities(recentActivities);
  }, [currentMember, household]);

  useEffect(() => {
    if (household) {
      loadSharedData();
    }
  }, [household, loadSharedData, transactions]);

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !currentMember) return;

    try {
      sharedFinanceService.createSharedBudget(
        {
          name: budgetForm.name,
          categoryId: budgetForm.categoryId,
          amount: Number(budgetForm.amount),
          period: budgetForm.period,
          isActive: true,
          spent: 0,
          updatedAt: new Date()
        },
        household.id,
        currentMember.id,
        currentMember.name,
        undefined, // Share with all by default
        [currentMember.id], // Creator can edit
        budgetForm.approvalRequired,
        Number(budgetForm.approvalThreshold)
      );

      // Also create in main app context
      addBudget({
        name: budgetForm.name,
        categoryId: budgetForm.categoryId,
        amount: Number(budgetForm.amount),
        period: budgetForm.period,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setShowCreateBudget(false);
      setBudgetForm({
        name: '',
        categoryId: '',
        amount: '',
        period: 'monthly',
        approvalRequired: false,
        approvalThreshold: '100'
      });
      loadSharedData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create shared budget';
      alert(message);
    }
  };

  const handleReviewApproval = (approvalId: string, approved: boolean) => {
    if (!currentMember) return;

    try {
      sharedFinanceService.reviewApproval(
        approvalId,
        currentMember.id,
        approved,
        approved ? 'Approved' : 'Rejected'
      );
      loadSharedData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to review approval';
      alert(message);
    }
  };

  const calculateBudgetSpending = (budget: SharedBudget): number => {
    const now = new Date();
    const spending = sharedFinanceService.calculateBudgetSpending(
      budget.id,
      transactions,
      now
    );

    let total = toDecimal(0);
    spending.forEach(amount => { total = total.plus(toDecimal(amount)); });
    return toStorageNumber(total);
  };

  const getMemberSpending = (budget: SharedBudget): Map<string, number> => {
    const now = new Date();
    return sharedFinanceService.calculateBudgetSpending(
      budget.id,
      transactions,
      now
    );
  };

  if (!household) {
    return (
      <div className="text-center py-12">
        <UsersIcon className="mx-auto text-gray-400 mb-4" size={48} />
        <h3 className="text-lg font-semibold mb-2">No Household Selected</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Create or join a household to use shared budgets and goals
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Shared Finances</h2>
        <p className="text-purple-100">
          Collaborate on budgets and goals with your {household.name} members
        </p>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && currentMember?.role !== 'viewer' && (
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
                {currentMember && (currentMember.role === 'owner' || currentMember.role === 'admin') ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReviewApproval(approval.id, true)}
                      /* Approve and reject are a semantic pair; the reject half
                         was already red, so the approve half takes the app's
                         affirmative green rather than a stock blue standing in
                         for it (stock-blue ruling, 28 Aug 2026). */
                      className="p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200"
                    >
                      <CheckIcon size={16} />
                    </button>
                    <button
                      onClick={() => handleReviewApproval(approval.id, false)}
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
      )}

      {/* No tab bar. This panel offered Shared Budgets and Shared Goals;
          goals went with the feature, and one destination needs no chooser. */}

      {/* Content */}
      {/* Shared budgets, unconditionally: the goals tab that this used to
          alternate with went with the feature. */}
        <div className="space-y-4">
          {/* Create Button */}
          {currentMember?.permissions.canEditBudgets && (
            <button
              onClick={() => setShowCreateBudget(true)}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
            >
              <PlusIcon size={20} />
              Create Shared Budget
            </button>
          )}

          {/* Budgets List */}
          {sharedBudgets.map(budget => {
            const spending = calculateBudgetSpending(budget);
            const memberSpending = getMemberSpending(budget);
            const percentageDecimal = toDecimal(budget.amount).greaterThan(0)
              ? toDecimal(spending).dividedBy(budget.amount).times(100)
              : toDecimal(0);
            const isExceeded = spending > budget.amount;

            return (
              <div key={budget.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{budget.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {categories.find(c => c.id === budget.categoryId)?.name} • {budget.period}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {formatCurrency(spending)} / {formatCurrency(budget.amount)}
                    </p>
                    <p className={`text-sm ${isExceeded ? 'text-red-600' : 'text-gray-600'}`}>
                      {`${formatPercentage(percentageDecimal, 0)}% used`}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        isExceeded ? 'bg-red-500' : percentageDecimal.toNumber() > 80 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentageDecimal.toNumber(), 100)}%` }}
                    />
                  </div>
                </div>

                {/* Member Breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Member Spending:</p>
                  {household.members.map(member => {
                    const amount = memberSpending.get(member.id) || 0;
                    return (
                      <div key={member.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.name.charAt(0)}
                          </div>
                          <span>{member.name}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Budget Settings */}
                {budget.approvalRequired && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500">
                      <AlertCircleIcon size={12} className="inline mr-1" />
                      Changes over {formatCurrency(budget.approvalThreshold)} require approval
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {sharedBudgets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No shared budgets yet
            </div>
          )}
        </div>


      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {activities.slice(0, 5).map(activity => (
            <div key={activity.id} className="flex items-start gap-3 text-sm">
              <ClockIcon size={16} className="text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p>
                  <span className="font-medium">{activity.memberName}</span>
                  {' '}
                  <span className="text-gray-600 dark:text-gray-400">{activity.details}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {format(activity.timestamp, 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Budget Modal */}
      {showCreateBudget && (
        <CreateBudgetModal
          form={budgetForm}
          setForm={setBudgetForm}
          categories={categories}
          onSubmit={handleCreateBudget}
          onClose={() => setShowCreateBudget(false)}
        />
      )}
    </div>
  );
}

