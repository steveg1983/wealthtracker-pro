import React, { useState, useMemo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import Decimal from 'decimal.js';
import { 
  PiggyBankIcon,
  TrendingUpIcon,
  InfoIcon,
  CalculatorIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '../icons';

interface SIPPProjection {
  age: number;
  year: number;
  contribution: number;
  taxRelief: number;
  employerContribution: number;
  growth: number;
  balance: number;
  cumulativeContributions: number;
  cumulativeTaxRelief: number;
}

interface DrawdownStrategy {
  type: 'percentage' | 'fixed' | 'dynamic';
  value: number;
  preserveCapital: boolean;
}

export default function SIPPCalculator() {
  const { formatCurrency } = useRegionalCurrency();
  
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(60);
  const [currentBalance, setCurrentBalance] = useState(50000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [employerContribution, setEmployerContribution] = useState(300);
  const [annualGrowthRate, setAnnualGrowthRate] = useState(0.06);
  const [inflationRate, setInflationRate] = useState(0.025);
  const [taxBand, setTaxBand] = useState<'basic' | 'higher' | 'additional'>('basic');
  const [showProjection, setShowProjection] = useState(false);
  const [showDrawdown, setShowDrawdown] = useState(false);
  
  // Drawdown settings
  const [drawdownStrategy, setDrawdownStrategy] = useState<DrawdownStrategy>({
    type: 'percentage',
    value: 4,
    preserveCapital: false
  });
  const [drawdownAge, setDrawdownAge] = useState(55);
  const [targetIncome, setTargetIncome] = useState(30000);

  // UK tax relief rates
  const taxReliefRate = useMemo(() => {
    switch (taxBand) {
      case 'basic': return 0.20;
      case 'higher': return 0.40;
      case 'additional': return 0.45;
      default: return 0.20;
    }
  }, [taxBand]);

  // Annual allowance for 2024/25
  const annualAllowance = 60000;
  const lifetimeAllowance = 1073100; // Abolished but still relevant for some

  // Calculate SIPP projection
  const projection = useMemo(() => {
    const years = retirementAge - currentAge;
    if (years <= 0) return [];

    const projections: SIPPProjection[] = [];
    let balance = new Decimal(currentBalance);
    let cumulativeContributions = new Decimal(0);
    let cumulativeTaxRelief = new Decimal(0);

    for (let year = 1; year <= years; year++) {
      const age = currentAge + year;
      const yearlyContribution = new Decimal(monthlyContribution).times(12);
      const yearlyEmployerContribution = new Decimal(employerContribution).times(12);
      
      // Calculate tax relief (government adds this to your contribution)
      const grossContribution = yearlyContribution.div(1 - taxReliefRate);
      const taxRelief = grossContribution.minus(yearlyContribution);
      
      // Total annual contribution (capped at annual allowance)
      const totalContribution = Decimal.min(
        grossContribution.plus(yearlyEmployerContribution),
        annualAllowance
      );
      
      // Apply growth
      const growth = balance.times(annualGrowthRate);
      balance = balance.plus(totalContribution).plus(growth);
      
      cumulativeContributions = cumulativeContributions.plus(yearlyContribution).plus(yearlyEmployerContribution);
      cumulativeTaxRelief = cumulativeTaxRelief.plus(taxRelief);
      
      projections.push({
        age,
        year: new Date().getFullYear() + year,
        contribution: yearlyContribution.toNumber(),
        taxRelief: taxRelief.toNumber(),
        employerContribution: yearlyEmployerContribution.toNumber(),
        growth: growth.toNumber(),
        balance: balance.toNumber(),
        cumulativeContributions: cumulativeContributions.toNumber(),
        cumulativeTaxRelief: cumulativeTaxRelief.toNumber()
      });
    }

    return projections;
  }, [currentAge, retirementAge, currentBalance, monthlyContribution, employerContribution, annualGrowthRate, taxReliefRate]);

  const finalBalance = projection.length > 0 ? projection[projection.length - 1]?.balance || currentBalance : currentBalance;
  const totalTaxRelief = projection.length > 0 ? projection[projection.length - 1]?.cumulativeTaxRelief || 0 : 0;
  
  // Calculate drawdown scenarios
  const drawdownScenarios = useMemo(() => {
    if (finalBalance <= 0) return null;

    const scenarios = [];
    const rates = [3, 4, 5, 6];
    
    for (const rate of rates) {
      const annualDrawdown = finalBalance * (rate / 100);
      const monthlyIncome = annualDrawdown / 12;
      const yearsItWillLast = rate === 0 ? Infinity : finalBalance / annualDrawdown;
      
      scenarios.push({
        rate,
        annualDrawdown,
        monthlyIncome,
        yearsItWillLast,
        sustainableToAge: drawdownAge + Math.floor(yearsItWillLast)
      });
    }
    
    return scenarios;
  }, [finalBalance, drawdownAge]);

  // Calculate 25% tax-free lump sum
  const taxFreeLumpSum = finalBalance * 0.25;
  const remainingForDrawdown = finalBalance * 0.75;

  // Minimum pension age check
  const minimumPensionAge = 55; // Rising to 57 in 2028
  const canAccessNow = currentAge >= minimumPensionAge;
  const yearsUntilAccess = Math.max(0, minimumPensionAge - currentAge);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Personal Pension (SIPP) Calculator
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Project your Self-Invested Personal Pension growth with UK tax relief
        </p>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Age
          </label>
          <input
            type="number"
            value={currentAge}
            onChange={(e) => setCurrentAge(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="18"
            max="75"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Retirement Age
          </label>
          <input
            type="number"
            value={retirementAge}
            onChange={(e) => setRetirementAge(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="55"
            max="75"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current SIPP Balance
          </label>
          <input
            type="number"
            value={currentBalance || ''}
            onChange={(e) => setCurrentBalance(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Monthly Contribution
          </label>
          <input
            type="number"
            value={monthlyContribution || ''}
            onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Employer Contribution
          </label>
          <input
            type="number"
            value={employerContribution || ''}
            onChange={(e) => setEmployerContribution(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax Band
          </label>
          <select
            value={taxBand}
            onChange={(e) => setTaxBand(e.target.value as 'basic' | 'higher' | 'additional')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="basic">Basic Rate (20%)</option>
            <option value="higher">Higher Rate (40%)</option>
            <option value="additional">Additional Rate (45%)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Expected Annual Growth
          </label>
          <input
            type="number"
            value={(annualGrowthRate * 100).toFixed(1)}
            onChange={(e) => setAnnualGrowthRate(parseFloat(e.target.value) / 100 || 0)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            step="0.1"
            min="0"
            max="15"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBankIcon size={16} className="text-gray-600 dark:text-gray-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Projected Balance</p>
          </div>
          <p className="text-xl font-bold text-gray-600 dark:text-gray-500">
            {formatCurrency(finalBalance)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            At age {retirementAge}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUpIcon size={16} className="text-green-600 dark:text-green-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Tax Relief</p>
          </div>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalTaxRelief)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {(taxReliefRate * 100).toFixed(0)}% relief on contributions
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalculatorIcon size={16} className="text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">25% Tax-Free</p>
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(taxFreeLumpSum)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Available from age {minimumPensionAge}
          </p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <InfoIcon size={16} className="text-orange-600 dark:text-orange-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Income (4%)</p>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency((finalBalance * 0.04) / 12)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Sustainable withdrawal
          </p>
        </div>
      </div>

      {/* Access Age Warning */}
      {!canAccessNow && yearsUntilAccess > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Pension Access Age
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                You can access your pension from age {minimumPensionAge}. You have {yearsUntilAccess} years until you can access your SIPP.
                Note: The minimum pension age will increase to 57 in 2028.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Annual Allowance Check */}
      {(monthlyContribution * 12 + employerContribution * 12) > annualAllowance && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Annual Allowance Exceeded
              </p>
              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                Your total annual contributions exceed the {formatCurrency(annualAllowance)} annual allowance.
                Contributions above this limit won't receive tax relief and may incur charges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projection Table */}
      <div className="mb-6">
        <button
          onClick={() => setShowProjection(!showProjection)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-3"
        >
          <TrendingUpIcon size={14} />
          {showProjection ? 'Hide' : 'Show'} Year-by-Year Projection
          {showProjection ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </button>

        {showProjection && projection.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-2">Age</th>
                  <th className="text-right py-2">Your Contribution</th>
                  <th className="text-right py-2">Tax Relief</th>
                  <th className="text-right py-2">Employer</th>
                  <th className="text-right py-2">Growth</th>
                  <th className="text-right py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {projection.slice(0, 10).map((year) => (
                  <tr key={year.age} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2">{year.age}</td>
                    <td className="text-right py-2">{formatCurrency(year.contribution)}</td>
                    <td className="text-right py-2 text-green-600 dark:text-green-400">
                      +{formatCurrency(year.taxRelief)}
                    </td>
                    <td className="text-right py-2 text-gray-600 dark:text-gray-500">
                      +{formatCurrency(year.employerContribution)}
                    </td>
                    <td className="text-right py-2 text-purple-600 dark:text-purple-400">
                      +{formatCurrency(year.growth)}
                    </td>
                    <td className="text-right py-2 font-semibold">
                      {formatCurrency(year.balance)}
                    </td>
                  </tr>
                ))}
                {projection.length > 10 && (
                  <tr>
                    <td colSpan={6} className="text-center py-2 text-gray-500 dark:text-gray-400">
                      ... and {projection.length - 10} more years
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawdown Scenarios */}
      <div>
        <button
          onClick={() => setShowDrawdown(!showDrawdown)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-3"
        >
          <CalculatorIcon size={14} />
          {showDrawdown ? 'Hide' : 'Show'} Drawdown Scenarios
          {showDrawdown ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </button>

        {showDrawdown && drawdownScenarios && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Pension Drawdown Options (After 25% Tax-Free Lump Sum)
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Remaining for drawdown: {formatCurrency(remainingForDrawdown)}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drawdownScenarios.map((scenario) => (
                <div
                  key={scenario.rate}
                  className={`p-3 rounded-lg border ${
                    scenario.rate === 4
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {scenario.rate}% Withdrawal Rate
                    </span>
                    {scenario.rate === 4 && (
                      <span className="text-xs text-green-600 dark:text-green-400">Recommended</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Annual Income:</span>
                      <span className="font-medium">{formatCurrency(scenario.annualDrawdown)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Monthly Income:</span>
                      <span className="font-medium">{formatCurrency(scenario.monthlyIncome)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Lasts Until:</span>
                      <span className="font-medium">
                        Age {scenario.sustainableToAge > 100 ? '100+' : scenario.sustainableToAge}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
              <div className="flex gap-2">
                <InfoIcon size={14} className="text-gray-600 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">Drawdown Tax Implications:</p>
                  <ul className="space-y-0.5">
                    <li>• 25% can be taken tax-free as a lump sum</li>
                    <li>• Remaining 75% is taxed as income when withdrawn</li>
                    <li>• Consider your tax band when planning withdrawals</li>
                    <li>• Unused funds can be passed on inheritance tax-free</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}