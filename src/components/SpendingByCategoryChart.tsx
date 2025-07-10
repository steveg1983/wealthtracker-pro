import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useApp } from '../contexts/AppContext';

export default function SpendingByCategoryChart() {
  const { transactions } = useApp();
  
  // Calculate spending by category for the current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const categoryTotals = transactions
    .filter(t => {
      const transDate = new Date(t.date);
      return t.type === 'expense' && 
             transDate.getMonth() === currentMonth && 
             transDate.getFullYear() === currentYear;
    })
    .reduce((acc, t) => {
      acc[t.category || 'Other'] = (acc[t.category || 'Other'] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const data = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2)),
  }));

  const COLORS = [
    '#0078d4', '#34c759', '#ff3b30', '#ff9500', '#af52de',
    '#5ac8fa', '#ffcc00', '#ff2d55', '#4cd964', '#007aff'
  ];

  const formatCurrency = (value: number) => `£${value.toFixed(2)}`;

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
        <p className="text-gray-500 text-center py-8">No expenses this month</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Spending by Category (This Month)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={formatCurrency} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
