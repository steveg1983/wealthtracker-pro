import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import SpendingByCategoryChart from '../components/SpendingByCategoryChart';
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart';
import NetWorthTrendChart from '../components/NetWorthTrendChart';
import AccountBalancesChart from '../components/AccountBalancesChart';
import { Calendar, TrendingUp, PieChart, BarChart3 } from 'lucide-react';

export default function Analytics() {
  const { transactions, accounts } = useApp();
  const [timeRange, setTimeRange] = useState('30days');

  // Calculate key metrics
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const avgDailySpending = transactions.length > 0 
    ? totalExpenses / 30 
    : 0;
    
  const savingsRate = totalIncome > 0 
    ? ((totalIncome - totalExpenses) / totalIncome) * 100 
    : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <TrendingUp size={16} />
            <span className="text-sm">Total Income</span>
          </div>
          <p className="text-xl font-bold">£{totalIncome.toFixed(2)}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <BarChart3 size={16} />
            <span className="text-sm">Total Expenses</span>
          </div>
          <p className="text-xl font-bold">£{totalExpenses.toFixed(2)}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar size={16} />
            <span className="text-sm">Avg Daily Spending</span>
          </div>
          <p className="text-xl font-bold">£{avgDailySpending.toFixed(2)}</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <PieChart size={16} />
            <span className="text-sm">Savings Rate</span>
          </div>
          <p className="text-xl font-bold">{savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="space-y-6">
        <NetWorthTrendChart />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncomeVsExpensesChart />
          <SpendingByCategoryChart />
        </div>
        
        {accounts.length > 0 && <AccountBalancesChart />}
        
        {/* Top Spending Categories */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Spending Categories</h3>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(
                transactions
                  .filter(t => t.type === 'expense')
                  .reduce((acc, t) => {
                    acc[t.category || 'Other'] = (acc[t.category || 'Other'] || 0) + t.amount;
                    return acc;
                  }, {} as Record<string, number>)
              )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([category, amount]) => (
                  <div key={category} className="flex justify-between items-center">
                    <span className="text-gray-700">{category}</span>
                    <span className="font-semibold">£{amount.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
