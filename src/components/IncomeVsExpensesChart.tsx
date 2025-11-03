import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';

const IncomeVsExpensesChart = React.memo(function IncomeVsExpensesChart() {
  const { transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  // Get last 6 months of data
  const monthlyData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const month = date.toLocaleDateString('en-UK', { month: 'short', year: '2-digit' });
      
      const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === date.getMonth() && 
               tDate.getFullYear() === date.getFullYear();
      });
      
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const incomeValue = toDecimal(income).toDecimalPlaces(2).toNumber();
      const expensesValue = toDecimal(expenses).toDecimalPlaces(2).toNumber();
      const netValue = toDecimal(income).minus(expenses).toDecimalPlaces(2).toNumber();

      data.push({
        month,
        income: incomeValue,
        expenses: expensesValue,
        net: netValue,
      });
    }
    
    return data;
  }, [transactions]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Income vs Expenses (Last 6 Months)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value: number) => formatCurrency(value)} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Bar dataKey="income" fill="#34c759" name="Income" />
          <Bar dataKey="expenses" fill="#ff3b30" name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export default IncomeVsExpensesChart;
