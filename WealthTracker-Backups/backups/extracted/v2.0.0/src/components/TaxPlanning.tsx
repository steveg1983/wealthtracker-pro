import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { taxPlanningService, type TaxEstimate, type TaxDeduction, type TaxOptimization, type CapitalGain } from '../services/taxPlanningService';
import { 
  CalculatorIcon,
  FileTextIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  DownloadIcon,
  CalendarIcon,
  DollarSignIcon,
  PiggyBankIcon
} from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { format } from 'date-fns';
import { toDecimal } from '../utils/decimal';

type TabType = 'overview' | 'deductions' | 'capital-gains' | 'optimizations';

export default function TaxPlanning(): React.JSX.Element {
  const { transactions, accounts, investments } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [taxEstimate, setTaxEstimate] = useState<TaxEstimate | null>(null);
  const [deductions, setDeductions] = useState<TaxDeduction[]>([]);
  const [optimizations, setOptimizations] = useState<TaxOptimization[]>([]);
  const [capitalGains, setCapitalGains] = useState<CapitalGain[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    calculateTaxes();
  }, [transactions, accounts, investments, selectedYear]);

  const calculateTaxes = async () => {
    setIsCalculating(true);
    
    try {
      // Calculate all tax data
      const estimate = taxPlanningService.estimateTaxes(transactions, accounts, selectedYear);
      const deductibleExpenses = taxPlanningService.trackDeductibleExpenses(transactions, selectedYear);
      const suggestions = taxPlanningService.suggestOptimizations(transactions, accounts, investments || []);
      const gains = taxPlanningService.calculateCapitalGains(investments || []);
      
      setTaxEstimate(estimate);
      setDeductions(deductibleExpenses);
      setOptimizations(suggestions);
      setCapitalGains(gains);
    } finally {
      setIsCalculating(false);
    }
  };

  const generateReport = () => {
    const report = taxPlanningService.generateTaxReport(
      transactions,
      accounts,
      investments || [],
      selectedYear
    );
    
    // Convert to CSV or PDF (simplified for demo)
    const csv = `Tax Report ${selectedYear}\n\n` +
      `Income: ${formatCurrency(report.summary.income)}\n` +
      `Deductions: ${formatCurrency(report.summary.deductions)}\n` +
      `Taxable Income: ${formatCurrency(report.summary.taxableIncome)}\n` +
      `Estimated Tax: ${formatCurrency(report.summary.estimatedTax)}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedYear}.csv`;
    a.click();
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: CalculatorIcon },
    { id: 'deductions' as TabType, label: 'Deductions', icon: FileTextIcon },
    { id: 'capital-gains' as TabType, label: 'Capital Gains', icon: TrendingUpIcon },
    { id: 'optimizations' as TabType, label: 'Tax Strategies', icon: PiggyBankIcon }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Tax Planning Center</h2>
            <p className="text-green-100">
              Track deductions, estimate taxes, and optimize your tax strategy
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:bg-white/30 focus:outline-none"
            >
              {years.map(year => (
                <option key={year} value={year} className="text-gray-900">
                  {year} Tax Year
                </option>
              ))}
            </select>
            <button
              onClick={generateReport}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors"
            >
              <DownloadIcon size={16} />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {taxEstimate && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Income</span>
              <DollarSignIcon size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(taxEstimate.income)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Deductions</span>
              <FileTextIcon size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(taxEstimate.deductions)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Tax</span>
              <CalculatorIcon size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(taxEstimate.estimatedTax)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Effective rate: {taxEstimate.effectiveRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tax Savings</span>
              <PiggyBankIcon size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(
                optimizations.reduce((sum, opt) => sum.plus(opt.potentialSavings), toDecimal(0))
              )}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Potential savings
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-primary shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        {isCalculating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Calculating taxes...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && taxEstimate && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Income Breakdown */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      Tax Calculation Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Gross Income</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(taxEstimate.income)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Deductions</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          -{formatCurrency(taxEstimate.deductions)}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Taxable Income</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(taxEstimate.taxableIncome)}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            Estimated Federal Tax
                          </span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(taxEstimate.estimatedTax)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tax Rates */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      Tax Rates
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Effective Tax Rate</span>
                          <span className="font-bold text-2xl text-gray-900 dark:text-white">
                            {taxEstimate.effectiveRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-green-600 h-3 rounded-full"
                            style={{ width: `${Math.min(taxEstimate.effectiveRate, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Marginal Tax Rate</span>
                          <span className="font-bold text-2xl text-gray-900 dark:text-white">
                            {taxEstimate.marginalRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full"
                            style={{ width: `${(taxEstimate.marginalRate / 37) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quarterly Payments */}
                {taxEstimate.quarterlyPayments && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      Estimated Quarterly Payments
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {taxEstimate.quarterlyPayments.map((payment, index) => (
                        <div key={index} className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Q{index + 1} {selectedYear}
                          </p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatCurrency(payment)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Deductions Tab */}
            {activeTab === 'deductions' && (
              <div className="space-y-4">
                {deductions.length > 0 ? (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Tip:</strong> Keep receipts and documentation for all deductible expenses. 
                        The IRS may request proof during an audit.
                      </p>
                    </div>
                    {deductions.map(deduction => (
                      <div
                        key={deduction.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                              {deduction.description}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {deduction.transactionIds.length} transactions
                            </p>
                            {deduction.documentation && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {deduction.documentation}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(deduction.amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileTextIcon size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No deductible expenses found for {selectedYear}.</p>
                    <p className="text-sm mt-2">
                      Start categorizing your expenses to track deductions.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Capital Gains Tab */}
            {activeTab === 'capital-gains' && (
              <div className="space-y-4">
                {capitalGains.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Gains</p>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(
                            capitalGains
                              .filter(g => g.gain.greaterThan(0))
                              .reduce((sum, g) => sum.plus(g.gain), toDecimal(0))
                          )}
                        </p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Losses</p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(
                            capitalGains
                              .filter(g => g.gain.lessThan(0))
                              .reduce((sum, g) => sum.plus(g.gain.abs()), toDecimal(0))
                          )}
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Est. Tax Impact</p>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(
                            capitalGains.reduce((sum, g) => sum.plus(g.estimatedTax), toDecimal(0))
                          )}
                        </p>
                      </div>
                    </div>
                    {capitalGains.map(gain => (
                      <div
                        key={gain.investmentId}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                              {gain.investmentName}
                            </h4>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Cost Basis: </span>
                                <span className="font-medium">{formatCurrency(gain.costBasis)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Current Value: </span>
                                <span className="font-medium">{formatCurrency(gain.currentValue)}</span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                gain.type === 'long-term' 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                              }`}>
                                {gain.type} • {gain.taxRate}% rate
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${
                              gain.gain.greaterThan(0) 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {gain.gain.greaterThan(0) ? '+' : ''}{formatCurrency(gain.gain)}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Tax: {formatCurrency(gain.estimatedTax)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <TrendingUpIcon size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No investments found to calculate capital gains.</p>
                  </div>
                )}
              </div>
            )}

            {/* Optimizations Tab */}
            {activeTab === 'optimizations' && (
              <div className="space-y-4">
                {optimizations.length > 0 ? (
                  optimizations.map(optimization => (
                    <div
                      key={optimization.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${
                          optimization.category === 'retirement' ? 'bg-purple-100 dark:bg-purple-900/30' :
                          optimization.category === 'investment' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          optimization.category === 'charitable' ? 'bg-green-100 dark:bg-green-900/30' :
                          'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <PiggyBankIcon size={24} className={
                            optimization.category === 'retirement' ? 'text-purple-600 dark:text-purple-400' :
                            optimization.category === 'investment' ? 'text-blue-600 dark:text-blue-400' :
                            optimization.category === 'charitable' ? 'text-green-600 dark:text-green-400' :
                            'text-gray-600 dark:text-gray-400'
                          } />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {optimization.title}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                            {optimization.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              Save {formatCurrency(optimization.potentialSavings)}
                            </span>
                            {optimization.deadline && (
                              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <CalendarIcon size={14} />
                                By {format(optimization.deadline, 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                          <div className="mt-3">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                              {optimization.actionRequired}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckCircleIcon size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Your tax strategy is well optimized!</p>
                    <p className="text-sm mt-2">
                      We'll notify you when new optimization opportunities arise.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}