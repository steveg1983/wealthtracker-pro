/**
 * @component TaxInputForm
 * @description Input form for tax calculation with regional settings support
 * @performance Memoized to prevent unnecessary re-renders
 */

import React, { memo } from 'react';
import { useRegionalSettings, useRegionalCurrency } from '../../hooks/useRegionalSettings';
import TaxYearSelector from '../financial/TaxYearSelector';
import { UKTaxYear } from '../../services/taxDataService';

type PayFrequency = 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly';
type FilingStatus = 'single' | 'married' | 'separate' | 'head';

interface TaxInputFormProps {
  grossIncome: string;
  setGrossIncome: (value: string) => void;
  payFrequency: PayFrequency | null;
  setPayFrequency: (freq: PayFrequency) => void;
  overPensionAge: boolean | null;
  setOverPensionAge: (age: boolean | null) => void;
  selectedTaxYear: UKTaxYear;
  setSelectedTaxYear: (year: UKTaxYear) => void;
  filingStatus: FilingStatus;
  setFilingStatus: (status: FilingStatus) => void;
  onCalculate: () => void;
  canCalculate: boolean;
}

export const TaxInputForm = memo(function TaxInputForm({
  grossIncome,
  setGrossIncome,
  payFrequency,
  setPayFrequency,
  overPensionAge,
  setOverPensionAge,
  selectedTaxYear,
  setSelectedTaxYear,
  filingStatus,
  setFilingStatus,
  onCalculate,
  canCalculate
}: TaxInputFormProps) {
  const { region } = useRegionalSettings();
  const { currencySymbol } = useRegionalCurrency();

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
            onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
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
        onClick={onCalculate}
        disabled={!canCalculate}
        className="w-full px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        Calculate take-home pay
      </button>
    </div>
  );
});