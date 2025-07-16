import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { PieChart, TrendingUp, Calendar, Download, Filter } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Reports() {
  const { transactions, accounts } = useApp();
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  // Filter transactions based on date range and account
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    return transactions.filter(t => {
      const transDate = new Date(t.date);
      const dateMatch = transDate >= startDate;
      const accountMatch = selectedAccount === 'all' || t.accountId === selectedAccount;
      return dateMatch && accountMatch;
    });
  }, [transactions, dateRange, selectedAccount]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = income - expenses;
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;

    return { income, expenses, netIncome, savingsRate };
  }, [filteredTransactions]);

  // Prepare data for category breakdown
  const categoryData = useMemo(() => {
    const categoryTotals = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8);

    return {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [{
        data: sortedCategories.map(([, amount]) => amount),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
          '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
        ]
      }]
    };
  }, [filteredTransactions]);

  // Prepare data for monthly trend
  const monthlyTrendData = useMemo(() => {
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    filteredTransactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expenses += t.amount;
      }
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    
    return {
      labels: sortedMonths.map(month => {
        const date = new Date(month + '-01');
        return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Income',
          data: sortedMonths.map(month => monthlyData[month].income),
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          tension: 0.4
        },
        {
          label: 'Expenses',
          data: sortedMonths.map(month => monthlyData[month].expenses),
          borderColor: '#EF4444',
          backgroundColor: '#EF444420',
          tension: 0.4
        }
      ]
    };
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Account'];
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.description,
      t.category,
      t.type,
      t.amount.toString(),
      accounts.find(a => a.id === t.accountId)?.name || 'Unknown'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Reports</h1>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-2xl hover:bg-secondary transition-colors"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-500" size={20} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'month' | 'quarter' | 'year' | 'all')}
              className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-500" size={20} />
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="all">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content grid with consistent spacing */}
      <div className="grid gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(summary.income)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(summary.expenses)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Income</p>
          <p className={`text-2xl font-bold ${
            summary.netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(summary.netIncome)}
          </p>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Savings Rate</p>
          <p className={`text-2xl font-bold ${
            summary.savingsRate >= 20 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {summary.savingsRate.toFixed(1)}%
          </p>
        </div>
        </div>

        {/* Charts */}
        <div className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-800 dark:text-white">
            <TrendingUp size={20} />
            Income vs Expenses Trend
          </h2>
          <div className="h-64">
            <Line
              data={monthlyTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-800 dark:text-white">
            <PieChart size={20} />
            Expense Categories
          </h2>
          <div className="h-64">
            <Doughnut
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right'
                  }
                }
              }}
            />
          </div>
        </div>
        </div>
        </div>

        {/* Top Transactions */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-white">Top Transactions</h2>
        </div>
        {/* Mobile card view */}
        <div className="block sm:hidden">
          <div className="space-y-3">
            {filteredTransactions
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 10)
              .map((transaction) => (
                <div key={transaction.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.category}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
        
        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10)
                .map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                      {transaction.category}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
