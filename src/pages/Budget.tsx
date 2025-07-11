cat > src/pages/Budget.tsx << 'EOF'
import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import AddBudgetModal from '../components/AddBudgetModal';
import { Plus, TrendingUp, TrendingDown, AlertCircle, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function Budget() {
  const { budgets, transactions, updateBudget, deleteBudget } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  // Helper function to format currency properly
  const formatCurrency = (amount: number): string => {
    return '£' + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  };

  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate spending by category for current month
  const getMonthlySpending = (category: string) => {
    return transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return t.type === 'expense' && 
               t.category === category &&
               transDate.getMonth() === currentMonth &&
               transDate.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Calculate budget progress
  const getBudgetProgress = (budget: typeof budgets[0]) => {
    let monthlyBudget = budget.amount;
    
    // Convert to monthly if needed
    if (budget.period === 'yearly') {
      monthlyBudget = budget.amount / 12;
    } else if (budget.period === 'weekly') {
      monthlyBudget = budget.amount * 4.33; // Average weeks per month
    }

    const spent = getMonthlySpending(budget.category);
    const remaining = monthlyBudget - spent;
    const percentUsed = (spent / monthlyBudget) * 100;

    return { monthlyBudget, spent, remaining, percentUsed };
  };

  const handleEdit = (budgetId: string, currentAmount: number) => {
    setEditingId(budgetId);
    setEditAmount(currentAmount.toString());
  };

  const handleSaveEdit = (budgetId: string) => {
    updateBudget(budgetId, { amount: parseFloat(editAmount) || 0 });
    setEditingId(null);
    setEditAmount('');
  };

  const handleToggleActive = (budgetId: string, currentActive: boolean) => {
    updateBudget(budgetId, { isActive: !currentActive });
  };

  const handleDelete = (budgetId: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      deleteBudget(budgetId);
    }
  };

  // Calculate totals
  const activeBudgets = budgets.filter(b => b.isActive);
  const totalMonthlyBudget = activeBudgets.reduce((sum, budget) => {
    if (budget.period === 'yearly') return sum + budget.amount / 12;
    if (budget.period === 'weekly') return sum + budget.amount * 4.33;
    return sum + budget.amount;
  }, 0);
  
  const totalSpent = activeBudgets.reduce((sum, budget) => {
    return sum + getMonthlySpending(budget.category);
  }, 0);

  const totalRemaining = totalMonthlyBudget - totalSpent;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Budget</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Create Budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Budget</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalMonthlyBudget)}
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Spent This Month</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalSpent)}
              </p>
            </div>
            <TrendingDown className="text-orange-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
              <p className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalRemaining)}
              </p>
            </div>
            <AlertCircle className={totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'} size={24} />
          </div>
        </div>
      </div>

      {/* Budget List */}
      <div className="space-y-4">
        {budgets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No budgets set up yet. Click "Create Budget" to get started!
            </p>
          </div>
        ) : (
          budgets.map(budget => {
            const { monthlyBudget, spent, remaining, percentUsed } = getBudgetProgress(budget);
            const isOverBudget = percentUsed > 100;
            const isNearLimit = percentUsed > 80 && percentUsed <= 100;
            
            return (
              <div key={budget.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${!budget.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{budget.category}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({budget.period})
                    </span>
                    <button
                      onClick={() => handleToggleActive(budget.id, budget.isActive)}
                      className={`p-1 rounded ${budget.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}
                      title={budget.isActive ? 'Active' : 'Inactive'}
                    >
                      {budget.isActive ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === budget.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(budget.id)}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(budget.id, budget.amount)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(budget.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {budget.isActive && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(spent)} of {formatCurrency(monthlyBudget)}
                      </span>
                      <span className={`text-sm font-medium ${
                        isOverBudget ? 'text-red-600 dark:text-red-400' : 
                        isNearLimit ? 'text-orange-600 dark:text-orange-400' : 
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {percentUsed.toFixed(1)}% used
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isOverBudget ? 'bg-red-500' : 
                          isNearLimit ? 'bg-orange-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                      />
                    </div>

                    <p className={`text-sm ${remaining >= 0 ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                      {remaining >= 0 ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(Math.abs(remaining))} over budget`}
                    </p>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <AddBudgetModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}
EOF