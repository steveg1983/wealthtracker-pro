/**
 * StatePensionCalculator Component - UK State Pension calculation and forecasting
 *
 * Features:
 * - State Pension entitlement calculation
 * - National Insurance record analysis
 * - Qualifying years tracking
 * - Future projections
 * - Gap analysis and recommendations
 */

import React, { useState, useEffect } from 'react';
import { lazyLogger } from '../../services/serviceFactory';

const logger = lazyLogger.getLogger('StatePensionCalculator');

export interface StatePensionData {
  date_of_birth: string;
  ni_number?: string;
  qualifying_years: number;
  total_ni_years: number;
  gaps_in_record: number;
  state_pension_age: number;
  weekly_entitlement: number;
  annual_entitlement: number;
  full_pension_amount: number;
  years_to_retirement: number;
  can_fill_gaps: boolean;
  gap_filling_cost: number;
}

export interface NIRecord {
  year: string;
  status: 'qualifying' | 'non_qualifying' | 'credited' | 'gap';
  contributions: number;
  earnings?: number;
  type: 'employed' | 'self_employed' | 'voluntary' | 'credited' | 'none';
}

export interface GapFillingOption {
  year: string;
  cost: number;
  deadline: string;
  benefit: number;
  recommended: boolean;
  reason: string;
}

interface StatePensionCalculatorProps {
  onCalculationComplete?: (data: StatePensionData) => void;
  className?: string;
}

// UK State Pension constants (2024/25 rates)
const FULL_STATE_PENSION_WEEKLY = 221.20; // £221.20 per week
const FULL_STATE_PENSION_ANNUAL = FULL_STATE_PENSION_WEEKLY * 52;
const QUALIFYING_YEARS_REQUIRED = 35;
const MINIMUM_QUALIFYING_YEARS = 10;

export function StatePensionCalculator({
  onCalculationComplete,
  className = ''
}: StatePensionCalculatorProps): React.JSX.Element {
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female',
    qualifyingYears: 0,
    totalNIYears: 0,
    gapsInRecord: 0
  });

  const [calculation, setCalculation] = useState<StatePensionData | null>(null);
  const [niRecord, setNIRecord] = useState<NIRecord[]>([]);
  const [gapFillingOptions, setGapFillingOptions] = useState<GapFillingOption[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (formData.dateOfBirth) {
      generateMockNIRecord();
    }
  }, [formData.dateOfBirth]);

  const calculateStatePensionAge = (dateOfBirth: string, gender: 'male' | 'female'): number => {
    const birthDate = new Date(dateOfBirth);
    const birthYear = birthDate.getFullYear();
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    // Simplified UK State Pension age calculation
    if (birthYear < 1950) return 65; // Legacy rules

    // Current rules (simplified)
    if (birthYear < 1960) {
      // Gradual increase from 65 to 66
      if (gender === 'female') {
        if (birthYear < 1954) return 60; // Old female pension age
        return 65; // Equalized age
      }
      return 65;
    }

    if (birthYear < 1977) return 66;
    if (birthYear < 1978) return 67;

    return 68; // Future projections
  };

  const generateMockNIRecord = (): void => {
    const birthYear = new Date(formData.dateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    const startWorkingYear = Math.max(birthYear + 16, 1975); // Minimum working age and NI system start

    const record: NIRecord[] = [];
    let qualifyingYears = 0;
    let gaps = 0;

    for (let year = startWorkingYear; year <= currentYear; year++) {
      const ageInYear = year - birthYear;
      let status: NIRecord['status'] = 'qualifying';
      let type: NIRecord['type'] = 'employed';

      // Simulate life events affecting NI record
      if (ageInYear < 16) continue;

      // Education years (16-21) - mix of gaps and credits
      if (ageInYear <= 21 && Math.random() < 0.3) {
        status = 'credited';
        type = 'credited';
      }

      // Career breaks, unemployment, etc.
      if (ageInYear > 25 && ageInYear < 60 && Math.random() < 0.1) {
        status = 'gap';
        type = 'none';
        gaps++;
      }

      // Self-employment periods
      if (ageInYear > 30 && ageInYear < 50 && Math.random() < 0.2) {
        type = 'self_employed';
      }

      if (status === 'qualifying' || status === 'credited') {
        qualifyingYears++;
      }

      record.push({
        year: `${year}/${year + 1}`,
        status,
        contributions: status === 'qualifying' ? Math.floor(Math.random() * 5000) + 3000 : 0,
        earnings: status === 'qualifying' ? Math.floor(Math.random() * 30000) + 20000 : undefined,
        type
      });
    }

    setNIRecord(record);
    setFormData(prev => ({
      ...prev,
      qualifyingYears,
      totalNIYears: record.length,
      gapsInRecord: gaps
    }));
  };

  const calculateStatePension = (): void => {
    if (!formData.dateOfBirth) {
      setErrors({ dateOfBirth: 'Date of birth is required' });
      return;
    }

    setIsCalculating(true);
    setErrors({});

    try {
      const statePensionAge = calculateStatePensionAge(formData.dateOfBirth, formData.gender);
      const birthDate = new Date(formData.dateOfBirth);
      const pensionDate = new Date(birthDate);
      pensionDate.setFullYear(pensionDate.getFullYear() + statePensionAge);

      const yearsToRetirement = Math.max(0, (pensionDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));

      // Calculate entitlement based on qualifying years
      let weeklyEntitlement = 0;
      if (formData.qualifyingYears >= MINIMUM_QUALIFYING_YEARS) {
        const entitlementRatio = Math.min(formData.qualifyingYears / QUALIFYING_YEARS_REQUIRED, 1);
        weeklyEntitlement = FULL_STATE_PENSION_WEEKLY * entitlementRatio;
      }

      // Generate gap filling options
      const gapOptions = generateGapFillingOptions();
      setGapFillingOptions(gapOptions);

      const calculationResult: StatePensionData = {
        date_of_birth: formData.dateOfBirth,
        qualifying_years: formData.qualifyingYears,
        total_ni_years: formData.totalNIYears,
        gaps_in_record: formData.gapsInRecord,
        state_pension_age: statePensionAge,
        weekly_entitlement: weeklyEntitlement,
        annual_entitlement: weeklyEntitlement * 52,
        full_pension_amount: FULL_STATE_PENSION_ANNUAL,
        years_to_retirement: yearsToRetirement,
        can_fill_gaps: formData.gapsInRecord > 0 && yearsToRetirement > 0,
        gap_filling_cost: gapOptions.reduce((sum, opt) => sum + (opt.recommended ? opt.cost : 0), 0)
      };

      setCalculation(calculationResult);
      onCalculationComplete?.(calculationResult);

      logger.info('State pension calculation completed', {
        qualifyingYears: formData.qualifyingYears,
        weeklyEntitlement,
        yearsToRetirement
      });

    } catch (error) {
      logger.error('Error calculating state pension:', error);
      setErrors({ calculation: 'Failed to calculate state pension' });
    } finally {
      setIsCalculating(false);
    }
  };

  const generateGapFillingOptions = (): GapFillingOption[] => {
    const options: GapFillingOption[] = [];
    const currentYear = new Date().getFullYear();

    // Find gaps that can be filled (typically last 6 years)
    const fillableGaps = niRecord
      .filter(record =>
        record.status === 'gap' &&
        parseInt(record.year.split('/')[0]) >= currentYear - 6
      )
      .slice(0, 5); // Limit to 5 most recent gaps

    fillableGaps.forEach((gap, index) => {
      const year = parseInt(gap.year.split('/')[0]);
      const cost = 824.20; // 2024/25 Class 3 NI cost
      const benefit = FULL_STATE_PENSION_WEEKLY / QUALIFYING_YEARS_REQUIRED * 52; // Annual benefit per qualifying year
      const deadline = `31 July ${year + 6}`; // 6-year deadline

      options.push({
        year: gap.year,
        cost,
        deadline,
        benefit,
        recommended: benefit > cost * 20, // Recommend if payback period < 20 years
        reason: benefit > cost * 20
          ? `Good value - pays back in ${Math.ceil(cost / (benefit / 52))} weeks`
          : 'May not be cost effective based on current rates'
      });
    });

    return options;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: NIRecord['status']): string => {
    switch (status) {
      case 'qualifying': return 'bg-green-100 text-green-800';
      case 'credited': return 'bg-blue-100 text-blue-800';
      case 'non_qualifying': return 'bg-yellow-100 text-yellow-800';
      case 'gap': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        State Pension Calculator
      </h2>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date of Birth *
          </label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.dateOfBirth ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.dateOfBirth && (
            <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gender
          </label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <button
        onClick={calculateStatePension}
        disabled={isCalculating || !formData.dateOfBirth}
        className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-6"
      >
        {isCalculating ? 'Calculating...' : 'Calculate State Pension'}
      </button>

      {errors.calculation && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-red-600 dark:text-red-400">{errors.calculation}</p>
        </div>
      )}

      {/* Calculation Results */}
      {calculation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Weekly Entitlement</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(calculation.weekly_entitlement)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Annual Entitlement</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(calculation.annual_entitlement)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Qualifying Years</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculation.qualifying_years} / {QUALIFYING_YEARS_REQUIRED}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Pension Age</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculation.state_pension_age}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Progress to Full Pension</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {Math.round((calculation.qualifying_years / QUALIFYING_YEARS_REQUIRED) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((calculation.qualifying_years / QUALIFYING_YEARS_REQUIRED) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Gap Filling Options */}
          {gapFillingOptions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Gap Filling Options
              </h3>
              <div className="space-y-3">
                {gapFillingOptions.map((option, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      option.recommended
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Fill gap for {option.year}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {option.reason}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Deadline: {option.deadline}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(option.cost)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          +{formatCurrency(option.benefit)}/year
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
              Recommendations
            </h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              {calculation.qualifying_years < QUALIFYING_YEARS_REQUIRED && (
                <li>• You need {QUALIFYING_YEARS_REQUIRED - calculation.qualifying_years} more qualifying years for the full State Pension</li>
              )}
              {calculation.years_to_retirement > 0 && (
                <li>• You have {Math.floor(calculation.years_to_retirement)} years until State Pension age</li>
              )}
              {gapFillingOptions.some(opt => opt.recommended) && (
                <li>• Consider filling recommended gaps to increase your pension</li>
              )}
              {calculation.qualifying_years >= QUALIFYING_YEARS_REQUIRED && (
                <li>• ✓ You're on track for the full State Pension</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default StatePensionCalculator;