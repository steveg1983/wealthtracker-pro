import { useApp } from '../contexts/AppContext';
import { BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';

export default function Analytics() {
  const { transactions, accounts } = useApp();
  const { formatCurrency } = useCurrency();

  // Calculate spending by category
  const spendingByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const categoryData = Object.entries(spendingByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average Monthly Income</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalIncome / 12)}
              </p>
            </div>
            <ArrowUpRight className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(totalExpenses / 12)}
              </p>
            </div>
            <ArrowDownRight className="text-red-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Savings Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {savingsRate.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {transactions.length}
              </p>
            </div>
            <BarChart3 className="text-purple-500" size={24} />
          </div>
        </div>
      </div>

      {/* Income vs Expenses Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Income vs Expenses</h2>
        <div className="h-64">
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
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="income" fill="#10B981" name="Income" />
              <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Spending by Category */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Spending by Category</h2>
          <div className="h-64">
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
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #ccc',
                    borderRadius: '8px'
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Balance Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Account Balance Trend</h2>
          <div className="h-64">
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
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #ccc',
                    borderRadius: '8px'
                  }}
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
        </div>
      </div>

      {/* Top Expenses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Top Expenses</h2>
        <div className="space-y-3">
          {topExpenses.map((expense, index) => (
            <div key={expense.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{expense.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {expense.category} • {new Date(expense.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                -{formatCurrency(expense.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}