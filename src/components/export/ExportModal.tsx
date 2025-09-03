import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { 
  XMarkIcon,
  DocumentArrowDownIcon,
  CalendarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { exportService } from '../../services/exportService';
import type { Account, Transaction, Budget, Goal } from '../../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
}

export default function ExportModal({
  isOpen,
  onClose,
  accounts,
  transactions,
  budgets,
  goals
}: ExportModalProps): React.JSX.Element {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf' | 'xlsx' | 'json' | 'qif' | 'ofx'>('csv');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [includeOptions, setIncludeOptions] = useState({
    transactions: true,
    accounts: true,
    budgets: false,
    goals: false,
    charts: false
  });
  
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'account' | 'month'>('none');
  const [isExporting, setIsExporting] = useState(false);
  
  const formatOptions = [
    { value: 'csv', label: 'CSV', icon: TableCellsIcon, description: 'For Excel and spreadsheets' },
    { value: 'pdf', label: 'PDF', icon: DocumentTextIcon, description: 'Professional reports' },
    { value: 'xlsx', label: 'Excel', icon: DocumentChartBarIcon, description: 'Native Excel format' },
    { value: 'json', label: 'JSON', icon: DocumentTextIcon, description: 'For backups and APIs' },
    { value: 'qif', label: 'QIF', icon: DocumentArrowDownIcon, description: 'For Quicken' },
    { value: 'ofx', label: 'OFX', icon: DocumentArrowDownIcon, description: 'For accounting software' }
  ];
  
  const handleDateRangeChange = (range: typeof dateRange) => {
    setDateRange(range);
    const now = new Date();
    
    switch (range) {
      case 'month':
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        setStartDate(quarterStart.toISOString().split('T')[0]);
        setEndDate(new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0).toISOString().split('T')[0]);
        break;
      case 'year':
        setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
        setEndDate(new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]);
        break;
      case 'all':
        setStartDate('2020-01-01');
        setEndDate(now.toISOString().split('T')[0]);
        break;
    }
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Filter data based on date range
      const filteredTransactions = dateRange === 'all' 
        ? transactions 
        : transactions.filter(t => {
            const date = new Date(t.date);
            return date >= new Date(startDate) && date <= new Date(endDate);
          });
      
      // Prepare export options
      const exportOptions = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        format: selectedFormat,
        includeCharts: includeOptions.charts && (selectedFormat === 'pdf' || selectedFormat === 'xlsx'),
        includeTransactions: includeOptions.transactions,
        includeAccounts: includeOptions.accounts,
        includeInvestments: false, // Could be added later
        includeBudgets: includeOptions.budgets,
        groupBy: groupBy === 'none' ? undefined : groupBy,
        customTitle: `Financial Report - ${new Date().toLocaleDateString()}`
      };
      
      // Prepare data for export
      const exportData = {
        transactions: includeOptions.transactions ? filteredTransactions : [],
        accounts: includeOptions.accounts ? accounts : [],
        budgets: includeOptions.budgets ? budgets : [],
        goals: includeOptions.goals ? goals : [],
        metadata: {
          exportDate: new Date(),
          dateRange: { start: startDate, end: endDate },
          recordCount: {
            transactions: filteredTransactions.length,
            accounts: accounts.length,
            budgets: budgets.length,
            goals: goals.length
          }
        }
      };
      
      // Call export service
      await exportService.exportData(exportData, exportOptions);
      
      // Show success message
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      // Could show error toast here
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    Export Financial Data
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Export Options */}
                <div className="space-y-6">
                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Export Format
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {formatOptions.map(format => {
                        const Icon = format.icon;
                        return (
                          <button
                            key={format.value}
                            onClick={() => setSelectedFormat(format.value as any)}
                            className={`relative p-3 rounded-lg border-2 transition-all ${
                              selectedFormat === format.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {selectedFormat === format.value && (
                              <CheckIcon className="absolute top-2 right-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                            <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-1" />
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {format.label}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {format.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date Range
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(['all', 'month', 'quarter', 'year', 'custom'] as const).map(range => (
                        <button
                          key={range}
                          onClick={() => handleDateRangeChange(range)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            dateRange === range
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {range === 'all' ? 'All Time' :
                           range === 'month' ? 'This Month' :
                           range === 'quarter' ? 'This Quarter' :
                           range === 'year' ? 'This Year' : 'Custom'}
                        </button>
                      ))}
                    </div>
                    
                    {dateRange === 'custom' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Include Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Include in Export
                    </label>
                    <div className="space-y-2">
                      {Object.entries({
                        transactions: 'Transactions',
                        accounts: 'Account Balances',
                        budgets: 'Budget Information',
                        goals: 'Financial Goals',
                        charts: 'Charts & Graphs (PDF/Excel only)'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={includeOptions[key as keyof typeof includeOptions]}
                            onChange={(e) => setIncludeOptions({
                              ...includeOptions,
                              [key]: e.target.checked
                            })}
                            disabled={key === 'charts' && !['pdf', 'xlsx'].includes(selectedFormat)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className={`ml-2 text-sm ${
                            key === 'charts' && !['pdf', 'xlsx'].includes(selectedFormat)
                              ? 'text-gray-400 dark:text-gray-600'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Group By Option */}
                  {includeOptions.transactions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Group Transactions By
                      </label>
                      <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="none">No Grouping</option>
                        <option value="category">Category</option>
                        <option value="account">Account</option>
                        <option value="month">Month</option>
                      </select>
                    </div>
                  )}
                  
                  {/* Summary */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Export Summary
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>• Format: {formatOptions.find(f => f.value === selectedFormat)?.label}</li>
                      <li>• Date Range: {startDate} to {endDate}</li>
                      <li>• Records to export: {
                        includeOptions.transactions ? `${transactions.filter(t => {
                          const date = new Date(t.date);
                          return date >= new Date(startDate) && date <= new Date(endDate);
                        }).length} transactions` : '0 transactions'
                      }</li>
                    </ul>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleExport}
                    disabled={isExporting || (!includeOptions.transactions && !includeOptions.accounts && !includeOptions.budgets && !includeOptions.goals)}
                  >
                    {isExporting ? (
                      <>
                        <DocumentArrowDownIcon className="h-4 w-4 mr-2 animate-pulse" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                        Export
                      </>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}