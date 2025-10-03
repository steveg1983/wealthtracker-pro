import { useState, useEffect } from "react";
import { useApp } from "../contexts/AppContextSupabase";
import GoalModal from "../components/GoalModal";
import { TargetIcon, TrendingUpIcon, CalendarIcon } from "../components/icons";
import { PlusIcon, EditIcon, DeleteIcon } from "../components/icons";
import { IconButton } from "../components/icons/IconButton";
import HelpTooltip from "../components/HelpTooltip";
import type { Goal } from "../types";
import type { DecimalGoal, DecimalAccount, DecimalInstance } from "../types/decimal-types";
import PageWrapper from "../components/PageWrapper";
import { calculateGoalProgress } from "../utils/calculations-decimal";
import { toDecimal } from "../utils/decimal";
import { useCurrencyDecimal } from "../hooks/useCurrencyDecimal";
import Confetti from "../components/Confetti";
import GoalCelebrationModal from "../components/GoalCelebrationModal";
import { goalAchievementService } from "../services/goalAchievementService";
import { useNotifications } from "../contexts/NotificationContext";
import { usePreferences } from "../contexts/PreferencesContext";
import AchievementHistory from "../components/AchievementHistory";

export default function Goals() {
  const { goals, accounts, deleteGoal, getDecimalGoals, getDecimalAccounts } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { addNotification, checkGoalProgress } = useNotifications();
  const { enableGoalCelebrations } = usePreferences();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);
  const [previousGoals, setPreviousGoals] = useState<Goal[]>([]);

  // Track goal progress changes for notifications
  useEffect(() => {
    if (goals.length > 0 && previousGoals.length > 0) {
      checkGoalProgress(goals, previousGoals);
    }
    setPreviousGoals([...goals]);
  }, [goals, checkGoalProgress]);

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this goal?")) {
      deleteGoal(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoal(undefined);
  };

  const getProgressPercentage = (goal: Goal) => {
    const decimalGoal = getDecimalGoals().find((g: DecimalGoal) => g.id === goal.id);
    if (!decimalGoal) return 0;
    return calculateGoalProgress(decimalGoal);
  };

  const getDaysRemaining = (targetDate: Date) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getLinkedAccountsBalance = (linkedAccountIds?: string[]) => {
    if (!linkedAccountIds || linkedAccountIds.length === 0) return toDecimal(0);
    
    const decimalAccounts = getDecimalAccounts();
    return linkedAccountIds.reduce((total, accountId) => {
      const account = decimalAccounts.find((a: DecimalAccount) => a.id === accountId);
      return account ? total.plus(account.balance) : total;
    }, toDecimal(0));
  };

  const getGoalIcon = (type: Goal["type"]) => {
    switch (type) {
      case "savings":
        return "💰";
      case "debt-payoff":
        return "💳";
      case "investment":
        return "📈";
      case "custom":
        return "🎯";
    }
  };

  const activeGoals = goals.filter(g => g.isActive);
  const completedGoals = goals.filter(g => !g.isActive || getProgressPercentage(g) >= 100);

  // Check for newly achieved goals
  useEffect(() => {
    if (!enableGoalCelebrations) return;
    
    activeGoals.forEach(goal => {
      const progress = getProgressPercentage(goal);
      
      // Check for achievement
      if (progress >= 100 && !goalAchievementService.hasBeenCelebrated(goal.id)) {
        // Record achievement
        goalAchievementService.recordAchievement(goal);
        goalAchievementService.markAsCelebrated(goal.id);
        
        // Get celebration message
        const message = goalAchievementService.getCelebrationMessage(goal);
        setCelebrationMessage(message);
        setCelebratingGoal(goal);
        
        // Show confetti
        setShowConfetti(true);
        
        // Add notification
        addNotification({
          id: `goal-achieved-${goal.id}`,
          type: 'success',
          title: 'Goal Achieved! 🎉',
          message: `Congratulations! You've achieved your goal: ${goal.name}`,
          timestamp: new Date(),
          persistent: true
        });
      }
      
      // Check for milestones
      const milestoneMessage = goalAchievementService.getMilestoneMessage(progress);
      if (milestoneMessage && !sessionStorage.getItem(`milestone-${goal.id}-${Math.floor(progress / 25) * 25}`)) {
        sessionStorage.setItem(`milestone-${goal.id}-${Math.floor(progress / 25) * 25}`, 'true');
        
        addNotification({
          id: `goal-milestone-${goal.id}-${Date.now()}`,
          type: 'info',
          title: 'Goal Progress',
          message: `${goal.name}: ${milestoneMessage}`,
          timestamp: new Date()
        });
      }
    });
  }, [activeGoals, addNotification, enableGoalCelebrations]);

  const decimalGoals = getDecimalGoals();
  const activeDecimalGoals = decimalGoals.filter((g: DecimalGoal) => {
    const regularGoal = goals.find(rg => rg.id === g.id);
    return regularGoal?.isActive;
  });
  
  const totalTargetAmount = activeDecimalGoals.reduce((sum: DecimalInstance, goal: DecimalGoal) => sum.plus(goal.targetAmount), toDecimal(0));
  const totalCurrentAmount = activeDecimalGoals.reduce((sum: DecimalInstance, goal: DecimalGoal) => sum.plus(goal.currentAmount), toDecimal(0));
  const overallProgress = totalTargetAmount.greaterThan(0) ? totalCurrentAmount.dividedBy(totalTargetAmount).times(100).toNumber() : 0;

  return (
    <PageWrapper 
      title="Goals"
      rightContent={
        <div 
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer"
          title="Add Goal"
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
          >
            <circle
              cx="24"
              cy="24"
              r="24"
              fill="#D9E1F2"
              className="transition-all duration-200"
              onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
              onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
            />
            <g transform="translate(12, 12)">
              <path 
                d="M12 5v14M5 12h14" 
                stroke="#1F2937" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      }
    >

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Active Goals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeGoals.length}</p>
            </div>
            <TargetIcon className="h-8 w-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Target</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalTargetAmount)}
              </p>
            </div>
            <TrendingUpIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Saved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalCurrentAmount)}
              </p>
            </div>
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 transform -rotate-90">
                <circle cx="16" cy="16" r="14" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${overallProgress * 0.88} 88`}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedGoals.length}</p>
            </div>
            <div className="text-2xl">🏆</div>
          </div>
        </div>
        </div>

        {/* Active Goals */}
        <div className="pt-4">
          {activeGoals.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal) => {
              const progress = getProgressPercentage(goal);
              const daysRemaining = getDaysRemaining(goal.targetDate);
              const linkedBalance = getLinkedAccountsBalance(goal.linkedAccountIds);

              return (
                <div key={goal.id} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getGoalIcon(goal.type)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{goal.type.replace("-", " ")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <IconButton
                        onClick={() => handleEdit(goal)}
                        icon={<EditIcon size={16} />}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                      />
                      <IconButton
                        onClick={() => handleDelete(goal.id)}
                        icon={<DeleteIcon size={16} />}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                      />
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{goal.description}</p>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="font-medium text-gray-900 dark:text-white">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            progress >= 100 ? "bg-green-600" : progress >= 75 ? "bg-gray-600" : progress >= 50 ? "bg-yellow-600" : "bg-gray-400"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Current</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(goal.currentAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Target</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        <span className={`${daysRemaining < 30 ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                          {daysRemaining > 0 ? `${daysRemaining} days left` : "Overdue"}
                        </span>
                      </div>
                      {goal.linkedAccountIds && goal.linkedAccountIds.length > 0 && (
                        <div className="text-gray-600 dark:text-gray-400">
                          Linked: {formatCurrency(linkedBalance)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : goals.length === 0 ? (
        /* Empty state when no goals at all */
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-12" data-testid="empty-state">
          <div className="text-center">
            <TargetIcon className="h-24 w-24 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No goals yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Set financial goals to track your progress towards savings targets, debt payoff, or investment milestones.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <PlusIcon size={20} />
              <span>Create Your First Goal</span>
            </button>
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                <div className="text-2xl mb-2">💰</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Savings Goal</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Build your emergency fund or save for a big purchase
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl mb-2">💳</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Debt Payoff</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Track progress on paying down credit cards or loans
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl mb-2">📈</div>
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Investment</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Monitor your investment portfolio growth targets
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state when all goals are completed */
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-12" data-testid="empty-state">
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              All goals completed!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Congratulations on achieving your goals! Ready to set new financial targets?
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <PlusIcon size={20} />
              <span>Set a New Goal</span>
            </button>
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-theme-heading dark:text-white mb-4">Completed Goals</h2>
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl opacity-50">{getGoalIcon(goal.type)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{goal.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Completed • £{goal.targetAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton
                      onClick={() => handleEdit(goal)}
                      icon={<EditIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    />
                    <IconButton
                      onClick={() => handleDelete(goal.id)}
                      icon={<DeleteIcon size={16} />}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        
        {/* Achievement History Toggle */}
        {goals.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowAchievements(!showAchievements)}
              className="text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 font-medium flex items-center gap-2"
            >
              <span>🏆</span>
              {showAchievements ? 'Hide' : 'View'} Achievement History
            </button>
          </div>
        )}
        
        {/* Achievement History */}
        {showAchievements && (
          <div className="mt-6">
            <AchievementHistory />
          </div>
        )}
        </div>
      </div>

      <GoalModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        goal={editingGoal}
      />
      
      {/* Confetti Animation */}
      <Confetti
        isActive={showConfetti}
        duration={4000}
        onComplete={() => setShowConfetti(false)}
      />
      
      {/* Goal Celebration Modal */}
      {celebratingGoal && (
        <GoalCelebrationModal
          isOpen={!!celebratingGoal}
          onClose={() => setCelebratingGoal(null)}
          goal={celebratingGoal}
          message={celebrationMessage}
        />
      )}
      
    </PageWrapper>
  );
}