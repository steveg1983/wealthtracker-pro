import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../hooks/useCurrency';
import { TrendingUpIcon, TrendingDownIcon, BanknoteIcon } from '../components/icons';
import { EditIcon, DeleteIcon } from '../components/icons';
import { IconButton } from '../components/icons/IconButton';
import BudgetModal from '../components/BudgetModal';
import type { Budget } from '../types';
import PageWrapper from '../components/PageWrapper';
import { calculateBudgetSpending, calculateBudgetRemaining, calculateBudgetPercentage } from '../utils/calculations';

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
        // Calculate date range for budget period
        let startDate: Date;
        let endDate: Date;
        
        if (budget.period === 'monthly') {
          startDate = new Date(currentYear, currentMonth, 1);
          endDate = new Date(currentYear, currentMonth + 1, 0);
        } else if (budget.period === 'weekly') {
          // For weekly, use the current week
          const now = new Date();
          const dayOfWeek = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Yearly
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31);
        }

        const spent = calculateBudgetSpending(budget, transactions, startDate, endDate);
        const percentage = calculateBudgetPercentage(budget, spent);
        const remaining = calculateBudgetRemaining(budget, spent);

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
        <div 
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer"
          title="Add Budget"
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
              <circle cx="12" cy="12" r="10" stroke="#1F2937" strokeWidth="2" fill="none" />
              <path d="M12 8v8M8 12h8" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>
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