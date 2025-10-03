import React, { useState, useEffect } from 'react';
import { businessService } from '../../services/businessService';
import { 
  BriefcaseIcon,
  FileTextIcon,
  DollarSignIcon,
  MapPinIcon,
  TrendingUpIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from '../icons';
import { useNavigate } from 'react-router-dom';
import type { BusinessMetrics } from '../../services/businessService';
import type { BaseWidgetProps } from '../../types/widget-types';
import { logger } from '../../services/loggingService';

interface BusinessWidgetProps extends BaseWidgetProps {}

export default function BusinessWidget({ size = 'medium' }: BusinessWidgetProps) {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const businessMetrics = businessService.getBusinessMetrics();
      setMetrics(businessMetrics);
    } catch (error) {
      logger.error('Error loading business metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">No data available</div>
      </div>
    );
  }

  if (size === 'small') {
    return (
      <div className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3">
        <div className="flex items-center justify-between mb-2">
          <BriefcaseIcon size={20} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Business</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(metrics.netProfit)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Net Profit</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BriefcaseIcon size={20} className="text-blue-600 dark:text-blue-400" />
          Business Overview
        </h3>
        <div className="flex items-center gap-1">
          {metrics.overdueInvoices > 0 ? (
            <AlertCircleIcon size={16} className="text-red-500" />
          ) : (
            <CheckCircleIcon size={16} className="text-green-500" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {metrics.overdueInvoices > 0 ? `${metrics.overdueInvoices} Overdue` : 'Up to date'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-800 dark:text-green-200">Revenue</span>
            </div>
            <div className="text-sm font-bold text-green-900 dark:text-green-100">
              {formatCurrency(metrics.totalRevenue)}
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSignIcon size={16} className="text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-800 dark:text-red-200">Expenses</span>
            </div>
            <div className="text-sm font-bold text-red-900 dark:text-red-100">
              {formatCurrency(metrics.totalExpenses)}
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-900 dark:text-white">Net Profit</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {formatPercentage(metrics.profitMargin)} margin
            </span>
          </div>
          <div className={`text-lg font-bold ${
            metrics.netProfit >= 0 
              ? 'text-gray-900 dark:text-white' 
              : 'text-red-900 dark:text-red-100'
          }`}>
            {formatCurrency(metrics.netProfit)}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileTextIcon size={14} className="text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">Outstanding Invoices</span>
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {metrics.outstandingInvoices}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <MapPinIcon size={14} className="text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">Avg Payment Time</span>
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              {metrics.averagePaymentTime.toFixed(0)} days
            </span>
          </div>
        </div>

        {/* Top Expense Category */}
        {metrics.topExpenseCategories.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Top Expense</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatPercentage(metrics.topExpenseCategories[0].percentage)}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
              {metrics.topExpenseCategories[0].category.replace('_', ' ')}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {formatCurrency(metrics.topExpenseCategories[0].amount)}
            </div>
          </div>
        )}

        {/* Business Features Button */}
        <button
          onClick={() => navigate('/business-features')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Business Features
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}