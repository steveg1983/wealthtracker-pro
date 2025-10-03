import React, { useState, useEffect } from 'react';
import { 
  CalculatorIcon as Calculator,
  AlertTriangleIcon as AlertTriangle,
  InfoIcon as Info,
  CalendarIcon as Calendar,
  TrendingDownIcon as TrendingDown,
  DollarSignIcon as DollarSign
} from '../icons';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';
import Decimal from 'decimal.js';

interface RMDCalculation {
  age: number;
  accountBalance: number;
  accountType: '401k' | 'traditionalIRA' | 'sepIRA' | 'simpleIRA' | '403b' | '457b';
  birthYear: number;
  spouseBeneficiary: boolean;
  spouseAge?: number;
  stillWorking: boolean; // For 401k/403b if still employed
}

// IRS Uniform Lifetime Table (Publication 590-B)
// Updated for 2022 and later (SECURE Act changes)
const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6,
  76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9,
  116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
  120: 2.0 // 120 and older
};

// Joint Life Expectancy Table III (simplified for spouse more than 10 years younger)
// This is a simplified version - full table has many more entries
const JOINT_LIFE_TABLE_SAMPLE: Record<number, Record<number, number>> = {
  73: { 50: 36.5, 55: 32.2, 60: 28.1 },
  75: { 50: 36.3, 55: 31.9, 60: 27.7 },
  80: { 50: 35.9, 55: 31.3, 60: 26.8 },
  85: { 50: 35.5, 55: 30.8, 60: 26.2 }
};

export default function RMDCalculator(): React.JSX.Element {
  const { region } = useRegionalSettings();
  const currentYear = new Date().getFullYear();
  
  const [calculation, setCalculation] = useState<RMDCalculation>({
    age: 73,
    accountBalance: 500000,
    accountType: 'traditionalIRA',
    birthYear: currentYear - 73,
    spouseBeneficiary: false,
    stillWorking: false
  });

  const [results, setResults] = useState({
    rmdAmount: 0,
    distributionFactor: 0,
    rmdAge: 73,
    firstRMDDeadline: '',
    annualDeadline: 'December 31',
    penalty: 0,
    taxEstimate: 0,
    projections: [] as Array<{ age: number; balance: number; rmd: number }>
  });

  // Determine RMD age based on birth year (SECURE Act 2.0)
  const getRMDAge = (birthYear: number): number => {
    if (birthYear <= 1950) return 72;
    if (birthYear >= 1951 && birthYear <= 1959) return 73;
    return 75; // Born 1960 or later
  };

  // Get distribution factor based on age and beneficiary status
  const getDistributionFactor = (age: number, spouseBeneficiary: boolean, spouseAge?: number): number => {
    // If spouse is sole beneficiary and more than 10 years younger, use Joint Life Table
    if (spouseBeneficiary && spouseAge && (age - spouseAge) > 10) {
      // Simplified calculation - in practice would use full Joint Life Table
      const ageDiff = age - spouseAge;
      return UNIFORM_LIFETIME_TABLE[age] + (ageDiff - 10) * 0.5; // Approximate
    }
    
    // Use Uniform Lifetime Table for most cases
    if (age >= 120) return UNIFORM_LIFETIME_TABLE[120];
    return UNIFORM_LIFETIME_TABLE[age] || 27.4;
  };

  // Calculate RMD and related values
  useEffect(() => {
    const rmdAge = getRMDAge(calculation.birthYear);
    const currentAge = calculation.age;
    
    // Check if RMD is required
    if (currentAge < rmdAge) {
      setResults(prev => ({
        ...prev,
        rmdAmount: 0,
        distributionFactor: 0,
        rmdAge,
        firstRMDDeadline: `April 1, ${calculation.birthYear + rmdAge + 1}`,
        penalty: 0,
        taxEstimate: 0,
        projections: []
      }));
      return;
    }

    // Special rule for still working (401k/403b only)
    if (calculation.stillWorking && 
        (calculation.accountType === '401k' || calculation.accountType === '403b')) {
      setResults(prev => ({
        ...prev,
        rmdAmount: 0,
        distributionFactor: 0,
        rmdAge,
        firstRMDDeadline: 'April 1 of year after retirement',
        penalty: 0,
        taxEstimate: 0,
        projections: []
      }));
      return;
    }

    // Calculate distribution factor
    const factor = getDistributionFactor(
      currentAge,
      calculation.spouseBeneficiary,
      calculation.spouseAge
    );

    // Calculate RMD amount
    const rmdAmount = new Decimal(calculation.accountBalance).dividedBy(factor).toNumber();

    // Calculate penalty (25% of RMD not taken, reduced to 10% if corrected within 2 years)
    const penalty = new Decimal(rmdAmount).times(0.25).toNumber();

    // Estimate taxes (assuming 22% federal bracket for demonstration)
    const taxEstimate = new Decimal(rmdAmount).times(0.22).toNumber();

    // Calculate first RMD deadline
    const firstRMDYear = calculation.birthYear + rmdAge;
    const firstRMDDeadline = currentAge === rmdAge 
      ? `April 1, ${firstRMDYear + 1}` 
      : `December 31, ${currentYear}`;

    // Generate 10-year projection
    const projections: Array<{ age: number; balance: number; rmd: number }> = [];
    let projectedBalance = calculation.accountBalance;
    const growthRate = 1.05; // Assume 5% growth

    for (let i = 0; i < 10; i++) {
      const projectedAge = currentAge + i;
      if (projectedAge >= rmdAge) {
        const projectedFactor = getDistributionFactor(
          projectedAge,
          calculation.spouseBeneficiary,
          calculation.spouseAge ? calculation.spouseAge + i : undefined
        );
        const projectedRMD = projectedBalance / projectedFactor;
        
        projections.push({
          age: projectedAge,
          balance: projectedBalance,
          rmd: projectedRMD
        });

        // Update balance for next year (growth minus RMD)
        projectedBalance = (projectedBalance - projectedRMD) * growthRate;
      }
    }

    setResults({
      rmdAmount,
      distributionFactor: factor,
      rmdAge,
      firstRMDDeadline,
      annualDeadline: 'December 31',
      penalty,
      taxEstimate,
      projections
    });
  }, [calculation, currentYear]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (region !== 'US') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">RMD Calculator (US Only)</h3>
        </div>
        <p className="text-gray-600">
          Required Minimum Distributions apply to US retirement accounts only.
          This calculator helps US residents calculate their annual RMDs from tax-deferred accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Required Minimum Distribution (RMD) Calculator</h3>
        <p className="text-sm text-gray-600">
          Calculate your annual RMD based on IRS rules and the Uniform Lifetime Table (2024 SECURE Act 2.0 rules).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Age
            </label>
            <input
              type="number"
              value={calculation.age}
              onChange={(e) => {
                const age = Number(e.target.value) || 0;
                setCalculation(prev => ({
                  ...prev,
                  age,
                  birthYear: currentYear - age
                }));
              }}
              min="50"
              max="120"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Balance (as of Dec 31 last year)
            </label>
            <input
              type="number"
              value={calculation.accountBalance}
              onChange={(e) => setCalculation(prev => ({
                ...prev,
                accountBalance: Number(e.target.value) || 0
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="500000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <select
              value={calculation.accountType}
              onChange={(e) => setCalculation(prev => ({
                ...prev,
                accountType: e.target.value as RMDCalculation['accountType']
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="traditionalIRA">Traditional IRA</option>
              <option value="401k">401(k)</option>
              <option value="403b">403(b)</option>
              <option value="457b">457(b)</option>
              <option value="sepIRA">SEP IRA</option>
              <option value="simpleIRA">SIMPLE IRA</option>
            </select>
          </div>

          {(calculation.accountType === '401k' || calculation.accountType === '403b') && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="stillWorking"
                checked={calculation.stillWorking}
                onChange={(e) => setCalculation(prev => ({
                  ...prev,
                  stillWorking: e.target.checked
                }))}
                className="h-4 w-4 text-gray-600"
              />
              <label htmlFor="stillWorking" className="text-sm font-medium text-gray-700">
                Still working for this employer (delays RMD)
              </label>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="spouseBeneficiary"
              checked={calculation.spouseBeneficiary}
              onChange={(e) => setCalculation(prev => ({
                ...prev,
                spouseBeneficiary: e.target.checked
              }))}
              className="h-4 w-4 text-gray-600"
            />
            <label htmlFor="spouseBeneficiary" className="text-sm font-medium text-gray-700">
              Spouse is sole beneficiary
            </label>
          </div>

          {calculation.spouseBeneficiary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spouse's Age
              </label>
              <input
                type="number"
                value={calculation.spouseAge || ''}
                onChange={(e) => setCalculation(prev => ({
                  ...prev,
                  spouseAge: Number(e.target.value) || undefined
                }))}
                min="20"
                max="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="Enter spouse's age"
              />
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {calculation.age < results.rmdAge ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">No RMD Required Yet</p>
                  <p className="text-sm text-green-700 mt-1">
                    You don't need to take RMDs until age {results.rmdAge}.
                    Your first RMD will be due by {results.firstRMDDeadline}.
                  </p>
                </div>
              </div>
            </div>
          ) : calculation.stillWorking && (calculation.accountType === '401k' || calculation.accountType === '403b') ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">RMD Delayed - Still Working</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Since you're still working for this employer, you can delay RMDs from this {calculation.accountType} 
                    until April 1st of the year after you retire.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-5 w-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-900">Your {currentYear} RMD</h4>
                </div>
                <div className="text-3xl font-bold text-gray-600 mb-2">
                  {formatCurrency(results.rmdAmount)}
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Distribution Factor:</span>
                    <span className="font-medium">{results.distributionFactor.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Calculation:</span>
                    <span className="font-medium">
                      {formatCurrency(calculation.accountBalance)} ÷ {results.distributionFactor.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-900">Deadline</span>
                  </div>
                  <p className="text-sm font-semibold text-amber-900">
                    {calculation.age === results.rmdAge ? results.firstRMDDeadline : results.annualDeadline}
                  </p>
                </div>

                <div className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-xs font-medium text-red-900">Penalty if Missed</span>
                  </div>
                  <p className="text-sm font-semibold text-red-900">
                    {formatCurrency(results.penalty)} (25%)
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-gray-600" />
                  <span className="text-xs font-medium text-gray-700">Estimated Tax (22% bracket)</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(results.taxEstimate)}
                </p>
              </div>
            </>
          )}

          {/* SECURE Act 2.0 Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">SECURE Act 2.0 Changes</h5>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• RMD age: 73 (born 1951-1959)</li>
              <li>• RMD age: 75 (born 1960 or later)</li>
              <li>• Penalty reduced to 25% (was 50%)</li>
              <li>• Penalty reduced to 10% if corrected within 2 years</li>
              <li>• No RMDs from Roth 401(k)s starting 2024</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 10-Year Projection Table */}
      {results.projections.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-gray-600" />
            10-Year RMD Projection (5% growth assumed)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-right py-2 px-3">Account Balance</th>
                  <th className="text-right py-2 px-3">Life Expectancy</th>
                  <th className="text-right py-2 px-3">RMD Amount</th>
                </tr>
              </thead>
              <tbody>
                {results.projections.map((projection, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{projection.age}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(projection.balance)}</td>
                    <td className="text-right py-2 px-3">
                      {getDistributionFactor(
                        projection.age,
                        calculation.spouseBeneficiary,
                        calculation.spouseAge ? calculation.spouseAge + index : undefined
                      ).toFixed(1)}
                    </td>
                    <td className="text-right py-2 px-3 font-medium">
                      {formatCurrency(projection.rmd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium mb-1">Important Disclaimer</p>
            <p>
              This calculator uses the IRS Uniform Lifetime Table and SECURE Act 2.0 rules for 2024. 
              Consult with a tax professional or financial advisor for personalized RMD calculations, 
              especially if you have multiple retirement accounts or complex beneficiary situations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
