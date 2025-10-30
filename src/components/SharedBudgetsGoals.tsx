import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { householdService } from '../services/householdService';
import { sharedFinanceService, type SharedBudget, type SharedGoal, type BudgetApproval } from '../services/sharedFinanceService';
import { 
  TargetIcon,
  GoalIcon,
  PlusIcon,
  UsersIcon,
  DollarSignIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  ClockIcon,
  EditIcon,
  TrashIcon
} from './icons';
import { useCurrency } from '../hooks/useCurrency';
import { format } from 'date-fns';

export default function SharedBudgetsGoals() {
  const { transactions, categories, budgets, goals, addBudget, addGoal, updateBudget, updateGoal } = useApp();
  const { formatCurrency } = useCurrency();
  const [household, setHousehold] = useState(householdService.getHousehold());
  const [currentMember] = useState(household?.members[0]); // Assume first member is current user
  
  const [sharedBudgets, setSharedBudgets] = useState<SharedBudget[]>([]);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<BudgetApproval[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  
  // Form states
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    categoryId: '',
    amount: '',
    period: 'monthly' as const,
    approvalRequired: false,
    approvalThreshold: '100'
  });
  
  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    categoryId: '',
    description: '',
    isHouseholdGoal: true
  });

  useEffect(() => {
    if (household) {
      loadSharedData();
    }
  }, [household, transactions]);

  const loadSharedData = () => {
    if (!household) return;
    
    const budgets = sharedFinanceService.getHouseholdBudgets(household.id, currentMember?.id);
    setSharedBudgets(budgets);
    
    const goals = sharedFinanceService.getHouseholdGoals(household.id, currentMember?.id);
    setSharedGoals(goals);
    
    const approvals = sharedFinanceService.getPendingApprovals(household.id);
    setPendingApprovals(approvals);
    
    const recentActivities = sharedFinanceService.getRecentActivities(household.id);
    setActivities(recentActivities);
  };

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !currentMember) return;

    try {
      const sharedBudget = sharedFinanceService.createSharedBudget(
        {
          name: budgetForm.name,
          categoryId: budgetForm.categoryId,
          amount: Number(budgetForm.amount),
          period: budgetForm.period,
          isActive: true
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
        period: budgetForm.period
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
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !currentMember) return;

    try {
      const sharedGoal = sharedFinanceService.createSharedGoal(
        {
          name: goalForm.name,
          targetAmount: Number(goalForm.targetAmount),
          currentAmount: 0,
          targetDate: new Date(goalForm.targetDate),
          description: goalForm.description
        },
        household.id,
        currentMember.id,
        currentMember.name,
        goalForm.isHouseholdGoal
      );

      // Also create in main app context
      addGoal({
        name: goalForm.name,
        targetAmount: Number(goalForm.targetAmount),
        targetDate: new Date(goalForm.targetDate),
        description: goalForm.description
      });

      setShowCreateGoal(false);
      setGoalForm({
        name: '',
        targetAmount: '',
        targetDate: '',
        categoryId: '',
        description: '',
        isHouseholdGoal: true
      });
      loadSharedData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleContributeToGoal = (goalId: string, amount: number) => {
    if (!currentMember) return;

    try {
      sharedFinanceService.updateGoalProgress(
        goalId,
        currentMember.id,
        currentMember.name,
        amount
      );
      loadSharedData();
    } catch (error: any) {
      alert(error.message);
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
    } catch (error: any) {
      alert(error.message);
    }
  };

  const calculateBudgetSpending = (budget: SharedBudget): number => {
    const now = new Date();
    const spending = sharedFinanceService.calculateBudgetSpending(
      budget.id,
      transactions,
      now
    );
    
    let total = 0;
    spending.forEach(amount => total += amount);
    return total;
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
                {currentMember.role === 'owner' || currentMember.role === 'admin' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReviewApproval(approval.id, true)}
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

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-1 flex">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            activeTab === 'budgets'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <TargetIcon size={20} />
          <span className="font-medium">Shared Budgets</span>
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
            activeTab === 'goals'
              ? 'bg-purple-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <GoalIcon size={20} />
          <span className="font-medium">Shared Goals</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'budgets' ? (
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
            const percentage = (spending / budget.amount) * 100;
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
                      {percentage.toFixed(0)}% used
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        isExceeded ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
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
      ) : (
        <div className="space-y-4">
          {/* Create Button */}
          {currentMember?.permissions.canEditGoals && (
            <button
              onClick={() => setShowCreateGoal(true)}
              className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
            >
              <PlusIcon size={20} />
              Create Shared Goal
            </button>
          )}

          {/* Goals List */}
          {sharedGoals.map(goal => {
            const percentage = (goal.currentAmount / goal.targetAmount) * 100;
            const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const myContribution = goal.contributors.find(c => c.memberId === currentMember?.id);

            return (
              <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{goal.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {goal.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </p>
                    <p className={`text-sm ${daysLeft < 30 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        goal.completedAt ? 'bg-green-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(0)}% complete</p>
                </div>

                {/* Contributors */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Contributors:</p>
                  {goal.contributors.map(contributor => (
                    <div key={contributor.memberId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{ 
                            backgroundColor: household.members.find(m => m.id === contributor.memberId)?.color 
                          }}
                        >
                          {contributor.memberName.charAt(0)}
                        </div>
                        <span>{contributor.memberName}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(contributor.currentAmount)} / {formatCurrency(contributor.targetAmount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {((contributor.currentAmount / contributor.targetAmount) * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Contribute */}
                {!goal.completedAt && myContribution && currentMember?.permissions.canEditGoals && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      {[10, 25, 50, 100].map(amount => (
                        <button
                          key={amount}
                          onClick={() => handleContributeToGoal(goal.id, amount)}
                          className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 text-sm"
                        >
                          +${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {goal.completedAt && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      <CheckIcon size={16} className="inline mr-1" />
                      Goal achieved on {format(goal.completedAt!, 'MMM d, yyyy')}!
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {sharedGoals.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No shared goals yet
            </div>
          )}
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create Shared Budget</h3>
            
            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Budget Name
                </label>
                <input
                  type="text"
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={budgetForm.category}
                  onChange={(e) => setBudgetForm({ ...budgetForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Period
                </label>
                <select
                  value={budgetForm.period}
                  onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={budgetForm.approvalRequired}
                  onChange={(e) => setBudgetForm({ ...budgetForm, approvalRequired: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm">Require approval for changes</span>
              </label>

              {budgetForm.approvalRequired && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Approval Threshold
                  </label>
                  <input
                    type="number"
                    value={budgetForm.approvalThreshold}
                    onChange={(e) => setBudgetForm({ ...budgetForm, approvalThreshold: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateBudget(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreateGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create Shared Goal</h3>
            
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Amount
                </label>
                <input
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={goalForm.category}
                  onChange={(e) => setGoalForm({ ...goalForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  <option value="Savings">Savings</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Emergency Fund">Emergency Fund</option>
                  <option value="Home">Home</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  rows={3}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={goalForm.isHouseholdGoal}
                  onChange={(e) => setGoalForm({ ...goalForm, isHouseholdGoal: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span className="text-sm">Shared equally among all members</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateGoal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}