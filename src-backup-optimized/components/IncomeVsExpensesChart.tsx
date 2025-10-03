import React, { useMemo } from 'react';
import { DynamicBarChart } from './charts/ChartMigration';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';

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
      
      data.push({
        month,
        income: Number(income.toFixed(2)),
        expenses: Number(expenses.toFixed(2)),
        net: Number((income - expenses).toFixed(2)),
      });
    }
    
    return data;
  }, [transactions]);

  const formatCurrencyShort = (value: number) => `£${value.toFixed(0)}`;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Income vs Expenses (Last 6 Months)</h3>
      <DynamicBarChart
          data={monthlyData}
          xDataKey="month"
          yDataKeys={['income', 'expenses']}
          height={200}
        />
    </div>
  );
});

export default IncomeVsExpensesChart;
