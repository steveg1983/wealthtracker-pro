import React, { useState, useEffect } from 'react';
import { useRegionalSettings, useRegionalCurrency } from '../hooks/useRegionalSettings';
import { taxDataService } from '../services/taxDataService';
import type { UKTaxYear } from '../services/taxDataService';
import TaxYearSelector from './financial/TaxYearSelector';

type PayFrequency = 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly';

export default function TaxCalculator(): React.JSX.Element {
  const { region } = useRegionalSettings();
  const { formatCurrency, currencySymbol } = useRegionalCurrency();
  
  // Form state
  const [grossIncome, setGrossIncome] = useState<string>('');
  const [payFrequency, setPayFrequency] = useState<PayFrequency | null>(null);
  const [overPensionAge, setOverPensionAge] = useState<boolean | null>(null);
  const [selectedTaxYear, setSelectedTaxYear] = useState<UKTaxYear>(taxDataService.getSelectedUKTaxYear());
  const [filingStatus, setFilingStatus] = useState<'single' | 'married' | 'separate' | 'head'>('single');
  
  // Results state
  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Convert income to annual amount based on frequency
  const getAnnualIncome = (): number => {
    const amount = parseFloat(grossIncome) || 0;
    if (!payFrequency) return 0;
    switch (payFrequency) {
      case 'yearly': return amount;
      case 'monthly': return amount * 12;
      case 'weekly': return amount * 52;
      case 'daily': return amount * 260; // 5 days/week * 52 weeks
      case 'hourly': return amount * 2080; // 40 hours/week * 52 weeks
      default: return amount;
    }
  };
  
  // Don't calculate automatically - wait for button click
  
  const calculateTax = () => {
    const annualIncome = getAnnualIncome();
    if (annualIncome <= 0) return;
    
    const baseOptions = {
      scottish: false // Could add Scottish tax option later
    };

    const options = {
      ...baseOptions,
      ...(region === 'US' && filingStatus ? { filingStatus } : {}),
      ...(region === 'UK' && selectedTaxYear ? { taxYear: selectedTaxYear } : {})
    };

    const rawResult = taxDataService.calculateTax(annualIncome, region, options);

    if (region === 'UK') {
      const ukResult = rawResult as {
        incomeTax: number;
        nationalInsurance: number;
        total: number;
        effectiveRate: number;
        marginalRate?: number;
      };

      const adjustedIncomeTax = ukResult.incomeTax;
      const adjustedNI = overPensionAge ? 0 : ukResult.nationalInsurance;
      const totalTax = overPensionAge ? adjustedIncomeTax : ukResult.total;
      const effectiveRate = totalTax > 0 ? totalTax / annualIncome : 0;

      setResults({
        incomeTax: adjustedIncomeTax,
        nationalInsurance: adjustedNI,
        total: totalTax,
        effectiveRate,
        marginalRate: ukResult.marginalRate,
        annualIncome,
        monthlyIncome: annualIncome / 12,
        weeklyIncome: annualIncome / 52,
        takeHomeAnnual: annualIncome - totalTax,
        takeHomeMonthly: (annualIncome - totalTax) / 12,
        takeHomeWeekly: (annualIncome - totalTax) / 52
      });
      setShowResults(true);
      return;
    }

    const usResult = rawResult as {
      federal: number;
      state: number;
      total: number;
      effectiveRate: number;
      marginalRate: number;
    };

    const totalTax = usResult.total;
    const incomeTax = usResult.federal + usResult.state;

    setResults({
      incomeTax,
      nationalInsurance: 0,
      federalTax: usResult.federal,
      stateTax: usResult.state,
      total: totalTax,
      effectiveRate: usResult.effectiveRate,
      marginalRate: usResult.marginalRate,
      annualIncome,
      monthlyIncome: annualIncome / 12,
      weeklyIncome: annualIncome / 52,
      takeHomeAnnual: annualIncome - totalTax,
      takeHomeMonthly: (annualIncome - totalTax) / 12,
      takeHomeWeekly: (annualIncome - totalTax) / 52
    });
    setShowResults(true);
  };
  
  const handleCalculate = () => {
    calculateTax();
  };
  
  const formatFrequency = (freq: PayFrequency): string => {
    switch (freq) {
      case 'yearly': return 'Yearly';
      case 'monthly': return 'Monthly';
      case 'weekly': return 'Weekly';
      case 'daily': return 'Daily';
      case 'hourly': return 'Hourly';
      default: return freq;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Calculate Your Take-Home Pay</h3>
        
        {/* Tax Year Selector for UK */}
        {region === 'UK' && (
          <div className="mb-6">
            <TaxYearSelector 
              value={selectedTaxYear}
              onChange={setSelectedTaxYear}
            />
          </div>
        )}
        
        {/* Gross Income Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            How much are you paid?
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            This is the amount you are paid before any deductions are made.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium">{currencySymbol}</span>
            <input
              type="number"
              value={grossIncome}
              onChange={(e) => setGrossIncome(e.target.value)}
              placeholder="0"
              className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
        </div>
        
        {/* Pay Frequency */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">
            How often are you paid this amount?
          </label>
          <div className="space-y-2">
            {(['yearly', 'monthly', 'weekly', 'daily', 'hourly'] as PayFrequency[]).map((freq) => (
              <label key={freq} className="flex items-center">
                <input
                  type="radio"
                  name="frequency"
                  value={freq}
                  checked={payFrequency === freq}
                  onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
                  className="mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0"
                />
                <span className="text-sm">{formatFrequency(freq)}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Filing Status for US */}
        {region === 'US' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">
              Filing Status
            </label>
            <select
              value={filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="single">Single</option>
              <option value="married">Married Filing Jointly</option>
              <option value="separate">Married Filing Separately</option>
              <option value="head">Head of Household</option>
            </select>
          </div>
        )}
        
        {/* State Pension Age for UK */}
        {region === 'UK' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">
              Are you over the State Pension age?
            </label>
            <div className="space-y-2">
              <label className="flex items-start">
                <input
                  type="radio"
                  name="pensionAge"
                  value="no"
                  checked={overPensionAge === false}
                  onChange={() => setOverPensionAge(false)}
                  className="mt-0.5 mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500"
                />
                <span className="text-sm">No</span>
              </label>
              <label className="flex items-start">
                <input
                  type="radio"
                  name="pensionAge"
                  value="yes"
                  checked={overPensionAge === true}
                  onChange={() => setOverPensionAge(true)}
                  className="mt-0.5 mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500"
                />
                <span className="text-sm">Yes</span>
              </label>
            </div>
            {overPensionAge && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                If you are over the State Pension age, you do not pay National Insurance.
              </p>
            )}
          </div>
        )}
        
        <button
          onClick={handleCalculate}
          disabled={!grossIncome || parseFloat(grossIncome) <= 0 || !payFrequency || (region === 'UK' && overPensionAge === null)}
          className="w-full px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Calculate take-home pay
        </button>
      </div>
      
      {/* Results Section */}
      {showResults && results && (
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
                {formatCurrency(results.takeHomeAnnual)}
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
                {formatCurrency(results.annualIncome)}
              </div>
              
              {region === 'UK' && (
                <>
                  <div className="py-2">Personal Allowance</div>
                  <div className="py-2 text-right font-medium">
                    {formatCurrency(Math.max(0, 12570 - Math.max(0, (results.annualIncome - 100000) / 2)))}
                  </div>
                  
                  <div className="py-2">Taxable Income</div>
                  <div className="py-2 text-right font-medium">
                    {formatCurrency(Math.max(0, results.annualIncome - Math.max(0, 12570 - Math.max(0, (results.annualIncome - 100000) / 2))))}
                  </div>
                </>
              )}
              
              {region === 'US' && (
                <>
                  <div className="py-2">Standard Deduction</div>
                  <div className="py-2 text-right font-medium">
                    {formatCurrency(filingStatus === 'married' ? 29200 : filingStatus === 'head' ? 21900 : 14600)}
                  </div>
                  
                  <div className="py-2">Taxable Income</div>
                  <div className="py-2 text-right font-medium">
                    {formatCurrency(Math.max(0, results.annualIncome - (filingStatus === 'married' ? 29200 : filingStatus === 'head' ? 21900 : 14600)))}
                  </div>
                </>
              )}
              
              <div className="py-2 border-t">Income Tax</div>
              <div className="py-2 text-right font-medium border-t">
                {formatCurrency(results.incomeTax)}
              </div>
              
              {region === 'UK' && (
                <>
                  <div className="py-2">National Insurance</div>
                  <div className="py-2 text-right font-medium">
                    {formatCurrency(results.nationalInsurance)}
                  </div>
                </>
              )}
              
              <div className="py-2 border-t font-semibold">Take-home pay</div>
              <div className="py-2 text-right font-bold border-t text-slate-600 dark:text-slate-400">
                {formatCurrency(results.takeHomeAnnual)}
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
      )}
    </div>
  );
}
