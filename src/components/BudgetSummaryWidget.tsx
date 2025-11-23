import { useApp } from '../contexts/AppContextSupabase';
import { Target, AlertCircle } from './icons';
import { Link } from 'react-router-dom';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

export default function BudgetSummaryWidget() {
  const { budgets, transactions } = useApp();
  const { formatCurrency: _formatCurrency } = useCurrencyDecimal();
  
  // Calculate current month's spending
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

  // Get active budgets
  const activeBudgets = budgets.filter(b => b.isActive && b.period === 'monthly');
  
  // Find budgets that are over 80% spent
  const warningBudgets = activeBudgets.filter(budget => {
    const spent = monthlySpending[budget.categoryId] || 0;
    const percentage = (spent / budget.amount) * 100;
    return percentage >= 80;
  });

  if (activeBudgets.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          Budget Overview
        </h3>
        <p className="text-gray-500 text-center py-4">
          No budgets set. 
          <Link to="/budget" className="text-primary hover:text-secondary ml-1">
            Set up budgets
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Target size={20} />
        Budget Overview
      </h3>
      
      {warningBudgets.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-yellow-600 mt-0.5" size={16} />
            <div className="text-sm">
              <p className="font-medium text-yellow-900">
                {warningBudgets.length} budget{warningBudgets.length > 1 ? 's' : ''} need attention
              </p>
              <p className="text-yellow-700">
                {warningBudgets.map(b => b.categoryId).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {activeBudgets.slice(0, 3).map(budget => {
          const spent = monthlySpending[budget.categoryId] || 0;
          const percentage = Math.min((spent / budget.amount) * 100, 100);
          
          return (
            <div key={budget.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{budget.categoryId}</span>
                <span className="text-gray-600">
                  {formatCurrency(spent)} / {formatCurrency(budget.amount)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    percentage >= 100 ? 'bg-red-500' :
                    percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <Link 
        to="/budget" 
        className="block text-center text-sm text-primary hover:text-secondary mt-4"
      >
        View all budgets →
      </Link>
    </div>
  );
}
