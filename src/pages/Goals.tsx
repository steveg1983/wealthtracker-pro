import { useState } from "react";
import { useApp } from "../contexts/AppContext";
import GoalModal from "../components/GoalModal";
import { Target, Plus, Pencil, Trash2, TrendingUp, Calendar } from "lucide-react";
import type { Goal } from "../types";

export default function Goals() {
  const { goals, accounts, deleteGoal } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();

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
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    return Math.min(progress, 100);
  };

  const getDaysRemaining = (targetDate: Date) => {
    const today = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getLinkedAccountsBalance = (linkedAccountIds?: string[]) => {
    if (!linkedAccountIds || linkedAccountIds.length === 0) return 0;
    
    return linkedAccountIds.reduce((total, accountId) => {
      const account = accounts.find(a => a.id === accountId);
      return total + (account?.balance || 0);
    }, 0);
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

  const totalTargetAmount = activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalCurrentAmount = activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-900 dark:text-white">Goals</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Add Goal
        </button>
      </div>

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
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Target</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                £{totalTargetAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Saved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                £{totalCurrentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          {activeGoals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-4">Active Goals</h2>
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
                      <button
                        onClick={() => handleEdit(goal)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                            progress >= 100 ? "bg-green-600" : progress >= 75 ? "bg-blue-600" : progress >= 50 ? "bg-yellow-600" : "bg-gray-400"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Current</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          £{goal.currentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Target</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          £{goal.targetAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className={`${daysRemaining < 30 ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                          {daysRemaining > 0 ? `${daysRemaining} days left` : "Overdue"}
                        </span>
                      </div>
                      {goal.linkedAccountIds && goal.linkedAccountIds.length > 0 && (
                        <div className="text-gray-600 dark:text-gray-400">
                          Linked: £{linkedBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-4">Completed Goals</h2>
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
                    <button
                      onClick={() => handleEdit(goal)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

          {goals.length === 0 && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-12">
            <div className="text-center">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No goals yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Start tracking your financial goals and watch your progress grow!
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                Create Your First Goal
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <GoalModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        goal={editingGoal}
      />
    </div>
  );
}