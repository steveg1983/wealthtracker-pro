import { useApp } from '../contexts/AppContext';
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import SpendingByCategoryChart from '../components/SpendingByCategoryChart';
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart';
import NetWorthTrendChart from '../components/NetWorthTrendChart';
import AccountBalancesChart from '../components/AccountBalancesChart';

export default function Dashboard() {
  const { getNetWorth, getTotalAssets, getTotalLiabilities, accounts, transactions } = useApp();

  const netWorth = getNetWorth();
  const assets = getTotalAssets();
  const liabilities = getTotalLiabilities();
  
  // Calculate monthly savings
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  
  const monthlyIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const monthlyExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const monthlySavings = monthlyIncome - monthlyExpenses;

  const formatCurrency = (amount: number) => {
    return `£${Math.abs(amount).toFixed(2)}`;
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Net Worth</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(netWorth)}
              </p>
              <p className={`text-sm mt-1 ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netWorth >= 0 ? <TrendingUp size={16} className="inline" /> : <TrendingDown size={16} className="inline" />}
                {' '}{netWorth >= 0 ? 'Positive' : 'Negative'}
              </p>
            </div>
            <Wallet className="text-primary" size={32} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Assets</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(assets)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {accounts.filter(a => ['checking', 'savings', 'investment'].includes(a.type)).length} accounts
              </p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Liabilities</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(liabilities)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {accounts.filter(a => ['credit', 'loan'].includes(a.type)).length} accounts
              </p>
            </div>
            <TrendingDown className="text-red-500" size={32} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Monthly Savings</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(monthlySavings)}
              </p>
              <p className={`text-sm mt-1 ${monthlySavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {monthlySavings >= 0 ? 'Surplus' : 'Deficit'} this month
              </p>
            </div>
            <PiggyBank className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Net Worth Trend - Full Width */}
        <NetWorthTrendChart />
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncomeVsExpensesChart />
          <SpendingByCategoryChart />
        </div>
        
        {/* Account Balances - Full Width */}
        {accounts.length > 0 && <AccountBalancesChart />}
      </div>
    </div>
  );
}
