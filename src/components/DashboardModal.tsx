import { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import IncomeExpenditureReport from './IncomeExpenditureReport';
import ErrorBoundary from './ErrorBoundary';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'networth-chart' | 'account-distribution' | 'income-expenditure' | 'reconciliation' | null;
  data?: any;
  chartStyles?: any;
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
  const { formatCurrency } = useCurrency();
  const [isFullscreen, setIsFullscreen] = useState(false);

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
              <BarChart data={data}>
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
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
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
                  onClick={(data: any) => {
                    if (data && data.month) {
                      navigate(`/networth/monthly/${data.month}`);
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
                  data={data}
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
                  {data?.map((_: any, index: number) => (
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

      case 'income-expenditure':
        return (
          <div className={isFullscreen ? "max-h-[calc(100vh-200px)] overflow-auto" : "max-h-96 overflow-auto"}>
            <ErrorBoundary>
              <IncomeExpenditureReport
                data={data}
                settings={data.settings}
                setSettings={data.setSettings}
                categories={data.categories}
                isModal={true}
              />
            </ErrorBoundary>
          </div>
        );

      case 'reconciliation':
        return (
          <div className={isFullscreen ? "max-h-[calc(100vh-200px)] overflow-auto" : "max-h-96 overflow-auto"}>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">Accounts</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{data?.length || 0}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-sm text-orange-600 dark:text-orange-400">Unreconciled</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {data?.reduce((sum: number, acc: any) => sum + acc.unreconciledCount, 0) || 0}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Total Value</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(data?.reduce((sum: number, acc: any) => sum + acc.totalToReconcile, 0) || 0)}
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
                {data?.map((account: any) => (
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
                <Minimize2 size={20} className="text-gray-500 dark:text-gray-400" />
              ) : (
                <Maximize2 size={20} className="text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-500 dark:text-gray-400" />
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