import React, { useState, useEffect } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { 
  PiggyBankIcon,
  TrendingUpIcon,
  CalculatorIcon,
  InfoIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '../icons';

interface PensionContribution {
  employeeContribution: number;
  employerContribution: number;
  taxRelief: number;
  totalAnnualContribution: number;
  netCost: number;
  projectedPot: number;
  annualPension: number;
}

export default function WorkplacePensionCalculator() {
  const { formatCurrency } = useRegionalCurrency();
  
  const [formData, setFormData] = useState({
    annualSalary: 35000,
    currentAge: 30,
    retirementAge: 68, // UK State Pension age
    currentPot: 15000,
    employeePercent: 5, // Auto-enrollment minimum
    employerPercent: 3, // Auto-enrollment minimum
    expectedReturn: 5,
    taxRate: 20, // Basic rate
    salaryExchange: false,
    qualifyingEarnings: true // Use qualifying earnings band
  });

  const [results, setResults] = useState<PensionContribution | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UK 2024/25 qualifying earnings band
  const LOWER_EARNINGS_LIMIT = 6240;
  const UPPER_EARNINGS_LIMIT = 50270;
  const ANNUAL_ALLOWANCE = 60000; // 2024/25 pension annual allowance
  const LIFETIME_ALLOWANCE_ABOLISHED = true; // Abolished from April 2024

  useEffect(() => {
    calculatePension();
  }, [formData]);

  const calculatePension = () => {
    const { 
      annualSalary, 
      employeePercent, 
      employerPercent,
      currentPot,
      currentAge,
      retirementAge,
      expectedReturn,
      taxRate,
      salaryExchange,
      qualifyingEarnings
    } = formData;

    // Calculate pensionable earnings
    let pensionableEarnings = annualSalary;
    if (qualifyingEarnings) {
      // Only earnings between lower and upper limits count
      if (annualSalary > UPPER_EARNINGS_LIMIT) {
        pensionableEarnings = UPPER_EARNINGS_LIMIT - LOWER_EARNINGS_LIMIT;
      } else if (annualSalary > LOWER_EARNINGS_LIMIT) {
        pensionableEarnings = annualSalary - LOWER_EARNINGS_LIMIT;
      } else {
        pensionableEarnings = 0;
      }
    }

    // Calculate contributions
    const employeeContribution = (pensionableEarnings * employeePercent) / 100;
    const employerContribution = (pensionableEarnings * employerPercent) / 100;

    // Calculate tax relief
    let taxRelief = 0;
    let netCost = employeeContribution;

    if (salaryExchange) {
      // Salary sacrifice - save on NI as well (12% for basic rate)
      const niSaving = employeeContribution * 0.12;
      taxRelief = (employeeContribution * taxRate / 100) + niSaving;
      netCost = employeeContribution - taxRelief;
    } else {
      // Relief at source - basic rate relief added to pension
      taxRelief = employeeContribution * 0.25; // 20% relief = 25% uplift
      netCost = employeeContribution; // But you pay full amount from net pay
    }

    // Total annual contribution (including tax relief for non-salary sacrifice)
    const totalAnnualContribution = employeeContribution + employerContribution + 
      (salaryExchange ? 0 : taxRelief);

    // Check against annual allowance
    const effectiveContribution = Math.min(totalAnnualContribution, ANNUAL_ALLOWANCE);

    // Project future value
    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = effectiveContribution / 12;
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Future value with compound interest
    const projectedPot = currentPot * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

    // Estimate annual pension (using 4% withdrawal or annuity rate of ~5%)
    const annualPension = projectedPot * 0.05;

    setResults({
      employeeContribution,
      employerContribution,
      taxRelief,
      totalAnnualContribution: effectiveContribution,
      netCost,
      projectedPot,
      annualPension
    });
  };

  const isAutoEnrollmentEligible = () => {
    return formData.annualSalary >= 10000 && 
           formData.currentAge >= 22 && 
           formData.currentAge < formData.retirementAge;
  };

  const meetsMinimumContribution = () => {
    const totalContribution = formData.employeePercent + formData.employerPercent;
    return totalContribution >= 8 && formData.employerPercent >= 3;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <PiggyBankIcon size={20} />
          Workplace Pension Calculator
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Annual Salary
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.annualSalary}
                  onChange={(e) => setFormData({ ...formData, annualSalary: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
              {isAutoEnrollmentEligible() && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ Eligible for auto-enrollment
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Contribution (%)
              </label>
              <input
                type="number"
                value={formData.employeePercent}
                onChange={(e) => setFormData({ ...formData, employeePercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="100"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Employer Contribution (%)
              </label>
              <input
                type="number"
                value={formData.employerPercent}
                onChange={(e) => setFormData({ ...formData, employerPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="100"
                step="1"
              />
              {!meetsMinimumContribution() && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ Below auto-enrollment minimum (8% total, 3% employer)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Pension Pot
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.currentPot}
                  onChange={(e) => setFormData({ ...formData, currentPot: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.salaryExchange}
                  onChange={(e) => setFormData({ ...formData, salaryExchange: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Salary Sacrifice/Exchange (save on NI)
                </span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.qualifyingEarnings}
                  onChange={(e) => setFormData({ ...formData, qualifyingEarnings: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Use Qualifying Earnings Band
                </span>
              </label>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Age
                    </label>
                    <input
                      type="number"
                      value={formData.currentAge}
                      onChange={(e) => setFormData({ ...formData, currentAge: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="18"
                      max="75"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Retirement Age
                    </label>
                    <input
                      type="number"
                      value={formData.retirementAge}
                      onChange={(e) => setFormData({ ...formData, retirementAge: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="55"
                      max="75"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expected Return (%)
                    </label>
                    <input
                      type="number"
                      value={formData.expectedReturn}
                      onChange={(e) => setFormData({ ...formData, expectedReturn: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      max="12"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tax Rate (%)
                    </label>
                    <select
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={20}>Basic Rate (20%)</option>
                      <option value={40}>Higher Rate (40%)</option>
                      <option value={45}>Additional Rate (45%)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          {results && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                  Annual Contributions
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700 dark:text-gray-300">Your Contribution:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {formatCurrency(results.employeeContribution)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700 dark:text-gray-300">Employer Contribution:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      +{formatCurrency(results.employerContribution)}
                    </span>
                  </div>
                  {results.taxRelief > 0 && !formData.salaryExchange && (
                    <div className="flex justify-between">
                      <span className="text-sm text-blue-700 dark:text-gray-300">Tax Relief:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +{formatCurrency(results.taxRelief)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                    <span className="text-sm font-medium text-blue-700 dark:text-gray-300">Total:</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(results.totalAnnualContribution)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
                  Tax Benefits
                </h4>
                <div className="space-y-2">
                  {formData.salaryExchange ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700 dark:text-green-300">Tax & NI Savings:</span>
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(results.taxRelief)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700 dark:text-green-300">Net Cost to You:</span>
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(results.netCost)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700 dark:text-green-300">Tax Relief Added:</span>
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(results.taxRelief)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-green-700 dark:text-green-300">Cost from Net Pay:</span>
                        <span className="font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(results.netCost)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                  Projected at Retirement
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      Total Pension Pot:
                    </span>
                    <span className="font-bold text-xl text-purple-900 dark:text-purple-100">
                      {formatCurrency(results.projectedPot)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      Est. Annual Pension:
                    </span>
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      {formatCurrency(results.annualPension)}/year
                    </span>
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    Based on {formData.expectedReturn}% annual return
                  </div>
                </div>
              </div>

              {/* Qualifying Earnings Info */}
              {formData.qualifyingEarnings && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <InfoIcon size={16} className="text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Qualifying Earnings Band 2024/25
                      </h4>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div>• Lower limit: {formatCurrency(LOWER_EARNINGS_LIMIT)}</div>
                        <div>• Upper limit: {formatCurrency(UPPER_EARNINGS_LIMIT)}</div>
                        <div>• Contributions calculated on earnings between these limits</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-enrollment Status */}
              <div className={`rounded-lg p-4 ${
                meetsMinimumContribution() 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-start gap-2">
                  {meetsMinimumContribution() ? (
                    <>
                      <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                          Meets Auto-Enrollment Requirements
                        </h4>
                        <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                          Your pension meets the minimum 8% total contribution with at least 3% from employer.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircleIcon size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Below Auto-Enrollment Minimum
                        </h4>
                        <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                          Consider increasing contributions to meet the 8% minimum (with 3% from employer).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Important Note */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircleIcon size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium mb-1">Important Note</p>
                <p>
                  Auto-enrollment thresholds and contribution rates are subject to change. The qualifying earnings 
                  band shown (£6,240 - £50,270) is for the 2024-25 tax year. Employer contributions may vary above 
                  the minimum. Tax relief depends on individual circumstances. Consider seeking advice from a 
                  qualified pensions adviser for your specific situation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}