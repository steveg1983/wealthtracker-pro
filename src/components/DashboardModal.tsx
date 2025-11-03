import { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import { MaximizeIcon } from './icons/MaximizeIcon';
import { MinimizeIcon } from './icons/MinimizeIcon';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import IncomeExpenditureReport from './IncomeExpenditureReport';
import type { ReportSettings } from './IncomeExpenditureReport';
import ErrorBoundary from './ErrorBoundary';
import { formatDecimal } from '../utils/decimal-format';

interface NetWorthData {
  month: string;
  netWorth: number;
}

interface AccountDistributionData {
  id: string;
  name: string;
  value: number;
}

interface ReconciliationData {
  account: {
    id: string;
    name: string;
  };
  unreconciledCount: number;
  totalToReconcile: number;
}

interface IncomeExpenditureData {
  settings: ReportSettings;
  setSettings: (settings: ReportSettings | ((prev: ReportSettings) => ReportSettings)) => void;
  categories: Array<{
    id: string;
    name: string;
    type: 'income' | 'expense' | 'both';
    level: 'type' | 'sub' | 'detail';
    parentId?: string;
    color?: string;
    icon?: string;
    isSystem?: boolean;
    isHeader?: boolean;
  }>;
  transactions: Array<{
    id: string;
    date: Date;
    amount: number;
    description: string;
    category: string;
    accountId: string;
    type: 'income' | 'expense' | 'transfer';
    tags?: string[];
    notes?: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other';
    balance: number;
    currency: string;
    lastUpdated: Date;
  }>;
}

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'networth-chart' | 'account-distribution' | 'income-expenditure' | 'reconciliation' | null;
  data?: NetWorthData[] | AccountDistributionData[] | ReconciliationData[] | IncomeExpenditureData;
  chartStyles?: {
    tooltip?: React.CSSProperties;
    pieTooltip?: React.CSSProperties;
  };
}

export default function DashboardModal({ 
  isOpen, 
  onClose, 
  title, 
  type, 
  data,
  chartStyles 
}: DashboardModalProps) {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrencyDecimal();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatAxisTick = (value: number) => {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) {
      return `${formatDecimal(value / 1_000_000, 1)}M`;
    }
    if (absolute >= 1_000) {
      return `${formatDecimal(value / 1_000, 0)}K`;
    }
    return formatDecimal(value, 0);
  };

  // Reset fullscreen state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsFullscreen(false);
    }
  }, [isOpen]);

  if (!isOpen || !type) return null;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const renderContent = () => {
    switch (type) {
      case 'networth-chart':
        return (
          <div className={isFullscreen ? "h-[calc(100vh-200px)]" : "h-96"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data as NetWorthData[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  stroke="#6B7280"
                  fontSize={14}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={14}
                  tickFormatter={formatAxisTick}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                  contentStyle={chartStyles?.tooltip}
                />
                <Bar 
                  dataKey="netWorth" 
                  fill="#8B5CF6" 
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  onClick={(data: unknown) => {
                    const monthData = data as { payload?: NetWorthData };
                    if (monthData?.payload?.month) {
                      navigate(`/networth/monthly/${monthData.payload.month}`);
                      onClose();
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'account-distribution':
        return (
          <div className={isFullscreen ? "h-[calc(100vh-200px)]" : "h-96"}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data as AccountDistributionData[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={isFullscreen ? 120 : 80}
                  outerRadius={isFullscreen ? 200 : 140}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(data) => {
                    navigate(`/transactions?account=${data.id}`);
                    onClose();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {(data as AccountDistributionData[])?.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={chartStyles?.pieTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'income-expenditure': {
        const incomeExpData = data as IncomeExpenditureData;
        return (
          <div className={isFullscreen ? "max-h-[calc(100vh-200px)] overflow-auto" : "max-h-96 overflow-auto"}>
            <ErrorBoundary>
              <IncomeExpenditureReport
                data={{
                  months: [],
                  categories: []
                }}
                settings={incomeExpData.settings}
                setSettings={incomeExpData.setSettings}
                categories={incomeExpData.categories}
                transactions={incomeExpData.transactions}
                accounts={incomeExpData.accounts}
                isModal={true}
              />
            </ErrorBoundary>
          </div>
        );
      }

      case 'reconciliation':
        return (
          <div className={isFullscreen ? "max-h-[calc(100vh-200px)] overflow-auto" : "max-h-96 overflow-auto"}>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">Accounts</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{(data as ReconciliationData[])?.length || 0}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-sm text-orange-600 dark:text-orange-400">Unreconciled</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {(data as ReconciliationData[])?.reduce((sum, acc) => sum + acc.unreconciledCount, 0) || 0}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Total Value</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency((data as ReconciliationData[])?.reduce((sum, acc) => sum + acc.totalToReconcile, 0) || 0)}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">
                <div>Account</div>
                <div className="text-center">Unreconciled</div>
                <div className="text-center">Total Amount</div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {(data as ReconciliationData[])?.map((account) => (
                  <div 
                    key={account.account.id}
                    className="grid grid-cols-3 gap-4 p-4 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    onClick={() => {
                      navigate(`/reconciliation?account=${account.account.id}`);
                      onClose();
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {account.account.name}
                    </div>
                    <div className="text-center text-sm font-medium text-orange-600 dark:text-orange-400">
                      {account.unreconciledCount}
                    </div>
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(account.totalToReconcile)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return <div>Content not available</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg w-full max-h-[90vh] overflow-hidden ${
        isFullscreen ? 'max-w-[95vw] h-[95vh]' : 'max-w-6xl'
      }`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <MinimizeIcon size={20} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <MaximizeIcon size={20} className="text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon size={24} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {renderContent()}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            💡 <strong>Tip:</strong> All interactive features from the dashboard are available in this expanded view. Use the {isFullscreen ? 'minimize' : 'maximize'} button for {isFullscreen ? 'normal' : 'fullscreen'} mode.
          </p>
        </div>
      </div>
    </div>
  );
}
