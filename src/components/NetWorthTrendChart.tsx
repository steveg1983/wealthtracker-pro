import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';

export default function NetWorthTrendChart() {
  const { transactions, accounts } = useApp();
  
  // Calculate net worth over the last 30 days
  const data = [];
  const today = new Date();
  
  // Start with current balances and work backwards
  let runningBalances = accounts.reduce((acc, account) => {
    acc[account.id] = account.balance;
    return acc;
  }, {} as Record<string, number>);
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Apply transactions for this day (in reverse)
    const dayTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.toDateString() === date.toDateString();
    });
    
    // If we're looking at past days, reverse the transactions
    if (i > 0) {
      dayTransactions.forEach(t => {
        if (runningBalances[t.accountId] !== undefined) {
          if (t.type === 'income') {
            runningBalances[t.accountId] -= t.amount;
          } else {
            runningBalances[t.accountId] += t.amount;
          }
        }
      });
    }
    
    // Calculate net worth for this day
    const assets = Object.entries(runningBalances)
      .filter(([id]) => {
        const account = accounts.find(a => a.id === id);
        return account && ['checking', 'savings', 'investment'].includes(account.type);
      })
      .reduce((sum, [, balance]) => sum + balance, 0);
      
    const liabilities = Object.entries(runningBalances)
      .filter(([id]) => {
        const account = accounts.find(a => a.id === id);
        return account && ['credit', 'loan'].includes(account.type);
      })
      .reduce((sum, [, balance]) => sum + Math.abs(balance), 0);
    
    data.push({
      date: date.toLocaleDateString('en-UK', { day: 'numeric', month: 'short' }),
      netWorth: Number((assets - liabilities).toFixed(2)),
    });
  }

  const formatCurrency = (value: number) => `£${value.toFixed(0)}`;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Net Worth Trend (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip formatter={formatCurrency} />
          <Line 
            type="monotone" 
            dataKey="netWorth" 
            stroke="#0078d4" 
            strokeWidth={2}
            dot={false}
            name="Net Worth"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
