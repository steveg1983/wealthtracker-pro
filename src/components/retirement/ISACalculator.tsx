import React, { useState, useEffect } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalSettings';
import { 
  PiggyBankIcon,
  TrendingUpIcon,
  InfoIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  HomeIcon,
  DollarSignIcon
} from '../icons';

interface ISACalculation {
  cashISA: {
    contribution: number;
    interestRate: number;
    projectedValue: number;
    taxSaved: number;
  };
  stocksISA: {
    contribution: number;
    expectedReturn: number;
    projectedValue: number;
    taxSaved: number;
  };
  lifetimeISA: {
    contribution: number;
    governmentBonus: number;
    totalContribution: number;
    projectedValue: number;
    earlyWithdrawalPenalty: number;
    netAfterPenalty: number;
    canUseForHome: boolean;
  };
  totalUsed: number;
  remainingAllowance: number;
  recommendation: string;
}

export default function ISACalculator() {
  const { formatCurrency } = useRegionalCurrency();
  
  const [formData, setFormData] = useState({
    currentAge: 30,
    retirementAge: 60,
    totalToInvest: 20000,
    cashISAAmount: 5000,
    stocksISAAmount: 11000,
    lifetimeISAAmount: 4000,
    cashInterestRate: 4.5,
    stocksExpectedReturn: 7,
    currentTaxRate: 20, // Basic rate
    buyingFirstHome: true,
    homePurchaseYear: 2,
    homePrice: 350000,
    existingISABalance: 0
  });

  const [calculation, setCalculation] = useState<ISACalculation | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 2024-25 ISA limits (verified from official sources)
  const ISA_ANNUAL_LIMIT = 20000;
  const LIFETIME_ISA_LIMIT = 4000;
  const LIFETIME_ISA_BONUS_RATE = 0.25; // 25% government bonus
  const LIFETIME_ISA_MAX_BONUS = 1000; // Maximum £1,000 bonus per year
  const LIFETIME_ISA_HOME_LIMIT = 450000; // Property price limit for first home
  const LIFETIME_ISA_MIN_AGE = 18;
  const LIFETIME_ISA_MAX_AGE = 39; // Can't open after 40
  const LIFETIME_ISA_MAX_CONTRIBUTION_AGE = 50;
  const LIFETIME_ISA_WITHDRAWAL_AGE = 60;
  const LIFETIME_ISA_PENALTY_RATE = 0.25; // 25% penalty for early withdrawal
  const JUNIOR_ISA_LIMIT = 9000; // For reference

  useEffect(() => {
    calculateISA();
  }, [formData]);

  const calculateISA = () => {
    const {
      currentAge,
      retirementAge,
      cashISAAmount,
      stocksISAAmount,
      lifetimeISAAmount,
      cashInterestRate,
      stocksExpectedReturn,
      currentTaxRate,
      buyingFirstHome,
      homePurchaseYear,
      homePrice
    } = formData;

    // Validate total doesn't exceed limit
    const totalContribution = cashISAAmount + stocksISAAmount + lifetimeISAAmount;
    const actualLifetimeISA = Math.min(lifetimeISAAmount, LIFETIME_ISA_LIMIT);
    const actualTotal = Math.min(totalContribution, ISA_ANNUAL_LIMIT);
    
    // Adjust if over limit
    let adjustedCash = cashISAAmount;
    let adjustedStocks = stocksISAAmount;
    let adjustedLifetime = actualLifetimeISA;
    
    if (totalContribution > ISA_ANNUAL_LIMIT) {
      const excess = totalContribution - ISA_ANNUAL_LIMIT;
      // Reduce stocks & shares ISA first, then cash ISA
      if (adjustedStocks >= excess) {
        adjustedStocks -= excess;
      } else {
        adjustedCash -= (excess - (stocksISAAmount - adjustedStocks));
        adjustedStocks = 0;
      }
    }

    // Calculate projections
    const yearsToRetirement = retirementAge - currentAge;
    
    // Cash ISA calculation
    const cashProjection = adjustedCash * Math.pow(1 + (cashInterestRate / 100), yearsToRetirement);
    const cashInterestEarned = cashProjection - adjustedCash;
    const cashTaxSaved = cashInterestEarned * (currentTaxRate / 100); // Tax saved on interest

    // Stocks & Shares ISA calculation
    const stocksProjection = adjustedStocks * Math.pow(1 + (stocksExpectedReturn / 100), yearsToRetirement);
    const stocksGainEarned = stocksProjection - adjustedStocks;
    const stocksTaxSaved = stocksGainEarned * 0.20; // Capital gains tax saved (20% for higher rate)

    // Lifetime ISA calculation
    const canContributeLifetime = currentAge >= LIFETIME_ISA_MIN_AGE && currentAge <= LIFETIME_ISA_MAX_AGE;
    const lifetimeBonus = canContributeLifetime ? adjustedLifetime * LIFETIME_ISA_BONUS_RATE : 0;
    const lifetimeTotalContribution = adjustedLifetime + lifetimeBonus;
    
    // Calculate years of contribution (stops at 50)
    const yearsOfContribution = Math.min(
      LIFETIME_ISA_MAX_CONTRIBUTION_AGE - currentAge,
      yearsToRetirement
    );
    
    // Project LISA value (with annual contributions and bonuses)
    let lifetimeProjection = 0;
    if (canContributeLifetime) {
      const annualTotal = adjustedLifetime + lifetimeBonus;
      const monthlyContribution = annualTotal / 12;
      const monthlyReturn = stocksExpectedReturn / 100 / 12;
      const months = yearsOfContribution * 12;
      
      lifetimeProjection = monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);
    }

    // Calculate early withdrawal penalty
    const withdrawalAge = buyingFirstHome ? currentAge + homePurchaseYear : retirementAge;
    const earlyWithdrawal = withdrawalAge < LIFETIME_ISA_WITHDRAWAL_AGE && !buyingFirstHome;
    const penalty = earlyWithdrawal ? lifetimeProjection * LIFETIME_ISA_PENALTY_RATE : 0;
    const netAfterPenalty = lifetimeProjection - penalty;
    
    // Can use for home purchase?
    const canUseForHome = buyingFirstHome && 
                          homePrice <= LIFETIME_ISA_HOME_LIMIT && 
                          canContributeLifetime;

    // Recommendation logic
    let recommendation = '';
    if (currentAge <= LIFETIME_ISA_MAX_AGE && buyingFirstHome && homePrice <= LIFETIME_ISA_HOME_LIMIT) {
      recommendation = 'Maximize Lifetime ISA for the 25% government bonus on your first home';
    } else if (currentAge <= LIFETIME_ISA_MAX_AGE && retirementAge >= LIFETIME_ISA_WITHDRAWAL_AGE) {
      recommendation = 'Consider Lifetime ISA for the 25% bonus and retirement at 60+';
    } else if (yearsToRetirement > 5) {
      recommendation = 'Focus on Stocks & Shares ISA for long-term growth potential';
    } else {
      recommendation = 'Consider Cash ISA for shorter-term savings with guaranteed returns';
    }

    setCalculation({
      cashISA: {
        contribution: adjustedCash,
        interestRate: cashInterestRate,
        projectedValue: cashProjection,
        taxSaved: cashTaxSaved
      },
      stocksISA: {
        contribution: adjustedStocks,
        expectedReturn: stocksExpectedReturn,
        projectedValue: stocksProjection,
        taxSaved: stocksTaxSaved
      },
      lifetimeISA: {
        contribution: adjustedLifetime,
        governmentBonus: lifetimeBonus,
        totalContribution: lifetimeTotalContribution,
        projectedValue: lifetimeProjection,
        earlyWithdrawalPenalty: penalty,
        netAfterPenalty: netAfterPenalty,
        canUseForHome: canUseForHome
      },
      totalUsed: adjustedCash + adjustedStocks + adjustedLifetime,
      remainingAllowance: ISA_ANNUAL_LIMIT - (adjustedCash + adjustedStocks + adjustedLifetime),
      recommendation
    });
  };

  const getTotalAllocation = () => {
    return formData.cashISAAmount + formData.stocksISAAmount + formData.lifetimeISAAmount;
  };

  const isOverLimit = () => {
    return getTotalAllocation() > ISA_ANNUAL_LIMIT;
  };

  const canOpenLifetimeISA = () => {
    return formData.currentAge >= LIFETIME_ISA_MIN_AGE && formData.currentAge <= LIFETIME_ISA_MAX_AGE;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <PiggyBankIcon size={20} />
          ISA Optimization Calculator
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
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Age
                </label>
                <input
                  type="number"
                  value={formData.retirementAge}
                  onChange={(e) => setFormData({ ...formData, retirementAge: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="40"
                  max="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cash ISA Allocation
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.cashISAAmount}
                  onChange={(e) => setFormData({ ...formData, cashISAAmount: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max={ISA_ANNUAL_LIMIT}
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stocks & Shares ISA Allocation
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.stocksISAAmount}
                  onChange={(e) => setFormData({ ...formData, stocksISAAmount: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max={ISA_ANNUAL_LIMIT}
                  step="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Lifetime ISA Allocation {!canOpenLifetimeISA() && '(Age restricted)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.lifetimeISAAmount}
                  onChange={(e) => setFormData({ ...formData, lifetimeISAAmount: Math.min(Number(e.target.value), LIFETIME_ISA_LIMIT) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max={LIFETIME_ISA_LIMIT}
                  step="100"
                  disabled={!canOpenLifetimeISA()}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max £{LIFETIME_ISA_LIMIT.toLocaleString()}/year, 25% government bonus
              </p>
            </div>

            {/* Total Allocation Status */}
            <div className={`p-3 rounded-lg ${
              isOverLimit() 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total ISA Allocation:</span>
                <span className={`font-bold ${isOverLimit() ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatCurrency(getTotalAllocation())} / {formatCurrency(ISA_ANNUAL_LIMIT)}
                </span>
              </div>
              {isOverLimit() && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  ⚠️ Total exceeds annual limit. Amounts will be adjusted.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.buyingFirstHome}
                  onChange={(e) => setFormData({ ...formData, buyingFirstHome: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Planning to buy first home
                </span>
              </label>
              
              {formData.buyingFirstHome && (
                <div className="ml-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Years until purchase
                    </label>
                    <input
                      type="number"
                      value={formData.homePurchaseYear}
                      onChange={(e) => setFormData({ ...formData, homePurchaseYear: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="1"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expected home price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                      <input
                        type="number"
                        value={formData.homePrice}
                        onChange={(e) => setFormData({ ...formData, homePrice: Number(e.target.value) })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        step="10000"
                      />
                    </div>
                    {formData.homePrice > LIFETIME_ISA_HOME_LIMIT && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        ⚠️ Above £{LIFETIME_ISA_HOME_LIMIT.toLocaleString()} Lifetime ISA limit for homes
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showDetails ? 'Hide' : 'Show'} Return Assumptions
            </button>

            {showDetails && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cash ISA Interest (%)
                    </label>
                    <input
                      type="number"
                      value={formData.cashInterestRate}
                      onChange={(e) => setFormData({ ...formData, cashInterestRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      max="10"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stocks Return (%)
                    </label>
                    <input
                      type="number"
                      value={formData.stocksExpectedReturn}
                      onChange={(e) => setFormData({ ...formData, stocksExpectedReturn: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                      max="15"
                      step="0.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          {calculation && (
            <div className="space-y-4">
              {/* Recommendation */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <InfoIcon size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Recommendation
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                      {calculation.recommendation}
                    </p>
                  </div>
                </div>
              </div>

              {/* ISA Breakdown */}
              <div className="space-y-3">
                {/* Cash ISA */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <DollarSignIcon size={16} />
                    Cash ISA
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Annual Contribution:</span>
                      <p className="font-medium">{formatCurrency(calculation.cashISA.contribution)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Interest Rate:</span>
                      <p className="font-medium">{calculation.cashISA.interestRate}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Projected Value:</span>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(calculation.cashISA.projectedValue)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Tax Saved:</span>
                      <p className="font-medium">{formatCurrency(calculation.cashISA.taxSaved)}</p>
                    </div>
                  </div>
                </div>

                {/* Stocks & Shares ISA */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <TrendingUpIcon size={16} />
                    Stocks & Shares ISA
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Annual Contribution:</span>
                      <p className="font-medium">{formatCurrency(calculation.stocksISA.contribution)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
                      <p className="font-medium">{calculation.stocksISA.expectedReturn}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Projected Value:</span>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(calculation.stocksISA.projectedValue)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Tax Saved:</span>
                      <p className="font-medium">{formatCurrency(calculation.stocksISA.taxSaved)}</p>
                    </div>
                  </div>
                </div>

                {/* Lifetime ISA */}
                {canOpenLifetimeISA() && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                      <HomeIcon size={16} />
                      Lifetime ISA
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-purple-700 dark:text-purple-300">Your Contribution:</span>
                        <p className="font-medium text-purple-900 dark:text-purple-100">
                          {formatCurrency(calculation.lifetimeISA.contribution)}
                        </p>
                      </div>
                      <div>
                        <span className="text-purple-700 dark:text-purple-300">Government Bonus:</span>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          +{formatCurrency(calculation.lifetimeISA.governmentBonus)}
                        </p>
                      </div>
                      <div>
                        <span className="text-purple-700 dark:text-purple-300">Total Annual:</span>
                        <p className="font-medium text-purple-900 dark:text-purple-100">
                          {formatCurrency(calculation.lifetimeISA.totalContribution)}
                        </p>
                      </div>
                      <div>
                        <span className="text-purple-700 dark:text-purple-300">Projected Value:</span>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(calculation.lifetimeISA.projectedValue)}
                        </p>
                      </div>
                    </div>
                    
                    {calculation.lifetimeISA.earlyWithdrawalPenalty > 0 && (
                      <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          ⚠️ Early withdrawal penalty: -{formatCurrency(calculation.lifetimeISA.earlyWithdrawalPenalty)}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Net after penalty: {formatCurrency(calculation.lifetimeISA.netAfterPenalty)}
                        </p>
                      </div>
                    )}
                    
                    {formData.buyingFirstHome && calculation.lifetimeISA.canUseForHome && (
                      <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <p className="text-xs text-green-800 dark:text-green-200">
                          ✓ Can be used for first home purchase (up to £450,000)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ISA Rules Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <InfoIcon size={16} className="text-gray-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      2024-25 ISA Rules
                    </h4>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div>• Annual ISA allowance: £20,000 (frozen until 2030)</div>
                      <div>• Lifetime ISA: Max £4,000/year with 25% bonus</div>
                      <div>• Can open multiple ISAs of same type since April 2024</div>
                      <div>• All gains and interest are tax-free</div>
                      <div>• Lifetime ISA: Age 18-39 to open, contribute until 50</div>
                      <div>• Lifetime ISA: Withdraw at 60+ or for first home (£450k max)</div>
                    </div>
                  </div>
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
                  ISA allowances and rules are subject to change. The £20,000 annual allowance and £4,000 
                  Lifetime ISA limit shown are for the 2024-25 tax year. Tax treatment depends on individual 
                  circumstances and may change in the future. Consider seeking professional financial advice 
                  for your specific situation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}