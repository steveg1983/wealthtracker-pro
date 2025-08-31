import React, { useState, useEffect } from 'react';
import { businessService } from '../services/businessService';
import { 
  DollarSignIcon,
  FileTextIcon,
  TrendingUpIcon,
  CalculatorIcon,
  BriefcaseIcon,
  MapPinIcon,
  CalendarIcon,
  PlusIcon,
  BarChart3Icon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import InvoiceManager from '../components/InvoiceManager';
import MileageTracker from '../components/MileageTracker';
import BusinessExpenseManager from '../components/BusinessExpenseManager';
import type { BusinessMetrics } from '../services/businessService';
import { logger } from '../services/loggingService';

export default function BusinessFeatures() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'mileage'>('overview');
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const businessMetrics = businessService.getBusinessMetrics();
      setMetrics(businessMetrics);
    } catch (error) {
      logger.error('Error loading business data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = () => {
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <PageWrapper title="Business Features">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading business data...</div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Business Features">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Business Features</h1>
              <p className="text-blue-100">
                Manage invoices, track expenses, and monitor business performance
              </p>
            </div>
            <BriefcaseIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3Icon size={16} />
                  Overview
                </div>
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'invoices'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileTextIcon size={16} />
                  Invoices
                </div>
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'expenses'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSignIcon size={16} />
                  Expenses
                </div>
              </button>
              <button
                onClick={() => setActiveTab('mileage')}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === 'mileage'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPinIcon size={16} />
                  Mileage
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(metrics.totalRevenue)}
                    </p>
                  </div>
                  <TrendingUpIcon size={24} className="text-green-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(metrics.totalExpenses)}
                    </p>
                  </div>
                  <DollarSignIcon size={24} className="text-red-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p>
                    <p className={`text-2xl font-bold ${
                      metrics.netProfit >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(metrics.netProfit)}
                    </p>
                  </div>
                  <CalculatorIcon size={24} className={
                    metrics.netProfit >= 0 ? 'text-green-500' : 'text-red-500'
                  } />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</p>
                    <p className={`text-2xl font-bold ${
                      metrics.profitMargin >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatPercentage(metrics.profitMargin)}
                    </p>
                  </div>
                  <BarChart3Icon size={24} className={
                    metrics.profitMargin >= 0 ? 'text-green-500' : 'text-red-500'
                  } />
                </div>
              </div>
            </div>

            {/* Invoice Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileTextIcon size={20} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Invoice Status</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Outstanding</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {metrics.outstandingInvoices}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Overdue</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {metrics.overdueInvoices}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Payment Time</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {metrics.averagePaymentTime.toFixed(0)} days
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSignIcon size={20} className="text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Top Expenses</h3>
                </div>
                <div className="space-y-3">
                  {metrics.topExpenseCategories.slice(0, 3).map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {category.category.replace('_', ' ')}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CalendarIcon size={20} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">This Month</h3>
                </div>
                <div className="space-y-3">
                  {metrics.monthlyTrends.slice(-1).map((trend, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Revenue</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(trend.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {formatCurrency(trend.expenses)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Profit</span>
                        <span className={`font-medium ${
                          trend.profit >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(trend.profit)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Monthly Trends Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Trends</h3>
              <div className="space-y-4">
                {metrics.monthlyTrends.slice(-6).map((trend, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-20">
                        {trend.month}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Revenue</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Profit</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600 dark:text-green-400">
                        {formatCurrency(trend.revenue)}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        {formatCurrency(trend.expenses)}
                      </span>
                      <span className={
                        trend.profit >= 0 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-red-600 dark:text-red-400'
                      }>
                        {formatCurrency(trend.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <InvoiceManager onDataChange={handleDataChange} />
        )}

        {activeTab === 'expenses' && (
          <BusinessExpenseManager onDataChange={handleDataChange} />
        )}

        {activeTab === 'mileage' && (
          <MileageTracker onDataChange={handleDataChange} />
        )}
      </div>
    </PageWrapper>
  );
}