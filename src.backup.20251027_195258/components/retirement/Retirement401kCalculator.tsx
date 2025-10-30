import React, { useState, useEffect } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';

interface Contribution401k {
  employeeContribution: number;
  employerMatch: number;
  totalAnnualContribution: number;
  taxSavings: number;
  netCost: number;
  projectedBalance: number;
}

export default function Retirement401kCalculator() {
  const { formatCurrency } = useRegionalCurrency();
  
  const [formData, setFormData] = useState({
    annualSalary: 75000,
    currentAge: 30,
    retirementAge: 65,
    currentBalance: 25000,
    contributionPercent: 6,
    employerMatchPercent: 50,
    employerMatchLimit: 6,
    expectedReturn: 7,
    taxRate: 22
  });

  const [results, setResults] = useState<Contribution401k | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // IRS 2024 limits
  const CONTRIBUTION_LIMIT_2024 = 23000;
  const CATCH_UP_LIMIT = 7500; // for age 50+
  const isEligibleForCatchUp = formData.currentAge >= 50;
  const maxContribution = CONTRIBUTION_LIMIT_2024 + (isEligibleForCatchUp ? CATCH_UP_LIMIT : 0);

  useEffect(() => {
    const { 
      annualSalary, 
      contributionPercent, 
      employerMatchPercent, 
      employerMatchLimit,
      currentBalance,
      currentAge,
      retirementAge,
      expectedReturn,
      taxRate
    } = formData;

    // Calculate employee contribution
    const employeeContribution = Math.min(
      (annualSalary * contributionPercent) / 100,
      maxContribution
    );

    // Calculate employer match
    const effectiveMatchPercent = Math.min(contributionPercent, employerMatchLimit);
    const employerMatch = (annualSalary * effectiveMatchPercent * employerMatchPercent) / 10000;

    // Total annual contribution
    const totalAnnualContribution = employeeContribution + employerMatch;

    // Tax savings (traditional 401k)
    const taxSavings = employeeContribution * (taxRate / 100);

    // Net cost to employee (after tax savings)
    const netCost = employeeContribution - taxSavings;

    // Project future balance
    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = totalAnnualContribution / 12;
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Future value with compound interest
    const futureValue = currentBalance * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

    setResults({
      employeeContribution,
      employerMatch,
      totalAnnualContribution,
      taxSavings,
      netCost,
      projectedBalance: futureValue
    });
  }, [formData, maxContribution]);

  const getMatchDescription = () => {
    const { employerMatchPercent, employerMatchLimit } = formData;
    return `${employerMatchPercent}% match on first ${employerMatchLimit}% of salary`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ProfessionalIcon name="calculator" size={20} />
          401(k) Contribution Calculator
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Annual Salary
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.annualSalary}
                  onChange={(e) => setFormData({ ...formData, annualSalary: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Contribution (% of salary)
              </label>
              <input
                type="number"
                value={formData.contributionPercent}
                onChange={(e) => setFormData({ ...formData, contributionPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="100"
                step="1"
              />
              {formData.contributionPercent < formData.employerMatchLimit && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ Contributing below employer match limit - you're leaving free money on the table!
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Employer Match
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={formData.employerMatchPercent}
                  onChange={(e) => setFormData({ ...formData, employerMatchPercent: Number(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                  step="25"
                  placeholder="Match %"
                />
                <input
                  type="number"
                  value={formData.employerMatchLimit}
                  onChange={(e) => setFormData({ ...formData, employerMatchLimit: Number(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Up to %"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getMatchDescription()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current 401(k) Balance
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.currentBalance}
                  onChange={(e) => setFormData({ ...formData, currentBalance: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
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
                      max="70"
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
                      min="50"
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
                      max="15"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      max="40"
                    />
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
                    <span className="text-sm text-blue-700 dark:text-gray-300">Employer Match:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      +{formatCurrency(results.employerMatch)}
                    </span>
                  </div>
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
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700 dark:text-green-300">Tax Savings:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {formatCurrency(results.taxSavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-green-700 dark:text-green-300">Net Cost to You:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {formatCurrency(results.netCost)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
                  Projected at Retirement
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      Age {formData.retirementAge} Balance:
                    </span>
                    <span className="font-bold text-xl text-purple-900 dark:text-purple-100">
                      {formatCurrency(results.projectedBalance)}
                    </span>
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    Based on {formData.expectedReturn}% annual return
                  </div>
                </div>
              </div>

              {/* IRS Limits Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <ProfessionalIcon name="info" size={16} className="text-gray-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      2024 IRS Contribution Limits
                    </h4>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div>• Regular limit: {formatCurrency(CONTRIBUTION_LIMIT_2024)}</div>
                      {isEligibleForCatchUp && (
                        <div>• Catch-up (50+): +{formatCurrency(CATCH_UP_LIMIT)}</div>
                      )}
                      <div>• Your max: {formatCurrency(maxContribution)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              {formData.contributionPercent < formData.employerMatchLimit && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <ProfessionalIcon name="error" size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Maximize Your Match!
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                        Increase your contribution to {formData.employerMatchLimit}% to get the full employer match.
                        That's an extra {formatCurrency(
                          (formData.annualSalary * (formData.employerMatchLimit - formData.contributionPercent) * formData.employerMatchPercent) / 10000
                        )} per year in free money!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Important Note */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <ProfessionalIcon name="error" size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium mb-1">Important Note</p>
                <p>
                  401(k) contribution limits are adjusted annually by the IRS. The $23,000 limit shown is for 2024, 
                  with an additional $7,500 catch-up contribution for those 50 and older. Employer match policies 
                  vary by company. Investment returns are not guaranteed and will fluctuate. Consult your plan 
                  administrator and a financial advisor for personalized guidance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
