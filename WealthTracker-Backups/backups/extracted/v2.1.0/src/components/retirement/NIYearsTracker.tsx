import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, AlertCircle, Info, TrendingUp, PoundSterling } from 'lucide-react';
import { useRegionalSettings } from '../../hooks/useRegionalSettings';
import Decimal from 'decimal.js';

interface NIYear {
  year: string;
  status: 'paid' | 'credited' | 'gap' | 'future';
  contractedOut?: boolean;
}

interface NITrackerData {
  birthYear: number;
  currentAge: number;
  workStartYear: number;
  statePensionAge: number;
  years: NIYear[];
  voluntaryContributions: {
    yearsToBuy: string[];
    currentCost: number; // Cost per year for voluntary contributions
  };
}

// State Pension ages based on birth date (simplified)
const getStatePensionAge = (birthYear: number, gender: 'male' | 'female'): number => {
  // Post-2020 rules (equalised for men and women)
  if (birthYear >= 1977) return 68;
  if (birthYear >= 1961) return 67;
  if (birthYear >= 1960) return 66;
  
  // Historical differences (simplified)
  if (gender === 'female' && birthYear < 1950) return 60;
  if (gender === 'male' && birthYear < 1954) return 65;
  
  // Transition period
  return 66;
};

// 2024-25 State Pension rates
const STATE_PENSION_2024 = {
  fullWeekly: 221.20,  // £221.20 per week for 2024-25
  fullAnnual: 11502.40, // £11,502.40 per year
  minYearsForAny: 10,
  fullYears: 35,
  voluntaryContributionCost: 907.40 // £17.45 per week × 52 weeks for 2024-25
};

export default function NIYearsTracker(): React.JSX.Element {
  const { region } = useRegionalSettings();
  const currentYear = new Date().getFullYear();
  const currentTaxYear = `${currentYear}-${(currentYear + 1).toString().slice(2)}`;
  
  const [trackerData, setTrackerData] = useState<NITrackerData>({
    birthYear: 1970,
    currentAge: currentYear - 1970,
    workStartYear: 1988,
    statePensionAge: 67,
    years: [],
    voluntaryContributions: {
      yearsToBuy: [],
      currentCost: STATE_PENSION_2024.voluntaryContributionCost
    }
  });

  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [results, setResults] = useState({
    qualifyingYears: 0,
    gapYears: 0,
    projectedYears: 0,
    totalExpectedYears: 0,
    weeklyPension: 0,
    annualPension: 0,
    percentageOfFull: 0,
    canBuyYears: [] as string[],
    costToBuyGaps: 0,
    additionalPensionFromBuying: 0
  });

  // Initialize NI years based on work history
  useEffect(() => {
    const startYear = trackerData.workStartYear;
    const endYear = currentYear;
    const years: NIYear[] = [];
    
    // Generate year records
    for (let year = startYear; year <= endYear + 5; year++) {
      const taxYear = `${year}-${(year + 1).toString().slice(2)}`;
      
      if (year <= currentYear) {
        // Past and current years - assume paid unless it's a gap
        // In real app, user would input actual data
        const isGap = Math.random() < 0.1; // 10% chance of gap for demo
        years.push({
          year: taxYear,
          status: isGap ? 'gap' : 'paid',
          contractedOut: year < 2016 && Math.random() < 0.3 // 30% contracted out pre-2016
        });
      } else {
        // Future years
        years.push({
          year: taxYear,
          status: 'future'
        });
      }
    }

    const spAge = getStatePensionAge(trackerData.birthYear, gender);
    
    setTrackerData(prev => ({
      ...prev,
      years,
      statePensionAge: spAge,
      currentAge: currentYear - trackerData.birthYear
    }));
  }, [trackerData.birthYear, trackerData.workStartYear, currentYear, gender]);

  // Calculate results
  useEffect(() => {
    const qualifyingYears = trackerData.years.filter(y => 
      y.status === 'paid' || y.status === 'credited'
    ).length;
    
    const gapYears = trackerData.years.filter(y => y.status === 'gap').length;
    
    const yearsUntilPension = trackerData.statePensionAge - trackerData.currentAge;
    const projectedFutureYears = Math.max(0, Math.min(yearsUntilPension, 
      trackerData.years.filter(y => y.status === 'future').length));
    
    const totalExpectedYears = qualifyingYears + projectedFutureYears;
    
    // Calculate pension amount
    let effectiveYears = Math.min(totalExpectedYears, STATE_PENSION_2024.fullYears);
    
    // Adjust for contracting out (simplified - actual calculation is complex)
    const contractedOutYears = trackerData.years.filter(y => y.contractedOut).length;
    if (contractedOutYears > 0) {
      effectiveYears = Math.max(0, effectiveYears - (contractedOutYears * 0.2)); // Rough adjustment
    }
    
    const weeklyPension = totalExpectedYears < STATE_PENSION_2024.minYearsForAny 
      ? 0 
      : (STATE_PENSION_2024.fullWeekly / STATE_PENSION_2024.fullYears) * effectiveYears;
    
    const annualPension = weeklyPension * 52;
    const percentageOfFull = (weeklyPension / STATE_PENSION_2024.fullWeekly) * 100;
    
    // Identify years that can be bought (last 6 years only)
    const sixYearsAgo = currentYear - 6;
    const canBuyYears = trackerData.years
      .filter(y => {
        const yearNum = parseInt(y.year.split('-')[0]);
        return y.status === 'gap' && yearNum >= sixYearsAgo && yearNum <= currentYear;
      })
      .map(y => y.year);
    
    const costToBuyGaps = canBuyYears.length * STATE_PENSION_2024.voluntaryContributionCost;
    
    // Calculate additional pension from buying gap years
    const newTotalYears = Math.min(
      qualifyingYears + canBuyYears.length + projectedFutureYears,
      STATE_PENSION_2024.fullYears
    );
    const newWeeklyPension = (STATE_PENSION_2024.fullWeekly / STATE_PENSION_2024.fullYears) * newTotalYears;
    const additionalWeekly = newWeeklyPension - weeklyPension;
    const additionalAnnual = additionalWeekly * 52;
    
    setResults({
      qualifyingYears,
      gapYears,
      projectedYears: projectedFutureYears,
      totalExpectedYears,
      weeklyPension,
      annualPension,
      percentageOfFull,
      canBuyYears,
      costToBuyGaps,
      additionalPensionFromBuying: additionalAnnual
    });
  }, [trackerData, currentYear]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (region !== 'UK') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <h3 className="text-lg font-semibold">NI Years Tracker (UK Only)</h3>
        </div>
        <p className="text-gray-600">
          National Insurance years tracking is only available for UK users. This tool helps
          UK residents track their qualifying years for State Pension eligibility.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">National Insurance Years Tracker</h3>
        <p className="text-sm text-gray-600">
          Track your NI qualifying years and estimate your State Pension. You need 35 years for the full 
          pension (£{STATE_PENSION_2024.fullWeekly}/week) and at least 10 years to get any State Pension.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Birth Year
            </label>
            <input
              type="number"
              value={trackerData.birthYear}
              onChange={(e) => setTrackerData(prev => ({
                ...prev,
                birthYear: Number(e.target.value) || 1970,
                currentAge: currentYear - (Number(e.target.value) || 1970)
              }))}
              min="1940"
              max="2010"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender (for State Pension age)
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year Started Working
            </label>
            <input
              type="number"
              value={trackerData.workStartYear}
              onChange={(e) => setTrackerData(prev => ({
                ...prev,
                workStartYear: Number(e.target.value) || 1988
              }))}
              min="1940"
              max={currentYear}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Your State Pension Age: {trackerData.statePensionAge}</p>
                <p>You have {trackerData.statePensionAge - trackerData.currentAge} years until State Pension age.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-gray-900">Your NI Record Summary</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-600">Qualifying Years</p>
                <p className="text-2xl font-bold text-green-600">{results.qualifyingYears}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Gap Years</p>
                <p className="text-2xl font-bold text-red-600">{results.gapYears}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Projected future years:</span>
                <span className="font-medium">+{results.projectedYears}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total expected years:</span>
                <span className={results.totalExpectedYears >= 35 ? 'text-green-600' : 'text-amber-600'}>
                  {results.totalExpectedYears}/35
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <PoundSterling className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Estimated State Pension</h4>
            </div>
            
            {results.totalExpectedYears < STATE_PENSION_2024.minYearsForAny ? (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-900">
                  You need at least 10 qualifying years to get any State Pension.
                  Currently expecting only {results.totalExpectedYears} years.
                </p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {formatCurrency(results.weeklyPension)}/week
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Annual amount:</span>
                    <span className="font-medium">{formatCurrency(results.annualPension)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Percentage of full pension:</span>
                    <span className="font-medium">{results.percentageOfFull.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="mt-3 bg-white rounded p-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, results.percentageOfFull)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Progress to full pension (35 years)
                  </p>
                </div>
              </>
            )}
          </div>

          {results.canBuyYears.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-medium text-amber-900 mb-2">Voluntary Contributions Available</h5>
                  <div className="text-sm text-amber-800 space-y-2">
                    <p>You can buy {results.canBuyYears.length} gap year(s):</p>
                    <ul className="list-disc list-inside space-y-1">
                      {results.canBuyYears.map(year => (
                        <li key={year}>{year}</li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-amber-300">
                      <div className="flex justify-between mb-1">
                        <span>Cost to buy all gaps:</span>
                        <span className="font-medium">{formatCurrency(results.costToBuyGaps)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Additional pension:</span>
                        <span className="font-medium text-green-700">
                          +{formatCurrency(results.additionalPensionFromBuying)}/year
                        </span>
                      </div>
                      <p className="text-xs mt-2 text-amber-700">
                        Payback period: {(results.costToBuyGaps / results.additionalPensionFromBuying).toFixed(1)} years
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NI Years Table */}
      <div className="mt-6">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          National Insurance Record (Recent Years)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-2 px-3">Tax Year</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Contracted Out</th>
                <th className="text-left py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {trackerData.years.slice(-10).reverse().map((year, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{year.year}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      year.status === 'paid' ? 'bg-green-100 text-green-800' :
                      year.status === 'credited' ? 'bg-blue-100 text-blue-800' :
                      year.status === 'gap' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {year.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                      {year.status === 'gap' && <XCircle className="h-3 w-3" />}
                      {year.status.charAt(0).toUpperCase() + year.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {year.contractedOut ? 
                      <span className="text-amber-600">Yes</span> : 
                      <span className="text-gray-400">No</span>
                    }
                  </td>
                  <td className="py-2 px-3">
                    {year.status === 'gap' && results.canBuyYears.includes(year.year) && (
                      <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Buy this year
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Important Information</p>
            <ul className="space-y-1">
              <li>• Check your actual NI record at <a href="https://www.gov.uk/check-national-insurance-record" className="underline">gov.uk/check-national-insurance-record</a></li>
              <li>• You can usually buy gaps from the last 6 years</li>
              <li>• Special deadline: You can buy gaps back to 2006 until 5 April 2025</li>
              <li>• Contracted out years may reduce your State Pension</li>
              <li>• This is an estimate - get a forecast at <a href="https://www.gov.uk/check-state-pension" className="underline">gov.uk/check-state-pension</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}