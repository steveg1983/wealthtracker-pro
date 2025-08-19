import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { BarChart3Icon, TrendingUpIcon, ArrowUpRightIcon, ArrowDownRightIcon } from '../components/icons';
// Use optimized lazy-loaded charts to reduce bundle size
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend } from '../components/charts/OptimizedCharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import { DraggableGrid } from '../components/layout/DraggableGrid';
import { GridItem } from '../components/layout/GridItem';
import PageWrapper from '../components/PageWrapper';
import { calculateCategorySpending, calculateTotalIncome, calculateTotalExpenses, calculateTotalBalance } from '../utils/calculations-decimal';
import { toDecimal } from '../utils/decimal';
import TreemapChart from '../components/charts/TreemapChart';
import SankeyChart from '../components/charts/SankeyChart';

export default function Analytics() {
  const { transactions, accounts, categories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { layouts, updateAnalyticsLayout, resetAnalyticsLayout } = useLayoutConfig();
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  // Calculate spending by category using decimal precision
  const categoryData = useMemo(() => {
    // Convert transactions to decimal for calculations
    const decimalTransactions = transactions.map(t => ({
      ...t,
      amount: toDecimal(t.amount)
    }));
    const expenseCategories = categories.filter(cat => cat.type === 'expense' || cat.type === 'both');
    
    return expenseCategories
      .map(category => {
        const spending = calculateCategorySpending(category.id, decimalTransactions);
        return {
          name: category.name,
          value: spending.toNumber()
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, transactions]);

  // Calculate monthly trends
  const monthlyData = useMemo(() => {
    // Convert transactions to decimal for calculations
    const decimalTransactions = transactions.map(t => ({
      ...t,
      amount: toDecimal(t.amount)
    }));
    const currentYear = new Date().getFullYear();
    
    return Array.from({ length: 12 }, (_, i) => {
      const month = new Date(currentYear, i).toLocaleString('default', { month: 'short' });
      const monthTransactions = decimalTransactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === i && date.getFullYear() === currentYear;
      });

      const income = calculateTotalIncome(monthTransactions);
      const expenses = calculateTotalExpenses(monthTransactions);

      return { 
        month, 
        income: income.toNumber(), 
        expenses: expenses.toNumber() 
      };
    });
  }, [transactions]);

  // Calculate account balance trends based on real transactions
  const accountTrends = useMemo(() => {
    // Convert to decimal for calculations
    const decimalAccounts = accounts.map(a => ({
      ...a,
      balance: toDecimal(a.balance),
      initialBalance: a.openingBalance ? toDecimal(a.openingBalance) : undefined
    }));
    const decimalTransactions = transactions.map(t => ({
      ...t,
      amount: toDecimal(t.amount)
    }));
    const now = new Date();
    
    // Get current total balance with decimal precision
    const currentTotalBalance = calculateTotalBalance(decimalAccounts);
    
    // Sort transactions by date
    const sortedTransactions = [...decimalTransactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const trendData = [];
    
    // Calculate balance for each of the last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
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
          return t.type === 'income' ? net.plus(t.amount) : net.minus(t.amount);
        }, toDecimal(0));
        balance = currentTotalBalance.minus(futureNetChange);
      }
      
      trendData.push({
        month: monthDate.toLocaleString('default', { month: 'short' }),
        balance: Math.max(0, balance.toNumber())
      });
    }
    
    return trendData;
  }, [accounts, transactions]);

  // Calculate top expenses
  const topExpenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Calculate savings rate
  const { totalIncome, totalExpenses, savingsRate } = useMemo(() => {
    // Convert transactions to decimal for calculations
    const decimalTransactions = transactions.map(t => ({
      ...t,
      amount: toDecimal(t.amount)
    }));
    const income = calculateTotalIncome(decimalTransactions);
    const expenses = calculateTotalExpenses(decimalTransactions);
    const rate = income.greaterThan(0) 
      ? income.minus(expenses).dividedBy(income).times(100).toNumber() 
      : 0;
    
    return {
      totalIncome: income.toNumber(),
      totalExpenses: expenses.toNumber(),
      savingsRate: rate
    };
  }, [transactions]);

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
    <PageWrapper 
      title="Analytics"
      rightContent={
        <div 
          onClick={() => setShowLayoutControls(!showLayoutControls)}
          className="cursor-pointer"
          title="Customize Layout"
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
              <circle cx="12" cy="12" r="3" stroke="#1F2937" strokeWidth="2" fill="none" />
              <path d="M12 1v6m0 6v6m6-12h6M1 12h6m11.66-7.66l-1.42 1.42M7.24 16.76l-1.42 1.42m0-11.84l1.42 1.42M16.76 16.76l1.42 1.42" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      }
    >

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
            <ArrowUpRightIcon className="text-green-500" size={24} />
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
            <ArrowDownRightIcon className="text-red-500" size={24} />
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
            <TrendingUpIcon className="text-blue-500" size={24} />
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
            <BarChart3Icon className="text-purple-500" size={24} />
          </div>
        </div>
        </div>

        {/* Draggable Widgets */}
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
              {categoryData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <BarChart3Icon className="mx-auto text-gray-400 mb-3" size={48} />
                    <p className="text-gray-600 dark:text-gray-400">No spending data available</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Add transactions to see your spending breakdown
                    </p>
                  </div>
                </div>
              )}
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
              <div className="text-center p-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <TrendingUpIcon className="text-blue-600 dark:text-blue-400" size={32} />
                </div>
                <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-semibold rounded-full mb-3">
                  COMING SOON
                </span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  AI-Powered Financial Forecasting
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  Advanced predictive analytics will forecast your future income, expenses, and savings based on historical patterns and trends
                </p>
              </div>
            </div>
          </GridItem>
        </div>

        {/* Treemap Chart */}
        <div key="treemap">
          <GridItem key="treemap-grid" title="Expense Breakdown">
            <div className="h-full min-h-[200px] flex items-center justify-center">
              <div className="text-center p-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                  <BarChart3Icon className="text-purple-600 dark:text-purple-400" size={32} />
                </div>
                <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-semibold rounded-full mb-3">
                  COMING SOON
                </span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Interactive Expense Breakdown
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  Visualize your spending patterns with an interactive treemap showing hierarchical category breakdowns
                </p>
              </div>
            </div>
          </GridItem>
        </div>

        {/* Sankey Chart */}
        <div key="sankey">
          <GridItem key="sankey-grid" title="Cash Flow">
            <div className="h-full min-h-[200px] flex items-center justify-center">
              <div className="text-center p-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <ArrowUpRightIcon className="text-green-600 dark:text-green-400" size={32} />
                </div>
                <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-semibold rounded-full mb-3">
                  COMING SOON
                </span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Cash Flow Visualization
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  Track the flow of money through your accounts with an interactive Sankey diagram showing income sources and expense destinations
                </p>
              </div>
            </div>
          </GridItem>
        </div>
        </DraggableGrid>

        {/* Layout Controls */}
        {showLayoutControls && (
          <div className="flex gap-2 justify-center mb-4">
            <button 
              onClick={() => setShowLayoutControls(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done Editing
            </button>
            <button 
              onClick={resetAnalyticsLayout} 
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Reset Layout
            </button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}