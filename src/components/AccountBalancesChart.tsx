import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../contexts/AppContext';

export default function AccountBalancesChart() {
  const { accounts } = useApp();
  
  const data = accounts.map(account => ({
    name: account.name,
    balance: account.balance,
    type: account.type,
  }));

  const getColor = (type: string) => {
    const colors: Record<string, string> = {
      checking: '#0078d4',
      savings: '#34c759',
      credit: '#ff3b30',
      investment: '#af52de',
      loan: '#ff9500',
      other: '#5ac8fa',
    };
    return colors[type] || colors.other;
  };

  const formatCurrency = (value: number) => `£${Math.abs(value).toFixed(0)}`;

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Account Balances</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatCurrency} />
          <YAxis dataKey="name" type="category" width={100} />
          <Tooltip formatter={(value: number) => `£${value.toFixed(2)}`} />
          <Bar dataKey="balance">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
