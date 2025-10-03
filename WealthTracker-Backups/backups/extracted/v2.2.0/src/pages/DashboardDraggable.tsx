import { useState, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  PlusIcon,
  ChartBarIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BellIcon,
  CreditCardIcon,
  ChartPieIcon,
  PencilIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { toDecimal } from '../utils/decimal';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardWidget {
  id: string;
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  action?: () => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export default function DashboardDraggable(): React.JSX.Element {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, goals } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>({});

  useEffect(() => {
    // Load saved layouts from localStorage but merge with updated defaults
    const savedLayouts = localStorage.getItem('dashboardLayouts');
    if (savedLayouts) {
      const parsed = JSON.parse(savedLayouts);
      // Merge saved layouts with default layouts, prioritizing default heights
      const mergedLayouts = {
        lg: defaultLayouts.lg.map(defaultItem => {
          const savedItem = parsed.lg?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        }),
        md: defaultLayouts.md.map(defaultItem => {
          const savedItem = parsed.md?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        }),
        sm: defaultLayouts.sm.map(defaultItem => {
          const savedItem = parsed.sm?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        })
      };
      setLayouts(mergedLayouts);
    }
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  // Calculate total balance
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => {
      const balance = toDecimal(account.balance);
      return sum.plus(balance);
    }, toDecimal(0));
  }, [accounts]);

  // Calculate recent transactions stats
  const recentTransactionsStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthTransactions = transactions.filter(t => 
      new Date(t.date) >= startOfMonth
    );

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    return { income, expenses, total: income.minus(expenses) };
  }, [transactions]);

  // Calculate budget status
  const budgetStatus = useMemo(() => {
    const activeBudgets = budgets.filter(b => b.isActive);
    const overBudget = activeBudgets.filter(b => {
      const spent = toDecimal(b.spent || 0);
      const amount = toDecimal(b.amount);
      return spent.greaterThan(amount);
    });

    return {
      total: activeBudgets.length,
      overBudget: overBudget.length,
      percentage: activeBudgets.length > 0 
        ? Math.round((overBudget.length / activeBudgets.length) * 100)
        : 0
    };
  }, [budgets]);

  // Dashboard widgets configuration
  const widgets: DashboardWidget[] = [
    {
      id: 'accounts',
      title: 'Your accounts',
      subtitle: accounts.length === 0 ? 'No accounts to display' : 'See more',
      empty: accounts.length === 0,
      emptyMessage: 'You have no accounts to display',
      action: () => navigate('/accounts')
    },
    {
      id: 'transactions',
      title: 'Recent transactions',
      subtitle: transactions.length === 0 ? 'No transactions' : 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no transactions to display',
      action: () => navigate('/transactions')
    },
    {
      id: 'spending',
      title: 'Earning and spending',
      subtitle: 'See more',
      empty: transactions.length === 0,
      emptyMessage: 'You have no earning or spending data to display',
      action: () => navigate('/analytics')
    },
    {
      id: 'budgets',
      title: 'All budgets',
      subtitle: budgets.length === 0 ? 'No budgets to display' : 'See more',
      empty: budgets.length === 0,
      emptyMessage: 'You have no budgets to display',
      action: () => navigate('/budget')
    },
    {
      id: 'balance',
      title: 'Your balance',
      subtitle: 'Today',
      value: formatCurrency(totalBalance.toNumber()),
      action: () => navigate('/accounts')
    },
    {
      id: 'forecast',
      title: 'FORECAST',
      value: formatCurrency(0),
      color: 'blue',
      action: () => navigate('/forecasting')
    },
    {
      id: 'actual',
      title: 'ACTUAL', 
      value: formatCurrency(0),
      color: 'red',
      action: () => navigate('/transactions')
    },
    {
      id: 'savings',
      title: 'Savings Rate',
      subtitle: `Rolling Month • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      empty: true,
      emptyMessage: 'You have no earning or spending data to display'
    },
    {
      id: 'bills',
      title: 'Bill reminders',
      subtitle: 'Overdue bills',
      empty: true,
      emptyMessage: 'No overdue bills'
    },
    {
      id: 'overspent',
      title: 'Overspent budgets',
      subtitle: 'See more',
      empty: budgetStatus.overBudget === 0,
      emptyMessage: 'No overspent budgets',
      action: () => navigate('/budget')
    },
    {
      id: 'addTransaction',
      title: 'Add Transaction',
      action: () => navigate('/transactions?action=add')
    }
  ];

  const getWidgetIcon = (widgetId: string) => {
    switch (widgetId) {
      case 'accounts':
        return <CreditCardIcon className="w-5 h-5 text-gray-400" />;
      case 'transactions':
        return <BanknotesIcon className="w-5 h-5 text-gray-400" />;
      case 'spending':
        return <ChartPieIcon className="w-5 h-5 text-gray-400" />;
      case 'budgets':
        return <ChartBarIcon className="w-5 h-5 text-gray-400" />;
      case 'balance':
        return <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />;
      case 'bills':
        return <BellIcon className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  // Default layouts for different breakpoints
  const defaultLayouts = {
    lg: [
      { i: 'accounts', x: 0, y: 0, w: 3, h: 3 },
      { i: 'transactions', x: 3, y: 0, w: 3, h: 3 },
      { i: 'spending', x: 6, y: 0, w: 3, h: 3 },
      { i: 'budgets', x: 9, y: 0, w: 3, h: 3 },
      { i: 'balance', x: 0, y: 3, w: 6, h: 3 },
      { i: 'forecast', x: 6, y: 3, w: 3, h: 3 },
      { i: 'actual', x: 9, y: 3, w: 3, h: 3 },
      { i: 'savings', x: 6, y: 6, w: 3, h: 3 },
      { i: 'bills', x: 9, y: 6, w: 3, h: 3 },
      { i: 'overspent', x: 0, y: 7, w: 3, h: 3 },
      { i: 'addTransaction', x: 3, y: 7, w: 3, h: 3 }
    ],
    md: [
      { i: 'accounts', x: 0, y: 0, w: 5, h: 3 },
      { i: 'transactions', x: 5, y: 0, w: 5, h: 3 },
      { i: 'spending', x: 0, y: 3, w: 5, h: 3 },
      { i: 'budgets', x: 5, y: 3, w: 5, h: 3 },
      { i: 'balance', x: 0, y: 6, w: 10, h: 3 },
      { i: 'forecast', x: 0, y: 12, w: 5, h: 3 },
      { i: 'actual', x: 5, y: 12, w: 5, h: 3 },
      { i: 'savings', x: 0, y: 15, w: 5, h: 3 },
      { i: 'bills', x: 5, y: 15, w: 5, h: 3 },
      { i: 'overspent', x: 0, y: 18, w: 5, h: 3 },
      { i: 'addTransaction', x: 5, y: 18, w: 5, h: 3 }
    ],
    sm: [
      { i: 'accounts', x: 0, y: 0, w: 6, h: 3 },
      { i: 'transactions', x: 0, y: 3, w: 6, h: 3 },
      { i: 'spending', x: 0, y: 6, w: 6, h: 3 },
      { i: 'budgets', x: 0, y: 9, w: 6, h: 3 },
      { i: 'balance', x: 0, y: 12, w: 6, h: 3 },
      { i: 'forecast', x: 0, y: 16, w: 6, h: 3 },
      { i: 'actual', x: 0, y: 19, w: 6, h: 3 },
      { i: 'savings', x: 0, y: 22, w: 6, h: 3 },
      { i: 'bills', x: 0, y: 25, w: 6, h: 3 },
      { i: 'overspent', x: 0, y: 28, w: 6, h: 3 },
      { i: 'addTransaction', x: 0, y: 31, w: 6, h: 3 }
    ]
  };

  const handleLayoutChange = (layout: Layout[], layouts: Layouts) => {
    setLayouts(layouts);
    localStorage.setItem('dashboardLayouts', JSON.stringify(layouts));
  };

  const renderWidget = (widget: DashboardWidget) => {
    const handleClick = () => {
      if (!isEditMode && widget.action) {
        widget.action();
      }
    };

    // Special rendering for specific widgets
    if (widget.id === 'balance') {
      return (
        <div 
          className="h-full flex flex-col justify-center items-center bg-gradient-to-br from-secondary to-primary text-white rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all"
          onClick={handleClick}
        >
          <h3 className="text-lg font-medium mb-4">{widget.title}</h3>
          <div className="text-4xl font-bold mb-2">{widget.value}</div>
          <p className="text-sm opacity-90">{widget.subtitle}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 w-full">
            <div className="text-center">
              <div className="text-sm opacity-75">Income</div>
              <div className="text-lg font-semibold">
                {formatCurrency(recentTransactionsStats.income.toNumber())}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm opacity-75">Expenses</div>
              <div className="text-lg font-semibold">
                {formatCurrency(recentTransactionsStats.expenses.toNumber())}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (widget.id === 'addTransaction') {
      return (
        <div 
          className="h-full bg-gradient-to-br from-primary to-secondary rounded-xl shadow-sm text-white p-6 flex flex-col justify-center items-center cursor-pointer hover:shadow-lg transition-all"
          onClick={handleClick}
        >
          <PlusIcon className="w-12 h-12 mb-3" />
          <h3 className="text-lg font-medium">Add Transaction</h3>
          <p className="text-sm opacity-90 text-center mt-2">
            Quickly add a new transaction
          </p>
        </div>
      );
    }

    if (widget.id === 'forecast' || widget.id === 'actual') {
      return (
        <div 
          className={`h-full p-4 ${widget.color === 'blue' ? 'bg-primary' : 'bg-red-500'} text-white rounded-xl cursor-pointer hover:shadow-lg transition-all`}
          onClick={handleClick}
        >
          <div className="text-xs uppercase font-medium mb-2">{widget.title}</div>
          <div className="text-2xl font-bold">{widget.value}</div>
        </div>
      );
    }

    // Default widget rendering
    return (
      <div 
        className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all p-6 cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {widget.title}
          </h3>
          {getWidgetIcon(widget.id)}
        </div>
        
        {widget.empty ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <ExclamationTriangleIcon className="w-8 h-8 mb-3" />
            <p className="text-sm text-center">{widget.emptyMessage}</p>
          </div>
        ) : (
          <>
            {widget.value && (
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {widget.value}
              </div>
            )}
            <p className="text-sm text-secondary dark:text-primary hover:underline">
              {widget.subtitle}
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <>
    <div className="w-full">
      {/* Dashboard Header - Consistent with other pages */}
      <div className="bg-secondary dark:bg-gray-700 rounded-2xl shadow-lg mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            </div>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-gray-700 hover:text-gray-900"
              style={{
                backgroundColor: isEditMode ? '#C5D3E8' : '#D9E1F2',
                ':hover': { backgroundColor: '#C5D3E8' }
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C5D3E8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isEditMode ? '#C5D3E8' : '#D9E1F2'}
            >
              {isEditMode ? (
                <>
                  <LockClosedIcon className="w-4 h-4" />
                  Save Layout
                </>
              ) : (
                <>
                  <PencilIcon className="w-4 h-4" />
                  Edit Layout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {isEditMode && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 mb-4 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Edit Mode:</strong> Drag widgets to rearrange them. Resize by dragging corners. Click "Save Layout" when done.
            </p>
          </div>
      )}

      {/* Welcome Info Box - Above cards but below header */}
      <div className="mb-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircleIcon className="w-4 h-4 text-secondary dark:text-primary flex-shrink-0" />
              <div>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  Welcome to your customizable financial dashboard
                </span>
                <span className="ml-10 text-xs text-gray-700 dark:text-gray-300">
                  Completely configurable, extremely flexible. You can start building your own financial dashboard from the ground up.
                </span>
              </div>
            </div>
            <button className="text-xs font-medium text-secondary dark:text-primary hover:underline flex-shrink-0 mr-6">
              Learn more →
            </button>
          </div>
        </div>
      </div>

      <div className="-mx-4 md:-mx-6 lg:-mx-8">
        <ResponsiveGridLayout
          className="layout px-4 md:px-6 lg:px-8"
          layouts={Object.keys(layouts).length > 0 ? layouts : defaultLayouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          compactType="vertical"
          preventCollision={false}
        >
        {/* Widgets */}
        {widgets.map((widget) => (
          <div key={widget.id} className={isEditMode ? 'drag-handle' : ''}>
            {renderWidget(widget)}
          </div>
        ))}

        </ResponsiveGridLayout>
      </div>


      <style>{`
        .drag-handle {
          cursor: move;
        }
        .drag-handle:hover {
          outline: 2px dashed #5a729a;
          outline-offset: 2px;
        }
        .react-grid-item.react-grid-placeholder {
          background: #5a729a !important;
          opacity: 0.2;
        }
        .react-resizable-handle {
          display: none !important;
        }
        .react-resizable-handle-sw,
        .react-resizable-handle-se,
        .react-resizable-handle-nw,
        .react-resizable-handle-ne,
        .react-resizable-handle-w,
        .react-resizable-handle-e,
        .react-resizable-handle-n,
        .react-resizable-handle-s {
          display: none !important;
        }
      `}</style>
    </div>
    </>
  );
}