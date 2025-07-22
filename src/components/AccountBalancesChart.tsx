import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

const AccountBalancesChart = React.memo(function AccountBalancesChart() {
  const { accounts } = useApp();
  const { formatCurrency, getCurrencySymbol, displayCurrency } = useCurrencyDecimal();
  
  const data = useMemo(() => 
    accounts.map(account => ({
      name: account.name,
      balance: account.balance,
      type: account.type,
    })), [accounts]);

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

  const formatCurrencyShort = (value: number) => `${getCurrencySymbol(displayCurrency)}${Math.abs(value).toFixed(0)}`;

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Account Balances</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatCurrencyShort} />
          <YAxis dataKey="name" type="category" width={100} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="balance">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default AccountBalancesChart;
