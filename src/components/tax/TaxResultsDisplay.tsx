/**
 * @component TaxResultsDisplay
 * @description Displays detailed tax calculation results with breakdown
 * @performance Optimized with memoization and error handling
 */

import React, { memo } from 'react';
import { useRegionalSettings, useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { UKTaxYear } from '../../services/taxDataService';

interface TaxResults {
  incomeTax: number;
  nationalInsurance?: number;
  total: number;
  effectiveRate: number;
  annualIncome: number;
  monthlyIncome: number;
  weeklyIncome: number;
  takeHomeAnnual: number;
  takeHomeMonthly: number;
  takeHomeWeekly: number;
  [key: string]: number | undefined;
}

type FilingStatus = 'single' | 'married' | 'separate' | 'head';

interface TaxResultsDisplayProps {
  results: TaxResults;
  selectedTaxYear: UKTaxYear;
  filingStatus: FilingStatus;
}

export const TaxResultsDisplay = memo(function TaxResultsDisplay({
  results,
  selectedTaxYear,
  filingStatus
}: TaxResultsDisplayProps) {
  const { region } = useRegionalSettings();
  const { formatCurrency } = useRegionalCurrency();

  const getStandardDeduction = (): number => {
    switch (filingStatus) {
      case 'married': return 29200;
      case 'head': return 21900;
      default: return 14600;
    }
  };

  const getPersonalAllowance = (): number => {
    return Math.max(0, 12570 - Math.max(0, (results.annualIncome - 100000) / 2));
  };

  const getTaxableIncomeUK = (): number => {
    return Math.max(0, results.annualIncome - getPersonalAllowance());
  };

  const getTaxableIncomeUS = (): number => {
    return Math.max(0, results.annualIncome - getStandardDeduction());
  };

  const formatAmount = (amount: number | undefined, errorContext: string): string => {
    try {
      return formatCurrency(amount ?? 0);
    } catch (error) {
      return 'Error';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">
        Your estimated take-home pay {region === 'UK' && `for ${selectedTaxYear}`}
      </h3>
      
      {/* Take-home display tabs */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <button className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg">
            Yearly
          </button>
          <button className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Monthly
          </button>
          <button className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Weekly
          </button>
        </div>
        
        <div className="bg-gradient-to-r from-slate-400 to-blue-400 text-white p-8 rounded-lg text-center">
          <div className="text-4xl font-bold mb-2">
            {formatAmount(results.takeHomeAnnual, 'main take-home display')}
          </div>
          <div className="text-lg opacity-90">a year</div>
        </div>
      </div>
      
      {/* Breakdown */}
      <div className="space-y-3">
        <h4 className="font-medium mb-2">How we calculated this</h4>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="py-2">Gross income</div>
          <div className="py-2 text-right font-medium">
            {formatAmount(results.annualIncome, 'Gross Income')}
          </div>
          
          {region === 'UK' && (
            <>
              <div className="py-2">Personal Allowance</div>
              <div className="py-2 text-right font-medium">
                {formatAmount(getPersonalAllowance(), 'Personal Allowance')}
              </div>
              
              <div className="py-2">Taxable Income</div>
              <div className="py-2 text-right font-medium">
                {formatAmount(getTaxableIncomeUK(), 'Taxable Income')}
              </div>
            </>
          )}
          
          {region === 'US' && (
            <>
              <div className="py-2">Standard Deduction</div>
              <div className="py-2 text-right font-medium">
                {formatAmount(getStandardDeduction(), 'Standard Deduction')}
              </div>
              
              <div className="py-2">Taxable Income</div>
              <div className="py-2 text-right font-medium">
                {formatAmount(getTaxableIncomeUS(), 'US Taxable Income')}
              </div>
            </>
          )}
          
          <div className="py-2 border-t">Income Tax</div>
          <div className="py-2 text-right font-medium border-t">
            {formatAmount(results.incomeTax, 'Income Tax')}
          </div>
          
          {region === 'UK' && (
            <>
              <div className="py-2">National Insurance</div>
              <div className="py-2 text-right font-medium">
                {formatAmount(results.nationalInsurance, 'National Insurance')}
              </div>
            </>
          )}
          
          <div className="py-2 border-t font-semibold">Take-home pay</div>
          <div className="py-2 text-right font-bold border-t text-slate-600 dark:text-slate-400">
            {formatAmount(results.takeHomeAnnual, 'Take-home pay')}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This calculation does not account for any other deductions your employer might make 
            before they pay you, such as pension contributions or student loan repayments.
          </p>
        </div>
      </div>
    </div>
  );
});