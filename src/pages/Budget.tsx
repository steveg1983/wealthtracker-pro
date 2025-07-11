import { formatCurrency } from "../utils/formatters";
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import AddBudgetModal from '../components/AddBudgetModal';
import BudgetProgress from '../components/BudgetProgress';
import { Plus, TrendingUp, Calendar, Target, AlertTriangle } from 'lucide-react';

export default function Budget() {
  const { budgets, transactions, deleteBudget, updateBudget } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  // Calculate current month's spending by category
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlySpending = transactions
    .filter(t => {
      const date = new Date(t.date);
      return t.type === 'expense' && 
             date.getMonth() === currentMonth && 
             date.getFullYear() === currentYear;
    })
    .reduce((acc, t) => {
      const category = t.category || 'Other';
      acc[category] = (acc[category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  // Calculate total budget and spending
  const activeBudgets = budgets.filter(b => b.isActive && b.period === 'monthly');
  const totalBudget = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = Object.values(monthlySpending).reduce((sum, amount) => sum + amount, 0);
  const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Find categories with spending but no budget
  const unbudgetedCategories = Object.keys(monthlySpending).filter(
    cat => !budgets.find(b => b.category === cat && b.isActive)
  );

  const handleEdit = (budgetId: string, currentAmount: number) => {
    setEditingBudget(budgetId);
    setEditAmount(currentAmount.toString());
  };

  const handleSaveEdit = (budgetId: string) => {
    updateBudget(budgetId, { amount: parseFloat(editAmount) });
    setEditingBudget(null);
    setEditAmount('');
  };

  const handleDelete = (budgetId: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      deleteBudget(budgetId);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Set Budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-xl font-bold">£{totalBudget.toFixed(2)}</p>
            </div>
            <Target className="text-primary" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-xl font-bold">£{totalSpent.toFixed(2)}</p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Remaining</p>
              <p className={`text-xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                £{Math.abs(totalBudget - totalSpent).toFixed(2)}
              </p>
            </div>
            <Calendar className="text-blue-500" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Budget Used</p>
              <p className="text-xl font-bold">{budgetUtilization.toFixed(1)}%</p>
            </div>
            <div className={`radial-progress ${budgetUtilization > 100 ? 'text-red-500' : 'text-green-500'}`}>
              <svg className="w-6 h-6">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${(budgetUtilization / 100) * 62.83} 62.83`}
                  transform="rotate(-90 12 12)"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Unbudgeted Spending Alert */}
      {unbudgetedCategories.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-yellow-900">Unbudgeted Spending Detected</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have spending in the following categories without budgets:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unbudgetedCategories.map(cat => (
                  <span key={cat} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                    {cat}: £{monthlySpending[cat].toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget List */}
      {activeBudgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">
            No budgets set yet. Click "Set Budget" to start managing your spending!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeBudgets.map((budget) => {
            const spent = monthlySpending[budget.category] || 0;
            const isEditing = editingBudget === budget.id;

            return (
              <div key={budget.id}>
                {isEditing ? (
                  <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="font-semibold mb-3">{budget.category}</h3>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                      <button
                        onClick={() => handleSaveEdit(budget.id)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBudget(null)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <BudgetProgress
                    category={budget.category}
                    budgetAmount={budget.amount}
                    spent={spent}
                    onEdit={() => handleEdit(budget.id, budget.amount)}
                    onDelete={() => handleDelete(budget.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddBudgetModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
