import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../../../hooks/useCurrencyDecimal';
import { TrendingUpIcon, TrendingDownIcon, ActivityIcon, DollarSignIcon } from '../../icons';
import { toDecimal } from '../../../utils/decimal';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface InvestmentPerformanceWidgetProps {
  isCompact?: boolean;
}

export default function InvestmentPerformanceWidget({ isCompact = false }: InvestmentPerformanceWidgetProps): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions } = useApp();
  const { formatCurrency } = useCurrencyDecimal();

  const investmentData = useMemo(() => {
    // Get investment accounts
    const investmentAccounts = accounts.filter(acc => 
      acc.type === 'investment' || acc.type === 'retirement'
    );

    // Calculate total portfolio value
    const totalValue = investmentAccounts.reduce((sum, acc) => 
      sum.plus(toDecimal(acc.balance)), toDecimal(0)
    );

    // Calculate mock performance data (in production, this would come from market data API)
    const currentMonth = new Date().getMonth();
    const mockMonthlyReturns = [2.3, -1.2, 3.5, 0.8, -0.5, 2.1, 1.9, -0.3, 2.8, 1.5, 0.9, 3.2];
    const monthlyReturn = mockMonthlyReturns[currentMonth];
    const ytdReturn = mockMonthlyReturns.slice(0, currentMonth + 1).reduce((sum, r) => sum + r, 0);
    
    // Calculate gains/losses
    const dayChange = totalValue.times(0.0045); // Mock daily change
    const monthChange = totalValue.times(monthlyReturn / 100);
    const yearChange = totalValue.times(ytdReturn / 100);

    // Generate chart data (mock historical values)
    const chartLabels = ['6M ago', '5M ago', '4M ago', '3M ago', '2M ago', '1M ago', 'Today'];
    const baseValue = totalValue.toNumber();
    const chartData = [
      baseValue * 0.92,
      baseValue * 0.94,
      baseValue * 0.91,
      baseValue * 0.95,
      baseValue * 0.97,
      baseValue * 0.98,
      baseValue
    ];

    // Find best and worst performers (mock data)
    const performers = investmentAccounts.map(acc => ({
      name: acc.name,
      value: acc.balance,
      change: (Math.random() - 0.5) * 10, // Mock daily change percentage
      changeAmount: toDecimal(acc.balance).times((Math.random() - 0.5) * 0.1)
    })).sort((a, b) => b.change - a.change);

    return {
      totalValue,
      accountCount: investmentAccounts.length,
      dayChange,
      monthChange,
      yearChange,
      monthlyReturn,
      ytdReturn,
      chartLabels,
      chartData,
      topPerformer: performers[0],
      worstPerformer: performers[performers.length - 1],
      accounts: investmentAccounts
    };
  }, [accounts]);

  if (investmentData.accountCount === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUpIcon size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No investment accounts</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Add investment accounts to track performance
        </p>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return formatCurrency(context.parsed.y);
          }
        }
      }
    },
    scales: {
      x: {
        display: !isCompact,
        grid: {
          display: false
        }
      },
      y: {
        display: !isCompact,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value: any) => {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const chartDataConfig = {
    labels: investmentData.chartLabels,
    datasets: [
      {
        label: 'Portfolio Value',
        data: investmentData.chartData,
        borderColor: investmentData.yearChange.isPositive() ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: investmentData.yearChange.isPositive() 
          ? 'rgba(34, 197, 94, 0.1)' 
          : 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  return (
    <div className="space-y-4">
      {/* Portfolio Value */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Portfolio Value</span>
          <ActivityIcon size={16} className="text-gray-400" />
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(investmentData.totalValue.toNumber())}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`flex items-center gap-1 ${
            investmentData.dayChange.isPositive() ? 'text-green-600' : 'text-red-600'
          }`}>
            {investmentData.dayChange.isPositive() ? (
              <TrendingUpIcon size={14} />
            ) : (
              <TrendingDownIcon size={14} />
            )}
            <span className="text-sm font-medium">
              {investmentData.dayChange.isPositive() ? '+' : ''}{formatCurrency(investmentData.dayChange.toNumber())}
            </span>
          </div>
          <span className="text-xs text-gray-400">Today</span>
        </div>
      </div>

      {/* Performance Chart */}
      {!isCompact && (
        <div className="h-32">
          <Line data={chartDataConfig} options={chartOptions} />
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className={`text-sm font-semibold ${
            investmentData.monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {investmentData.monthlyReturn >= 0 ? '+' : ''}{investmentData.monthlyReturn.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Month</div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className={`text-sm font-semibold ${
            investmentData.ytdReturn >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {investmentData.ytdReturn >= 0 ? '+' : ''}{investmentData.ytdReturn.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">YTD</div>
        </div>
        
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {investmentData.accountCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Accounts</div>
        </div>
      </div>

      {/* Top/Bottom Performers */}
      {!isCompact && investmentData.topPerformer && investmentData.worstPerformer && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Best Today</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {investmentData.topPerformer.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-green-600">
                +{investmentData.topPerformer.change.toFixed(1)}%
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Worst Today</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {investmentData.worstPerformer.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-red-600">
                {investmentData.worstPerformer.change.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Button */}
      <button
        onClick={() => navigate('/investments')}
        className="w-full text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-center py-2"
      >
        View Portfolio →
      </button>
    </div>
  );
}