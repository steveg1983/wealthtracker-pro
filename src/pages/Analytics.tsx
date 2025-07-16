import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import { DraggableGrid } from '../components/layout/DraggableGrid';
import { GridItem } from '../components/layout/GridItem';

export default function Analytics() {
  const { transactions, accounts } = useApp();
  const { formatCurrency } = useCurrency();
  const { layouts, updateAnalyticsLayout, resetAnalyticsLayout } = useLayoutConfig();
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  // Calculate spending by category
  const spendingByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const categoryData = Object.entries(spendingByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number));

  // Calculate monthly trends
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(2024, i).toLocaleString('default', { month: 'short' });
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === i && date.getFullYear() === 2024;
    });

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { month, income, expenses };
  });

  // Calculate account balance trends based on real transactions
  const calculateAccountTrends = () => {
    const now = new Date();
    
    // Get current total balance
    const currentTotalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const trendData = [];
    
    // Calculate balance for each of the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // Get all transactions up to the end of this month
      const transactionsUpToMonth = sortedTransactions.filter(t => 
        new Date(t.date) <= monthEnd
      );
      
      // Calculate net change from transactions
      transactionsUpToMonth.reduce((net, t) => {
        return net + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);
      
      // For current month, use actual balance
      let balance;
      if (i === 0) {
        balance = currentTotalBalance;
      } else {
        // For past months, work backwards from current balance
        const futureTransactions = sortedTransactions.filter(t => 
          new Date(t.date) > monthEnd
        );
        const futureNetChange = futureTransactions.reduce((net, t) => {
          return net + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);
        balance = currentTotalBalance - futureNetChange;
      }
      
      trendData.push({
        month: monthDate.toLocaleString('default', { month: 'short' }),
        balance: Math.max(0, balance)
      });
    }
    
    return trendData;
  };
  
  const accountTrends = calculateAccountTrends();

  // Calculate top expenses
  const topExpenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Calculate savings rate
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // Memoize chart styles
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  const chartStyles = useMemo(() => ({
    tooltip: {
      backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      border: isDarkMode ? '1px solid #374151' : '1px solid #ccc',
      borderRadius: '8px',
      color: isDarkMode ? '#E5E7EB' : '#111827'
    }
  }), [isDarkMode]);

  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
        </div>
        <button
          onClick={() => setShowLayoutControls(!showLayoutControls)}
          className="p-2 rounded-2xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Customize Layout"
        >
          <Settings size={20} />
        </button>
      </div>

      {showLayoutControls && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            Drag the widgets below to rearrange your analytics dashboard. Resize by dragging the bottom-right corner.
          </p>
          <button
            onClick={resetAnalyticsLayout}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Reset to Default Layout
          </button>
        </div>
      )}

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Fixed Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Average Monthly Income</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalIncome / 12)}
              </p>
            </div>
            <ArrowUpRight className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Average Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalExpenses / 12)}
              </p>
            </div>
            <ArrowDownRight className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Savings Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {savingsRate.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Transactions</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {transactions.length}
              </p>
            </div>
            <BarChart3 className="text-purple-500" size={24} />
          </div>
        </div>
        </div>

        {/* Draggable Widgets */}
        <div>
          <DraggableGrid
          layouts={{ lg: layouts.analytics }}
          onLayoutChange={updateAnalyticsLayout}
          isDraggable={showLayoutControls}
          isResizable={showLayoutControls}
        >

        {/* Monthly Spending */}
        <div key="monthly-spending">
          <GridItem key="monthly-spending-grid" title="Income vs Expenses">
            <div className="h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => {
                      const formatted = formatCurrency(value);
                      if (value >= 1000) {
                        return `${formatted.charAt(0)}${(value / 1000).toFixed(0)}k`;
                      }
                      return formatted;
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={chartStyles.tooltip}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#10B981" name="Income" />
                  <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GridItem>
        </div>

        {/* Category Breakdown */}
        <div key="category-breakdown">
          <GridItem key="category-breakdown-grid" title="Spending by Category">
            <div className="h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={chartStyles.tooltip}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </GridItem>
        </div>

        {/* Income vs Expenses - duplicate key, changed to balance trend */}
        <div key="income-expenses">
          <GridItem key="income-expenses-grid" title="Account Balance Trend">
            <div className="h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accountTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => {
                      const formatted = formatCurrency(value);
                      if (value >= 1000) {
                        return `${formatted.charAt(0)}${(value / 1000).toFixed(0)}k`;
                      }
                      return formatted;
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={chartStyles.tooltip}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={{ fill: '#8B5CF6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GridItem>
        </div>

        {/* Net Worth - changed to top expenses */}
        <div key="net-worth">
          <GridItem key="net-worth-grid" title="Top Expenses">
            <div className="space-y-2 overflow-auto" style={{ maxHeight: '300px' }}>
              {topExpenses.map((expense, index) => (
                <div key={expense.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-500 dark:text-gray-300">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{expense.description}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {expense.category} • {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-base font-semibold text-red-600 dark:text-red-400">
                    -{formatCurrency(expense.amount)}
                  </p>
                </div>
              ))}
              {topExpenses.length === 0 && (
                <p className="text-gray-600 dark:text-gray-300 text-center py-4">
                  No expenses yet
                </p>
              )}
            </div>
          </GridItem>
        </div>

        {/* Forecast - placeholder for future implementation */}
        <div key="forecast">
          <GridItem key="forecast-grid" title="Financial Forecast">
            <div className="h-full min-h-[200px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Forecast visualization coming soon
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  This will show predicted income, expenses, and savings based on historical data
                </p>
              </div>
            </div>
          </GridItem>
        </div>
          </DraggableGrid>
        </div>

        {/* Layout Controls */}
        {showLayoutControls && (
          <div className="layout-controls">
            <button onClick={() => setShowLayoutControls(false)}>
              Done Editing
            </button>
            <button onClick={resetAnalyticsLayout} className="secondary">
              Reset Layout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}