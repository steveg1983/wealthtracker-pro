import React, { useState, useEffect, useCallback } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';

interface IRAComparison {
  traditional: {
    contributionAmount: number;
    taxDeductionNow: number;
    netCostNow: number;
    projectedBalance: number;
    taxesOnWithdrawal: number;
    netWithdrawal: number;
    effectiveTaxRate: number;
    canDeduct: boolean;
    deductionPhaseOutAmount: number;
  };
  roth: {
    contributionAmount: number;
    taxPaidNow: number;
    netCostNow: number;
    projectedBalance: number;
    taxesOnWithdrawal: number;
    netWithdrawal: number;
    effectiveTaxRate: number;
    canContribute: boolean;
    contributionPhaseOutAmount: number;
  };
  recommendation: 'traditional' | 'roth' | 'both';
  difference: number;
}

type FilingStatus = 'single' | 'married' | 'marriedSeparate';

// 2024 IRS limits (verified from official sources)
const CONTRIBUTION_LIMIT = 7000;
const CATCH_UP_LIMIT = 1000; // age 50+

// 2024 Roth IRA income phase-out ranges (official IRS)
const ROTH_PHASE_OUT = {
  single: { start: 146000, end: 161000 },
  married: { start: 230000, end: 240000 },
  marriedSeparate: { start: 0, end: 10000 }
};

// 2024 Traditional IRA deduction phase-out ranges (official IRS)
const TRADITIONAL_PHASE_OUT = {
  single: { start: 77000, end: 87000 },
  married: { start: 123000, end: 143000 }, // when contributor has workplace plan
  marriedSpouseOnly: { start: 230000, end: 240000 } // when only spouse has plan
};

export default function IRAComparisonCalculator() {
  const { formatCurrency } = useRegionalCurrency();

  const [formData, setFormData] = useState({
    currentAge: 35,
    retirementAge: 65,
    annualContribution: 7000,
    currentBalance: 0,
    expectedReturn: 7,
    currentIncome: 75000,
    filingStatus: 'single' as FilingStatus,
    currentTaxRate: 22,
    retirementTaxRate: 12,
    hasWorkplacePlan: false,
    spouseHasWorkplacePlan: false,
    retirementIncome: 40000
  });

  const [comparison, setComparison] = useState<IRAComparison | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isEligibleForCatchUp = formData.currentAge >= 50;
  const maxContribution = CONTRIBUTION_LIMIT + (isEligibleForCatchUp ? CATCH_UP_LIMIT : 0);

  const calculatePhaseOut = useCallback((income: number, start: number, end: number, amount: number): number => {
    if (income <= start) return amount;
    if (income >= end) return 0;

    const phaseOutRange = end - start;
    const incomeOverStart = income - start;
    const phaseOutPercentage = 1 - (incomeOverStart / phaseOutRange);

    return Math.floor(amount * phaseOutPercentage);
  }, []);

  const calculateComparison = useCallback(() => {
    const {
      currentAge,
      retirementAge,
      annualContribution,
      currentBalance,
      expectedReturn,
      currentIncome,
      filingStatus,
      currentTaxRate,
      retirementTaxRate,
      hasWorkplacePlan,
      spouseHasWorkplacePlan
    } = formData;

    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = annualContribution / 12;
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Calculate future value
    const futureValue = currentBalance * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

    // Traditional IRA calculations
    let traditionalDeductible = annualContribution;
    let canDeductTraditional = true;

    if (hasWorkplacePlan) {
      const phaseOut = TRADITIONAL_PHASE_OUT[filingStatus === 'marriedSeparate' ? 'single' : filingStatus];
      traditionalDeductible = calculatePhaseOut(currentIncome, phaseOut.start, phaseOut.end, annualContribution);
      canDeductTraditional = traditionalDeductible > 0;
    } else if (filingStatus === 'married' && spouseHasWorkplacePlan) {
      const phaseOut = TRADITIONAL_PHASE_OUT.marriedSpouseOnly;
      traditionalDeductible = calculatePhaseOut(currentIncome, phaseOut.start, phaseOut.end, annualContribution);
      canDeductTraditional = traditionalDeductible > 0;
    }

    const traditionalTaxDeduction = traditionalDeductible * (currentTaxRate / 100);
    const traditionalNetCost = annualContribution - traditionalTaxDeduction;
    const traditionalTaxOnWithdrawal = futureValue * (retirementTaxRate / 100);
    const traditionalNetWithdrawal = futureValue - traditionalTaxOnWithdrawal;

    // Roth IRA calculations
    const rothPhaseOut = ROTH_PHASE_OUT[filingStatus === 'marriedSeparate' ? 'marriedSeparate' : filingStatus];
    const rothContributionAllowed = calculatePhaseOut(
      currentIncome,
      rothPhaseOut.start,
      rothPhaseOut.end,
      annualContribution
    );
    const canContributeRoth = rothContributionAllowed > 0;

    const rothTaxPaidNow = 0; // No deduction for Roth
    const rothNetCost = rothContributionAllowed; // Pay with after-tax dollars
    const rothTaxOnWithdrawal = 0; // Tax-free withdrawals
    const rothNetWithdrawal = canContributeRoth ? futureValue : 0;

    // Determine recommendation
    let recommendation: 'traditional' | 'roth' | 'both';
    if (currentTaxRate > retirementTaxRate && canDeductTraditional) {
      recommendation = 'traditional';
    } else if (currentTaxRate < retirementTaxRate && canContributeRoth) {
      recommendation = 'roth';
    } else if (canContributeRoth) {
      recommendation = 'roth';
    } else if (canDeductTraditional) {
      recommendation = 'traditional';
    } else {
      recommendation = 'both'; // Consider backdoor Roth or non-deductible traditional
    }

    setComparison({
      traditional: {
        contributionAmount: annualContribution,
        taxDeductionNow: traditionalTaxDeduction,
        netCostNow: traditionalNetCost,
        projectedBalance: futureValue,
        taxesOnWithdrawal: traditionalTaxOnWithdrawal,
        netWithdrawal: traditionalNetWithdrawal,
        effectiveTaxRate: retirementTaxRate,
        canDeduct: canDeductTraditional,
        deductionPhaseOutAmount: traditionalDeductible
      },
      roth: {
        contributionAmount: rothContributionAllowed,
        taxPaidNow: rothTaxPaidNow,
        netCostNow: rothNetCost,
        projectedBalance: canContributeRoth ? futureValue : 0,
        taxesOnWithdrawal: rothTaxOnWithdrawal,
        netWithdrawal: rothNetWithdrawal,
        effectiveTaxRate: 0,
        canContribute: canContributeRoth,
        contributionPhaseOutAmount: rothContributionAllowed
      },
      recommendation,
      difference: Math.abs(traditionalNetWithdrawal - rothNetWithdrawal)
    });
  }, [calculatePhaseOut, formData]);

  useEffect(() => {
    calculateComparison();
  }, [calculateComparison]);

  const getRecommendationText = () => {
    if (!comparison) return '';
    
    switch (comparison.recommendation) {
      case 'traditional':
        return 'Traditional IRA is recommended due to your higher current tax rate';
      case 'roth':
        return 'Roth IRA is recommended for tax-free growth and withdrawals';
      case 'both':
        return 'Consider both or explore backdoor Roth strategies';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ProfessionalIcon name="calculator" size={20} />
          Traditional IRA vs Roth IRA Comparison
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Annual Contribution
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.annualContribution}
                  onChange={(e) => setFormData({ ...formData, annualContribution: Math.min(Number(e.target.value), maxContribution) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max={maxContribution}
                  step="100"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                2024 limit: {formatCurrency(maxContribution)} {isEligibleForCatchUp && '(includes catch-up)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Annual Income
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.currentIncome}
                  onChange={(e) => setFormData({ ...formData, currentIncome: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filing Status
              </label>
              <select
                value={formData.filingStatus}
                onChange={(e) => setFormData({ ...formData, filingStatus: e.target.value as FilingStatus })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="single">Single</option>
                <option value="married">Married Filing Jointly</option>
                <option value="marriedSeparate">Married Filing Separately</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hasWorkplacePlan}
                  onChange={(e) => setFormData({ ...formData, hasWorkplacePlan: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I have a workplace retirement plan (401k, etc.)
                </span>
              </label>
              
              {formData.filingStatus === 'married' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.spouseHasWorkplacePlan}
                    onChange={(e) => setFormData({ ...formData, spouseHasWorkplacePlan: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Spouse has a workplace retirement plan
                  </span>
                </label>
              )}
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
            >
              {showDetails ? 'Hide' : 'Show'} Advanced Settings
            </button>

            {showDetails && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Tax Rate (%)
                    </label>
                    <select
                      value={formData.currentTaxRate}
                      onChange={(e) => setFormData({ ...formData, currentTaxRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={10}>10%</option>
                      <option value={12}>12%</option>
                      <option value={22}>22%</option>
                      <option value={24}>24%</option>
                      <option value={32}>32%</option>
                      <option value={35}>35%</option>
                      <option value={37}>37%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Retirement Tax Rate (%)
                    </label>
                    <select
                      value={formData.retirementTaxRate}
                      onChange={(e) => setFormData({ ...formData, retirementTaxRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={10}>10%</option>
                      <option value={12}>12%</option>
                      <option value={22}>22%</option>
                      <option value={24}>24%</option>
                      <option value={32}>32%</option>
                    </select>
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
                      Est. Retirement Income
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formData.retirementIncome}
                        onChange={(e) => setFormData({ ...formData, retirementIncome: Number(e.target.value) })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        step="1000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comparison Results */}
          {comparison && (
            <div className="space-y-4">
              {/* Recommendation */}
              <div className={`rounded-lg p-4 ${
                comparison.recommendation === 'roth' 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : comparison.recommendation === 'traditional'
                  ? 'bg-blue-50 dark:bg-gray-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
              }`}>
                <div className="flex items-start gap-2">
                  <ProfessionalIcon name="success" size={16} className={
                    comparison.recommendation === 'roth'
                      ? 'text-green-600 dark:text-green-400'
                      : comparison.recommendation === 'traditional'
                      ? 'text-gray-600 dark:text-gray-500'
                      : 'text-purple-600 dark:text-purple-400'
                  } />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {getRecommendationText()}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Difference in retirement: {formatCurrency(comparison.difference)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Traditional IRA */}
                <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                    Traditional IRA
                  </h4>
                  
                  {!comparison.traditional.canDeduct && formData.hasWorkplacePlan && (
                    <div className="mb-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                      <p className="text-amber-800 dark:text-amber-200">
                        ⚠️ Income too high for full deduction
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Deductible: {formatCurrency(comparison.traditional.deductionPhaseOutAmount)}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
                      <span className="font-medium">{formatCurrency(comparison.traditional.contributionAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tax Saved Now:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(comparison.traditional.taxDeductionNow)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Net Cost:</span>
                      <span className="font-medium">{formatCurrency(comparison.traditional.netCostNow)}</span>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">At Retirement:</span>
                        <span className="font-medium">{formatCurrency(comparison.traditional.projectedBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Taxes Due:</span>
                        <span className="text-red-600 dark:text-red-400">
                          -{formatCurrency(comparison.traditional.taxesOnWithdrawal)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Net Value:</span>
                        <span className="text-blue-900 dark:text-blue-100">
                          {formatCurrency(comparison.traditional.netWithdrawal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Roth IRA */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
                    Roth IRA
                  </h4>
                  
                  {!comparison.roth.canContribute && (
                    <div className="mb-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs">
                      <p className="text-amber-800 dark:text-amber-200">
                        ⚠️ Income too high to contribute
                      </p>
                      {comparison.roth.contributionPhaseOutAmount > 0 && (
                        <p className="text-amber-700 dark:text-amber-300">
                          Allowed: {formatCurrency(comparison.roth.contributionPhaseOutAmount)}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Contribution:</span>
                      <span className="font-medium">
                        {formatCurrency(comparison.roth.contributionAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tax Saved Now:</span>
                      <span className="font-medium">{formatCurrency(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Net Cost:</span>
                      <span className="font-medium">{formatCurrency(comparison.roth.netCostNow)}</span>
                    </div>
                    <div className="border-t border-green-200 dark:border-green-800 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">At Retirement:</span>
                        <span className="font-medium">{formatCurrency(comparison.roth.projectedBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Taxes Due:</span>
                        <span className="text-green-600 dark:text-green-400">
                          {formatCurrency(0)} (Tax-Free!)
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Net Value:</span>
                        <span className="text-green-900 dark:text-green-100">
                          {formatCurrency(comparison.roth.netWithdrawal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Income Limits Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <ProfessionalIcon name="info" size={16} className="text-gray-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      2024 Income Limits ({formData.filingStatus === 'married' ? 'Married Filing Jointly' : 
                        formData.filingStatus === 'marriedSeparate' ? 'Married Filing Separately' : 'Single'})
                    </h4>
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <strong>Roth IRA Phase-Out:</strong> {formatCurrency(
                          ROTH_PHASE_OUT[formData.filingStatus === 'marriedSeparate' ? 'marriedSeparate' : 
                            formData.filingStatus === 'married' ? 'married' : 'single'].start
                        )} - {formatCurrency(
                          ROTH_PHASE_OUT[formData.filingStatus === 'marriedSeparate' ? 'marriedSeparate' : 
                            formData.filingStatus === 'married' ? 'married' : 'single'].end
                        )}
                      </div>
                      {formData.hasWorkplacePlan && (
                        <div>
                          <strong>Traditional IRA Deduction Phase-Out:</strong> {formatCurrency(
                            TRADITIONAL_PHASE_OUT[formData.filingStatus === 'marriedSeparate' ? 'single' : 
                              formData.filingStatus === 'married' ? 'married' : 'single'].start
                          )} - {formatCurrency(
                            TRADITIONAL_PHASE_OUT[formData.filingStatus === 'marriedSeparate' ? 'single' : 
                              formData.filingStatus === 'married' ? 'married' : 'single'].end
                          )}
                        </div>
                      )}
                      {!comparison.roth.canContribute && (
                        <div className="mt-2 text-amber-600 dark:text-amber-400">
                          💡 Consider a Backdoor Roth conversion strategy
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Important Note */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <ProfessionalIcon name="error" size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium mb-1">Important Note</p>
                <p>
                  IRA contribution limits and income phase-outs are subject to annual adjustments. The limits 
                  shown are for 2024. Tax laws are complex and change frequently. This calculator provides 
                  general information only and does not constitute tax advice. Consult with a qualified tax 
                  professional or financial advisor for guidance specific to your situation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
