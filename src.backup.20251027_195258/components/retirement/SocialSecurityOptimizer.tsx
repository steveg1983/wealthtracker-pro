import React, { useState, useEffect } from 'react';
import { parseCurrencyDecimal } from '../../utils/currency-decimal';
import { usRetirementService } from '../../services/usRetirementService';
import type { SocialSecurityCalculation } from '../../services/usRetirementService';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import { ProfessionalIcon } from '../icons/ProfessionalIcons';
import { Decimal, formatPercentageFromRatio, formatPercentageValue, toDecimal } from '@wealthtracker/utils';

type SocialSecurityOptimization = ReturnType<typeof usRetirementService.optimizeSocialSecurityClaiming>;
type SocialSecurityOptimizationEntry = SocialSecurityOptimization['analysis'][number];

export default function SocialSecurityOptimizer(): React.JSX.Element {
  const { formatCurrency } = useCurrencyDecimal();
  
  const [birthYear, setBirthYear] = useState<number>(1965);
  const [averageEarnings, setAverageEarnings] = useState<number>(60000);
  const [yearsWorked, setYearsWorked] = useState<number>(35);
  const [claimingAge, setClaimingAge] = useState<number>(67);
  const [lifeExpectancy, setLifeExpectancy] = useState<number>(85);
  const [calculation, setCalculation] = useState<SocialSecurityCalculation | null>(null);
  const [optimization, setOptimization] = useState<SocialSecurityOptimization | null>(null);
  
  useEffect(() => {
    const monthlyEarnings = toDecimal(averageEarnings)
      .dividedBy(12)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    const currentCalculation = usRetirementService.calculateSocialSecurity(
      monthlyEarnings,
      birthYear,
      claimingAge,
      yearsWorked
    );
    setCalculation(currentCalculation);

    const optimal = usRetirementService.optimizeSocialSecurityClaiming(
      monthlyEarnings,
      birthYear,
      lifeExpectancy
    );
    setOptimization(optimal);
  }, [averageEarnings, birthYear, claimingAge, lifeExpectancy, yearsWorked]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Social Security Optimizer</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Find your optimal Social Security claiming strategy
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Birth Year */}
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
            Full Retirement Age: {calculation?.fullRetirementAge || 67} years
          </p>
        </div>
        
        {/* Average Earnings */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Average Annual Earnings
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              value={averageEarnings}
              onChange={(e) => setAverageEarnings(parseInt(e.target.value))}
              min="0"
              max="200000"
              className="w-full pl-8 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Your highest 35 years average
          </p>
        </div>
        
        {/* Years Worked */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Years Worked
          </label>
          <input
            type="number"
            value={yearsWorked}
            onChange={(e) => setYearsWorked(parseInt(e.target.value))}
            min="0"
            max="50"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Credits earned: {Math.min(yearsWorked * 4, 40)} (need 40 to qualify)
          </p>
        </div>
        
        {/* Claiming Age */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Claiming Age
          </label>
          <input
            type="number"
            value={claimingAge}
            onChange={(e) => setClaimingAge(parseCurrencyDecimal(e.target.value || '0').toNumber())}
            min="62"
            max="70"
            step="0.25"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Age 62 (earliest) to 70 (maximum benefit)
          </p>
        </div>
        
        {/* Life Expectancy */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">
            Life Expectancy (for optimization)
          </label>
          <input
            type="range"
            value={lifeExpectancy}
            onChange={(e) => setLifeExpectancy(parseInt(e.target.value))}
            min="70"
            max="100"
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>70</span>
            <span className="font-medium">{lifeExpectancy} years</span>
            <span>100</span>
          </div>
        </div>
      </div>
      
      {/* Results */}
      {calculation && (
        <div className="mt-6 pt-6 border-t">
          {/* Eligibility Check */}
          {!calculation.eligible ? (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Not Eligible - Need {40 - calculation.credits} more credits
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                You need 40 credits (10 years of work) to qualify for Social Security
              </p>
            </div>
          ) : (
            <>
              {/* Current Selection Benefits */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3">
                  Benefits at Age {claimingAge}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Monthly Benefit</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(calculation.monthlyBenefit)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Annual Benefit</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(calculation.annualBenefit)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {claimingAge < calculation.fullRetirementAge ? 'Reduction' : 'Increase'}
                    </p>
                    <p className="text-lg font-bold">
                      {claimingAge < calculation.fullRetirementAge ? (
                        <span className="text-red-600 dark:text-red-400">
                          -{formatPercentageFromRatio(calculation.reduction ?? 0, 1)}
                        </span>
                      ) : claimingAge > calculation.fullRetirementAge ? (
                        <span className="text-green-600 dark:text-green-400">
                          {formatPercentageValue(
                            toDecimal(claimingAge)
                              .minus(calculation.fullRetirementAge ?? 0)
                              .times(8),
                            1
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">Full</span>
                      )}
                    </p>
                  </div>
                </div>
                
                {calculation.breakEvenAge && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      Break-even age vs. FRA: {toDecimal(calculation.breakEvenAge ?? 0)
                        .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
                        .toString()} years
                    </p>
                  </div>
                )}
              </div>
              
              {/* Optimization Results */}
              {optimization && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ProfessionalIcon name="trendingUp" size={18} />
                    Optimization Analysis
                  </h4>
                  
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg mb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Optimal Claiming Strategy
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Claim at Age</p>
                        <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
                          {optimization.optimalAge}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Monthly</p>
                        <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
                          {formatCurrency(optimization.monthlyBenefit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Lifetime</p>
                        <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
                          {formatCurrency(optimization.lifetimeBenefit)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Comparison Chart */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium mb-2">Lifetime Benefits by Claiming Age</p>
                    {[62, 65, 67, 70].map(age => {
                      const data = optimization.analysis.find((entry: SocialSecurityOptimizationEntry) => Math.floor(entry.age) === age);
                      if (!data) return null;
                      const lifetimeBenefitDecimal = toDecimal(optimization.lifetimeBenefit);
                      const percentageDecimal = lifetimeBenefitDecimal.isZero()
                        ? toDecimal(0)
                        : toDecimal(data.lifetime).dividedBy(lifetimeBenefitDecimal).times(100);
                      const percentage = percentageDecimal.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
                      
                      return (
                        <div key={age} className="flex items-center gap-3">
                          <span className="text-sm font-medium w-16">Age {age}</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                            <div 
                              className="absolute left-0 top-0 h-full bg-gradient-to-r from-gray-500 to-purple-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                            <span className="absolute right-2 top-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {formatCurrency(data.lifetime)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Additional Information */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <ProfessionalIcon name="info" size={16} className="text-gray-600 dark:text-gray-500 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <p>• 2025 COLA adjustment: 2.5% already included</p>
                    <p>• Maximum benefit at age 70: {formatCurrency(5108)}/month</p>
                    <p>• Spousal benefits may be available (50% of your benefit)</p>
                    <p>• Benefits subject to income tax if total income exceeds thresholds</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
