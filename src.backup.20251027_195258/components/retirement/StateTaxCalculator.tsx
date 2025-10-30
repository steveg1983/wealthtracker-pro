import React, { useState, useMemo } from 'react';
import { parseCurrencyDecimal } from '../../utils/currency-decimal';
import { stateTaxService, type RetirementIncome, type StateTaxCalculation } from '../../services/stateTaxService';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';
import { formatPercentageValue, toDecimal } from '@wealthtracker/utils';

export default function StateTaxCalculator() {
  const { formatCurrency } = useCurrencyDecimal();
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [compareStates, setCompareStates] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('single');
  const [age, setAge] = useState(65);
  
  const [income, setIncome] = useState<RetirementIncome>({
    wages: 0,
    socialSecurity: 30000,
    pension: 20000,
    ira401k: 40000,
    rothDistributions: 10000,
    capitalGains: 5000,
    other: 0
  });

  const states = useMemo(() => stateTaxService.getAllStates(), []);
  
  const calculation = useMemo<StateTaxCalculation | null>(() => {
    try {
      return stateTaxService.calculateStateTax(selectedState, income, filingStatus, age);
    } catch (error) {
      console.error('Error calculating state tax:', error);
      return null;
    }
  }, [selectedState, income, filingStatus, age]);

  const comparisonResults = useMemo<StateTaxCalculation[]>(() => {
    if (!showComparison || compareStates.length === 0) return [];
    
    const allStates = [selectedState, ...compareStates.filter(s => s !== selectedState)];
    return stateTaxService.compareStates(allStates, income, filingStatus, age);
  }, [selectedState, compareStates, income, filingStatus, age, showComparison]);

  const bestStates = useMemo(() => {
    return stateTaxService.findBestStatesForRetirement(income, filingStatus, age, 5);
  }, [income, filingStatus, age]);

  const handleIncomeChange = (field: keyof RetirementIncome, value: string) => {
    const numValue = parseCurrencyDecimal(value || '0').toNumber();
    setIncome(prev => ({ ...prev, [field]: numValue }));
  };

  const toggleCompareState = (stateCode: string) => {
    setCompareStates(prev => {
      if (prev.includes(stateCode)) {
        return prev.filter(s => s !== stateCode);
      }
      return [...prev, stateCode];
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          State Tax Calculator for Retirement Income
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calculate your state tax liability based on retirement income sources
        </p>
      </div>

      {/* Filing Status and Age */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filing Status
          </label>
          <select
            value={filingStatus}
            onChange={(e) => setFilingStatus(e.target.value as 'single' | 'married')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="single">Single</option>
            <option value="married">Married Filing Jointly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Age
          </label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(parseInt(e.target.value) || 65)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="50"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <ProfessionalIcon name="location" size={14} className="inline mr-1" />
            State of Residence
          </label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {states.map(state => (
              <option key={state.code} value={state.code}>
                {state.name} {!state.hasTax && '(No Income Tax)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Income Sources */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white">Annual Retirement Income</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Social Security Benefits
            </label>
            <input
              type="number"
              value={income.socialSecurity || ''}
              onChange={(e) => handleIncomeChange('socialSecurity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Pension Income
            </label>
            <input
              type="number"
              value={income.pension || ''}
              onChange={(e) => handleIncomeChange('pension', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              IRA/401(k) Distributions
            </label>
            <input
              type="number"
              value={income.ira401k || ''}
              onChange={(e) => handleIncomeChange('ira401k', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Roth IRA Distributions
            </label>
            <input
              type="number"
              value={income.rothDistributions || ''}
              onChange={(e) => handleIncomeChange('rothDistributions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Capital Gains
            </label>
            <input
              type="number"
              value={income.capitalGains || ''}
              onChange={(e) => handleIncomeChange('capitalGains', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Part-time Wages / Other
            </label>
            <input
              type="number"
              value={income.wages || ''}
              onChange={(e) => handleIncomeChange('wages', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Tax Calculation Results */}
      {calculation && (
        <>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(calculation.totalIncome)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Taxable Income</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(calculation.taxableIncome)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">State Tax</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(calculation.stateTax)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Effective Rate</p>
                <p className="text-lg font-semibold text-gray-600 dark:text-gray-500">
                  {formatPercentageValue(calculation.effectiveRate ?? 0, 2)}
                </p>
              </div>
            </div>

            {/* Show/Hide Breakdown */}
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
            >
              <ProfessionalIcon name="calculator" size={14} />
              {showBreakdown ? 'Hide' : 'Show'} Tax Breakdown
              {showBreakdown ? (
                <ProfessionalIcon name="chevronUp" size={14} />
              ) : (
                <ProfessionalIcon name="chevronDown" size={14} />
              )}
            </button>

            {showBreakdown && calculation.breakdown.length > 0 && (
              <div className="mt-4 space-y-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2 text-gray-700 dark:text-gray-300">Income Type</th>
                      <th className="text-right py-2 text-gray-700 dark:text-gray-300">Deductions</th>
                      <th className="text-right py-2 text-gray-700 dark:text-gray-300">Taxable</th>
                      <th className="text-right py-2 text-gray-700 dark:text-gray-300">Tax</th>
                      <th className="text-right py-2 text-gray-700 dark:text-gray-300">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculation.breakdown.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2 text-gray-900 dark:text-white">{item.income}</td>
                        <td className="text-right py-2 text-gray-600 dark:text-gray-400">{item.deductions}</td>
                        <td className="text-right py-2 text-gray-900 dark:text-white">{item.taxableAmount}</td>
                        <td className="text-right py-2 text-red-600 dark:text-red-400">{item.tax}</td>
                        <td className="text-right py-2 text-gray-600 dark:text-gray-500">{item.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Best States for Retirement */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ProfessionalIcon name="trendingDown" size={16} className="text-green-600" />
              Most Tax-Friendly States for Your Income
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {bestStates.map((state, idx) => (
                <div
                  key={state.state}
                  className={`p-3 rounded-lg border ${
                    state.state === selectedState
                      ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      #{idx + 1} {state.state}
                    </span>
                    {state.stateTax === 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400">No Tax</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{state.stateName}</p>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(state.stateTax)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {formatPercentageValue(state.effectiveRate ?? 0, 2)} effective
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* State Comparison */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Compare States</h4>
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
              >
                {showComparison ? 'Hide' : 'Show'} Comparison
              </button>
            </div>

            {showComparison && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {states
                    .filter(s => s.code !== selectedState)
                    .slice(0, 10)
                    .map(state => (
                      <button
                        key={state.code}
                        onClick={() => toggleCompareState(state.code)}
                        className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                          compareStates.includes(state.code)
                            ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20 text-blue-700 dark:text-gray-300'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {state.code}
                      </button>
                    ))}
                </div>

                {comparisonResults.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600">
                          <th className="text-left py-2">State</th>
                          <th className="text-right py-2">State Tax</th>
                          <th className="text-right py-2">Effective Rate</th>
                          <th className="text-right py-2">After-Tax Income</th>
                          <th className="text-right py-2">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResults.map((result) => {
                          const currentStateTaxDecimal = toDecimal(calculation.stateTax);
                          const stateTaxDecimal = toDecimal(result.stateTax);
                          const differenceDecimal = stateTaxDecimal.minus(currentStateTaxDecimal);
                          const afterTaxDecimal = toDecimal(result.totalIncome).minus(stateTaxDecimal);
                          
                          const differenceLabel = formatCurrency(differenceDecimal.abs());
                          const differenceIsPositive = differenceDecimal.greaterThan(0);

                          return (
                            <tr
                              key={result.state}
                              className={`border-b border-gray-100 dark:border-gray-700 ${
                                result.state === selectedState ? 'bg-blue-50 dark:bg-gray-900/20' : ''
                              }`}
                            >
                              <td className="py-2 font-medium">
                                {result.state} - {result.stateName}
                              </td>
                              <td className="text-right py-2 text-red-600 dark:text-red-400">
                                {formatCurrency(stateTaxDecimal)}
                              </td>
                              <td className="text-right py-2">
                                {formatPercentageValue(result.effectiveRate ?? 0, 2)}
                              </td>
                              <td className="text-right py-2 text-green-600 dark:text-green-400">
                                {formatCurrency(afterTaxDecimal)}
                              </td>
                              <td className="text-right py-2">
                                {!differenceDecimal.isZero() && (
                                  <span className={differenceIsPositive ? 'text-red-600' : 'text-green-600'}>
                                    {differenceIsPositive ? '+' : ''}{differenceLabel}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="mt-6 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
            <div className="flex gap-2">
              <ProfessionalIcon name="info" size={16} className="text-gray-600 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">Important Notes:</p>
                <ul className="space-y-0.5 text-xs">
                  <li>• This calculator provides estimates based on 2025 tax rates</li>
                  <li>• Actual taxes may vary based on deductions, credits, and local taxes</li>
                  <li>• Consider cost of living and quality of life factors beyond taxes</li>
                  <li>• Consult a tax professional for personalized advice</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
