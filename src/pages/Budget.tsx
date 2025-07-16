import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import { PlusCircleIcon, TrendingUpIcon, TrendingDownIcon, BanknoteIcon } from '../components/icons';
import { EditIcon, DeleteIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import BudgetModal from '../components/BudgetModal';
import type { Budget } from '../types';
import PageWrapper from '../components/PageWrapper';

export default function Budget() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const { formatCurrency } = useCurrency();
  
  // Get data from context
  const { budgets, transactions, updateBudget, deleteBudget } = useApp();

  // Memoize current date values
  const { currentMonth, currentYear } = useMemo(() => {
    const now = new Date();
    return {
      currentMonth: now.getMonth(),
      currentYear: now.getFullYear()
    };
  }, []);

  // Calculate spent amounts for each budget with memoization
  const budgetsWithSpent = useMemo(() => {
    return budgets
      .filter(budget => budget !== null && budget !== undefined)
      .map(budget => {
        // Filter transactions for this budget's category
        const categoryTransactions = transactions.filter(t => {
          if (!t || !t.category || !t.date) return false;
          if (t.category !== budget.category || t.type !== 'expense') return false;
          
          try {
            const transDate = new Date(t.date);
            if (budget.period === 'monthly') {
              return transDate.getMonth() === currentMonth && 
                     transDate.getFullYear() === currentYear;
            } else {
              return transDate.getFullYear() === currentYear;
            }
          } catch {
            return false;
          }
        });

        const spent = categoryTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const budgetAmount = Number(budget.amount) || 0;
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        const remaining = budgetAmount - spent;

        return {
          ...budget,
          spent,
          percentage,
          remaining
        };
      });
  }, [budgets, transactions, currentMonth, currentYear]);

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
  };

  const handleToggleActive = (budgetId: string, currentStatus: boolean | undefined) => {
    updateBudget(budgetId, { isActive: !currentStatus });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate totals with memoization
  const { totalBudgeted, totalSpent, totalRemaining } = useMemo(() => {
    const active = budgetsWithSpent.filter(b => b && b.isActive !== false);
    const budgeted = active.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const spent = active.reduce((sum, b) => sum + (b.spent || 0), 0);
    const remaining = budgeted - spent;
    
    return {
      totalBudgeted: budgeted,
      totalSpent: spent,
      totalRemaining: remaining
    };
  }, [budgetsWithSpent]);

  return (
    <PageWrapper 
      title="Budget"
      rightContent={
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
          title="Add Budget"
        >
          <PlusCircleIcon size={16} />
        </button>
      }
    >

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Budgeted</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalBudgeted)}
              </p>
            </div>
            <BanknoteIcon className="text-gray-400" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <TrendingDownIcon className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Remaining</p>
              <p className={`text-2xl font-bold ${
                totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(totalRemaining)}
              </p>
            </div>
            <TrendingUpIcon className={totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>
        </div>

        {/* Budgets List */}
        <div className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetsWithSpent.map(budget => budget && (
          <div
            key={budget.id}
            className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 ${
              budget.isActive === false ? 'opacity-60' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {budget.category}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {budget.period === 'monthly' ? 'Monthly' : 'Yearly'} budget
                  {budget.isActive === false && ' (Inactive)'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(budget.id, budget.isActive)}
                  className={`px-3 py-1 text-sm rounded ${
                    budget.isActive !== false
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {budget.isActive !== false ? 'Active' : 'Inactive'}
                </button>
                <IconButton
                  onClick={() => handleEdit(budget)}
                  icon={<EditIcon size={18} />}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                />
                <IconButton
                  onClick={() => {
                    if (confirm('Delete this budget?')) {
                      deleteBudget(budget.id);
                    }
                  }}
                  icon={<DeleteIcon size={18} />}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Spent</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(budget.spent)} of {formatCurrency(Number(budget.amount) || 0)}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(budget.percentage)}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {budget.percentage.toFixed(0)}% used
                </span>
                <span className={`font-medium ${
                  budget.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(Math.abs(budget.remaining))} {budget.remaining >= 0 ? 'remaining' : 'over budget'}
                </span>
              </div>
            </div>
          </div>
        ))}
          </div>

          {budgets.length === 0 && (
          <div className="text-center py-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No budgets set up yet</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-primary hover:underline"
            >
              Create your first budget
            </button>
          </div>
        )}
        </div>
      </div>

      <BudgetModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        budget={editingBudget || undefined}
      />
    </PageWrapper>
  );
}