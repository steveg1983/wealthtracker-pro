import React, { useState, useEffect } from 'react';
import { 
  AlertCircleIcon as AlertCircle,
  HeartIcon as Heart,
  PillIcon as Pill,
  EyeIcon as Eye,
  ShieldIcon as Shield,
  DollarSignIcon as DollarSign,
  InfoIcon as Info
} from '../icons';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';
import Decimal from 'decimal.js';

interface MedicarePlan {
  partA: {
    premium: number;
    deductible: number;
    coverage: number; // 0 = none, 30 = 30-39 quarters, 40 = 40+ quarters
  };
  partB: {
    enrolled: boolean;
    income: number;
    filingStatus: 'single' | 'married_joint' | 'married_separate';
  };
  partD: {
    enrolled: boolean;
    planCost: number;
    income: number;
  };
  supplemental: {
    type: 'none' | 'medigap' | 'advantage';
    planCost: number;
  };
}

// 2024 Medicare Part A costs from CMS
const PART_A_2024 = {
  deductible: 1632,
  premiums: {
    0: 505,     // less than 30 quarters
    30: 278,    // 30-39 quarters  
    40: 0       // 40+ quarters (most people)
  },
  coinsurance: {
    days_61_90: 408,
    lifetime_reserve: 816,
    snf_21_100: 204
  }
};

// 2024 Medicare Part B costs from CMS
const PART_B_2024 = {
  standard_premium: 174.70,
  deductible: 240,
  irmaa_brackets: {
    single: [
      { min: 0, max: 103000, premium: 174.70 },
      { min: 103000, max: 129000, premium: 244.60 },
      { min: 129000, max: 161000, premium: 349.40 },
      { min: 161000, max: 193000, premium: 454.20 },
      { min: 193000, max: 500000, premium: 559.00 },
      { min: 500000, max: Infinity, premium: 594.00 }
    ],
    married_joint: [
      { min: 0, max: 206000, premium: 174.70 },
      { min: 206000, max: 258000, premium: 244.60 },
      { min: 258000, max: 322000, premium: 349.40 },
      { min: 322000, max: 386000, premium: 454.20 },
      { min: 386000, max: 750000, premium: 559.00 },
      { min: 750000, max: Infinity, premium: 594.00 }
    ],
    married_separate: [
      { min: 0, max: 103000, premium: 174.70 },
      { min: 103000, max: 397000, premium: 559.00 },
      { min: 397000, max: Infinity, premium: 594.00 }
    ]
  }
};

// 2024 Medicare Part D costs from CMS
const PART_D_2024 = {
  average_premium: 55.50,
  irmaa_brackets: {
    single: [
      { min: 0, max: 103000, adjustment: 0 },
      { min: 103000, max: 129000, adjustment: 12.90 },
      { min: 129000, max: 161000, adjustment: 33.30 },
      { min: 161000, max: 193000, adjustment: 53.80 },
      { min: 193000, max: 500000, adjustment: 74.20 },
      { min: 500000, max: Infinity, adjustment: 81.00 }
    ],
    married_joint: [
      { min: 0, max: 206000, adjustment: 0 },
      { min: 206000, max: 258000, adjustment: 12.90 },
      { min: 258000, max: 322000, adjustment: 33.30 },
      { min: 322000, max: 386000, adjustment: 53.80 },
      { min: 386000, max: 750000, adjustment: 74.20 },
      { min: 750000, max: Infinity, adjustment: 81.00 }
    ],
    married_separate: [
      { min: 0, max: 103000, adjustment: 0 },
      { min: 103000, max: 397000, adjustment: 74.20 },
      { min: 397000, max: Infinity, adjustment: 81.00 }
    ]
  }
};

export default function MedicarePlanningCalculator(): React.JSX.Element {
  const { region } = useRegionalSettings();
  const [plan, setPlan] = useState<MedicarePlan>({
    partA: {
      premium: 0,
      deductible: PART_A_2024.deductible,
      coverage: 40
    },
    partB: {
      enrolled: true,
      income: 50000,
      filingStatus: 'single'
    },
    partD: {
      enrolled: true,
      planCost: PART_D_2024.average_premium,
      income: 50000
    },
    supplemental: {
      type: 'medigap',
      planCost: 150
    }
  });

  const [costs, setCosts] = useState({
    partA: 0,
    partB: 0,
    partD: 0,
    supplemental: 0,
    total: 0,
    annual: 0
  });

  // Calculate Part B premium based on income
  const calculatePartBPremium = (income: number, filingStatus: string): number => {
    const brackets = PART_B_2024.irmaa_brackets[filingStatus as keyof typeof PART_B_2024.irmaa_brackets];
    const bracket = brackets.find(b => income >= b.min && income < b.max);
    return bracket ? bracket.premium : PART_B_2024.standard_premium;
  };

  // Calculate Part D adjustment based on income
  const calculatePartDAdjustment = (income: number, filingStatus: string): number => {
    const brackets = PART_D_2024.irmaa_brackets[filingStatus as keyof typeof PART_D_2024.irmaa_brackets];
    const bracket = brackets.find(b => income >= b.min && income < b.max);
    return bracket ? bracket.adjustment : 0;
  };

  // Calculate all costs
  useEffect(() => {
    const partAPremium = PART_A_2024.premiums[plan.partA.coverage as keyof typeof PART_A_2024.premiums] || 0;
    const partBPremium = plan.partB.enrolled ? calculatePartBPremium(plan.partB.income, plan.partB.filingStatus) : 0;
    const partDAdjustment = plan.partD.enrolled ? calculatePartDAdjustment(plan.partB.income, plan.partB.filingStatus) : 0;
    const partDTotal = plan.partD.enrolled ? plan.partD.planCost + partDAdjustment : 0;
    const supplementalCost = plan.supplemental.type !== 'none' ? plan.supplemental.planCost : 0;

    const monthlyTotal = new Decimal(partAPremium)
      .plus(partBPremium)
      .plus(partDTotal)
      .plus(supplementalCost)
      .toNumber();

    setCosts({
      partA: partAPremium,
      partB: partBPremium,
      partD: partDTotal,
      supplemental: supplementalCost,
      total: monthlyTotal,
      annual: monthlyTotal * 12
    });
  }, [plan]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (region !== 'US') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Medicare Planning (US Only)</h3>
        </div>
        <p className="text-gray-600">
          Medicare planning is only available for US users. This calculator helps US residents
          aged 65+ plan their Medicare coverage and costs.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Medicare Planning Calculator</h3>
        <p className="text-sm text-gray-600">
          Plan your Medicare coverage and estimate costs for 2024. Includes Parts A, B, D, and supplemental options.
        </p>
      </div>

      <div className="space-y-6">
        {/* Part A - Hospital Insurance */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-red-500" />
            <h4 className="font-medium text-gray-900">Part A - Hospital Insurance</h4>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work History (Quarters of Coverage)
              </label>
              <select
                value={plan.partA.coverage}
                onChange={(e) => setPlan(prev => ({
                  ...prev,
                  partA: { ...prev.partA, coverage: Number(e.target.value) }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={40}>40+ quarters (Premium-free)</option>
                <option value={30}>30-39 quarters ({formatCurrency(PART_A_2024.premiums[30])}/month)</option>
                <option value={0}>Less than 30 quarters ({formatCurrency(PART_A_2024.premiums[0])}/month)</option>
              </select>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p>Part A Deductible: {formatCurrency(PART_A_2024.deductible)} per benefit period</p>
                  <p className="mt-1">Coinsurance: Days 61-90: {formatCurrency(PART_A_2024.coinsurance.days_61_90)}/day</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Part B - Medical Insurance */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-blue-500" />
            <h4 className="font-medium text-gray-900">Part B - Medical Insurance</h4>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="partB"
                checked={plan.partB.enrolled}
                onChange={(e) => setPlan(prev => ({
                  ...prev,
                  partB: { ...prev.partB, enrolled: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="partB" className="text-sm font-medium text-gray-700">
                Enroll in Part B
              </label>
            </div>

            {plan.partB.enrolled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modified Adjusted Gross Income (MAGI)
                  </label>
                  <input
                    type="number"
                    value={plan.partB.income}
                    onChange={(e) => {
                      const income = Number(e.target.value) || 0;
                      setPlan(prev => ({
                        ...prev,
                        partB: { ...prev.partB, income },
                        partD: { ...prev.partD, income }
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Filing Status
                  </label>
                  <select
                    value={plan.partB.filingStatus}
                    onChange={(e) => setPlan(prev => ({
                      ...prev,
                      partB: { ...prev.partB, filingStatus: e.target.value as any }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="single">Single</option>
                    <option value="married_joint">Married Filing Jointly</option>
                    <option value="married_separate">Married Filing Separately</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p>Part B Deductible: {formatCurrency(PART_B_2024.deductible)}/year</p>
                      <p className="mt-1">Standard Premium: {formatCurrency(PART_B_2024.standard_premium)}/month</p>
                      {costs.partB > PART_B_2024.standard_premium && (
                        <p className="mt-1 font-medium">IRMAA applies due to income level</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Part D - Prescription Drug Coverage */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="h-5 w-5 text-green-500" />
            <h4 className="font-medium text-gray-900">Part D - Prescription Drug Coverage</h4>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="partD"
                checked={plan.partD.enrolled}
                onChange={(e) => setPlan(prev => ({
                  ...prev,
                  partD: { ...prev.partD, enrolled: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600"
              />
              <label htmlFor="partD" className="text-sm font-medium text-gray-700">
                Enroll in Part D
              </label>
            </div>

            {plan.partD.enrolled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Premium (Monthly)
                  </label>
                  <input
                    type="number"
                    value={plan.partD.planCost}
                    onChange={(e) => setPlan(prev => ({
                      ...prev,
                      partD: { ...prev.partD, planCost: Number(e.target.value) || 0 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    2024 average: {formatCurrency(PART_D_2024.average_premium)}/month
                  </p>
                </div>

                <div className="bg-green-50 p-3 rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="text-sm text-green-900">
                      <p className="font-medium">2024 Improvements:</p>
                      <ul className="mt-1 space-y-1">
                        <li>• Insulin capped at $35/month</li>
                        <li>• No cost for recommended vaccines</li>
                        <li>• Expanded Extra Help eligibility</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Supplemental Coverage */}
        <div className="border-b pb-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-purple-500" />
            <h4 className="font-medium text-gray-900">Supplemental Coverage</h4>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage Type
              </label>
              <select
                value={plan.supplemental.type}
                onChange={(e) => setPlan(prev => ({
                  ...prev,
                  supplemental: { ...prev.supplemental, type: e.target.value as any }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No Supplemental Coverage</option>
                <option value="medigap">Medigap (Medicare Supplement)</option>
                <option value="advantage">Medicare Advantage (Part C)</option>
              </select>
            </div>

            {plan.supplemental.type !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Premium
                </label>
                <input
                  type="number"
                  value={plan.supplemental.planCost}
                  onChange={(e) => setPlan(prev => ({
                    ...prev,
                    supplemental: { ...prev.supplemental, planCost: Number(e.target.value) || 0 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {plan.supplemental.type === 'medigap' 
                    ? 'Typical range: $100-$300/month'
                    : 'May include Part D coverage'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <h4 className="text-lg font-semibold text-gray-900">Estimated Medicare Costs</h4>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-blue-100">
              <span className="text-gray-700">Part A (Hospital)</span>
              <span className="font-medium text-gray-900">{formatCurrency(costs.partA)}/month</span>
            </div>
            
            {plan.partB.enrolled && (
              <div className="flex justify-between items-center py-2 border-b border-blue-100">
                <span className="text-gray-700">Part B (Medical)</span>
                <span className="font-medium text-gray-900">{formatCurrency(costs.partB)}/month</span>
              </div>
            )}
            
            {plan.partD.enrolled && (
              <div className="flex justify-between items-center py-2 border-b border-blue-100">
                <span className="text-gray-700">Part D (Prescription)</span>
                <span className="font-medium text-gray-900">{formatCurrency(costs.partD)}/month</span>
              </div>
            )}
            
            {plan.supplemental.type !== 'none' && (
              <div className="flex justify-between items-center py-2 border-b border-blue-100">
                <span className="text-gray-700">
                  {plan.supplemental.type === 'medigap' ? 'Medigap' : 'Medicare Advantage'}
                </span>
                <span className="font-medium text-gray-900">{formatCurrency(costs.supplemental)}/month</span>
              </div>
            )}

            <div className="pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total Monthly</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(costs.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total Annual</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(costs.annual)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white rounded-md">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> These are estimated costs based on 2024 Medicare rates. 
              Actual costs may vary based on your specific plan choices, health needs, and location. 
              This calculator does not include out-of-pocket costs like deductibles, copayments, or coinsurance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
