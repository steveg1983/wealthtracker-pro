import React, { useState, useEffect } from 'react';
import { ukRetirementService } from '../../services/ukRetirementService';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { InfoIcon, CheckCircleIcon, AlertCircleIcon } from '../icons';

export default function StatePensionCalculator(): React.JSX.Element {
  const { formatCurrency } = useRegionalCurrency();
  
  const [birthYear, setBirthYear] = useState<number>(1970);
  const [qualifyingYears, setQualifyingYears] = useState<number>(20);
  const [deferYears, setDeferYears] = useState<number>(0);
  const [calculation, setCalculation] = useState<any>(null);
  
  useEffect(() => {
    calculatePension();
  }, [birthYear, qualifyingYears, deferYears]);
  
  const calculatePension = () => {
    const result = ukRetirementService.calculateStatePension(
      qualifyingYears,
      birthYear,
      deferYears
    );
    setCalculation(result);
  };
  
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const yearsToStatePension = Math.max(0, (calculation?.pensionAge || 67) - currentAge);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">UK State Pension Calculator</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calculate your State Pension based on National Insurance contributions
        </p>
      </div>
      
      <div className="space-y-4">
        {/* Birth Year Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Birth Year
          </label>
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(parseInt(e.target.value))}
            min="1940"
            max="2010"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your State Pension age: {calculation?.pensionAge || 67} years
          </p>
        </div>
        
        {/* Qualifying Years */}
        <div>
          <label className="block text-sm font-medium mb-2">
            National Insurance Qualifying Years
          </label>
          <input
            type="number"
            value={qualifyingYears}
            onChange={(e) => setQualifyingYears(parseInt(e.target.value))}
            min="0"
            max="50"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <div className="mt-2 flex items-start gap-2">
            <InfoIcon size={14} className="text-blue-500 mt-0.5" />
            <p className="text-xs text-gray-500">
              You need 35 years for the full State Pension (£230.25/week).
              Minimum 10 years to qualify for any State Pension.
            </p>
          </div>
        </div>
        
        {/* Deferral Option */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Years to Defer (Optional)
          </label>
          <input
            type="number"
            value={deferYears}
            onChange={(e) => setDeferYears(Math.max(0, parseInt(e.target.value) || 0))}
            min="0"
            max="10"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          {deferYears > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Increases by 1% for every 5 weeks deferred (10.4% per year)
            </p>
          )}
        </div>
      </div>
      
      {/* Results */}
      {calculation && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold mb-4">Your State Pension Estimate</h4>
          
          {/* Eligibility Status */}
          {qualifyingYears < 10 ? (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
              <AlertCircleIcon size={18} className="text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Not Eligible Yet
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  You need at least 10 qualifying years. You have {10 - qualifyingYears} years to go.
                </p>
              </div>
            </div>
          ) : calculation.isFullPension ? (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-start gap-2">
              <CheckCircleIcon size={18} className="text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Eligible for Full State Pension
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  You have the required 35 qualifying years
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
              <InfoIcon size={18} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Partial State Pension
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {calculation.yearsToFullPension} more years needed for full pension
                </p>
              </div>
            </div>
          )}
          
          {/* Pension Amounts */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Weekly Amount</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(calculation.weeklyAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Annual Amount</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(calculation.annualAmount)}
                </p>
              </div>
            </div>
            
            {/* Deferral Benefits */}
            {calculation.deferralOptions && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  With {deferYears} Year{deferYears > 1 ? 's' : ''} Deferral:
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700 dark:text-blue-300">Weekly</p>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {formatCurrency(calculation.deferralOptions.increasedWeekly)}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700 dark:text-blue-300">Annual</p>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {formatCurrency(calculation.deferralOptions.increasedAnnual)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Additional Info */}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              <p>• State Pension age: {calculation.pensionAge} years</p>
              <p>• Years until State Pension: {yearsToStatePension}</p>
              <p>• Based on 2025-26 rates (£230.25/week full pension)</p>
              <p>• Subject to triple lock increases</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}