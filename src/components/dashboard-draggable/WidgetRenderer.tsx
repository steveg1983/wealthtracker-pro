import React, { useEffect, memo } from 'react';
import { 
  PlusIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  BanknotesIcon,
  ChartPieIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import type { DashboardWidget, TransactionStats } from '../../services/dashboardDraggableService';
import { useLogger } from '../services/ServiceProvider';

interface WidgetRendererProps {
  widget: DashboardWidget;
  isEditMode: boolean;
  recentTransactionsStats?: TransactionStats;
  formatCurrency: (value: number) => string;
}

const WidgetRenderer = memo(function WidgetRenderer({ widget,
  isEditMode,
  recentTransactionsStats,
  formatCurrency
 }: WidgetRendererProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('WidgetRenderer component initialized', {
      componentName: 'WidgetRenderer'
    });
  }, []);

  const handleClick = () => {
    if (!isEditMode && widget.action) {
      widget.action();
    }
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'CreditCardIcon': return <CreditCardIcon className="w-5 h-5 text-gray-400" />;
      case 'BanknotesIcon': return <BanknotesIcon className="w-5 h-5 text-gray-400" />;
      case 'ChartPieIcon': return <ChartPieIcon className="w-5 h-5 text-gray-400" />;
      case 'ChartBarIcon': return <ChartBarIcon className="w-5 h-5 text-gray-400" />;
      case 'CurrencyDollarIcon': return <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />;
      case 'BellIcon': return <BellIcon className="w-5 h-5 text-gray-400" />;
      default: return null;
    }
  };

  // Special rendering for balance widget
  if (widget.id === 'balance' && recentTransactionsStats) {
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

  // Special rendering for add transaction widget
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

  // Special rendering for forecast/actual widgets
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
        {getIcon(widget.icon)}
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
});

export default WidgetRenderer;