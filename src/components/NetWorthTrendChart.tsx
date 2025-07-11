import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';

export default function NetWorthTrendChart() {
  const { accounts, transactions } = useApp();

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return '£' + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  };

  // Calculate net worth over the last 6 months
  const generateNetWorthData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      // Calculate net worth at the end of that month
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Get all transactions up to that month
      const relevantTransactions = transactions.filter(t => 
        new Date(t.date) <= monthEnd
      );
      
      // Calculate the balance change from transactions
      const transactionBalance = relevantTransactions.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount;
        if (t.type === 'expense') return sum - t.amount;
        return sum;
      }, 0);
      
      // For simplicity, we'll use current account balances
      // In a real app, you'd track historical balances
      const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      
      data.push({
        month: monthName,
        balance: totalBalance + (transactionBalance * (i / 5))
      });
    }
    
    return data;
  };

  const data = generateNetWorthData();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Net Worth Trend</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" />
            <YAxis 
              stroke="#9CA3AF"
              tickFormatter={(value: number) => `£${(value / 1000).toFixed(0)}k`}
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
  );
}
