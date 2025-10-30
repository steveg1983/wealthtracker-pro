import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RadioCheckbox } from './common/RadioCheckbox';
import { ukMortgageService } from '../services/ukMortgageService';
import { usMortgageService } from '../services/usMortgageService';
import { useRegionalSettings, useRegionalCurrency } from '../hooks/useRegionalSettings';
import { useUser } from '@clerk/clerk-react';
import AccountSelector from './AccountSelector';
import { useRealFinancialData } from '../hooks/useRealFinancialData';
import { 
  HomeIcon,
  CalculatorIcon,
  TrashIcon,
  DollarSignIcon,
  TrendingUpIcon,
  PlusIcon,
  InfoIcon
} from './icons';
import { formatPercentageFromRatio, formatPercentageValue, toDecimal } from '@wealthtracker/utils';

type UKRegion = 'england' | 'scotland' | 'wales';
type UKCalculatorType = 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability';
type UKMortgageType = 'fixed' | 'variable' | 'tracker';
type UKInitialRatePeriod = 2 | 3 | 5 | 10;
type USLoanType = 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo';

type CalculationDetails = unknown;
type StaircasingOption = Record<string, unknown>;

interface HelpToBuyDetails {
  equityLoan: number;
  deposit: number;
  mortgage: number;
  monthlyMortgagePayment: number;
  year6Interest: number;
  totalCost: number;
}

interface SharedOwnershipDetails {
  sharePercentage: number;
  monthlyRent: number;
  totalMonthlyPayment: number;
  staircasingOptions: StaircasingOption[];
}

interface RemortgageDetails {
  currentPayment: number;
  newPayment: number;
  monthlySavings: number;
  breakEvenMonths: number;
  worthRemortgaging: boolean;
}

interface AffordabilityDetails {
  maxLoan: number;
  stressTestPassed: boolean;
  affordabilityRatio: number;
}

interface CalculationPeriod {
  rate: number;
  years: number;
  monthlyPayment: number;
  totalPayments?: number;
  totalInterest?: number;
}

interface SavedCalculation {
  id: string;
  date: Date;
  region: 'UK' | 'US';
  propertyPrice: number;
  loanAmount: number;
  interestRate: number;
  termYears: number;
  monthlyPayment: number;
  totalInterest: number;
  stampDuty?: number;
  pmi?: number;
  propertyTax?: number;
  loanType?: string;
  ukRegion?: UKRegion;
  usState?: string;
  calculationDetails?: CalculationDetails; // Stores full calculation including two-tier details
  calculatorType?: UKCalculatorType;
  helpToBuy?: HelpToBuyDetails;
  sharedOwnership?: SharedOwnershipDetails;
  remortgage?: RemortgageDetails;
  affordability?: AffordabilityDetails;
  initialPeriod?: CalculationPeriod;
  subsequentPeriod?: CalculationPeriod;
}

type SerializedSavedCalculation = Omit<SavedCalculation, 'date'> & { date: string };

const isUkCalculatorType = (value: string): value is UKCalculatorType =>
  value === 'standard' ||
  value === 'helpToBuy' ||
  value === 'sharedOwnership' ||
  value === 'remortgage' ||
  value === 'affordability';

const isUkRegion = (value: string): value is UKRegion =>
  value === 'england' || value === 'scotland' || value === 'wales';

const isUkMortgageType = (value: string): value is UKMortgageType =>
  value === 'fixed' || value === 'variable' || value === 'tracker';

const UK_INITIAL_RATE_PERIODS: readonly UKInitialRatePeriod[] = [2, 3, 5, 10];

const isUkInitialRatePeriod = (value: number): value is UKInitialRatePeriod =>
  UK_INITIAL_RATE_PERIODS.includes(value as UKInitialRatePeriod);

const isUsLoanType = (value: string): value is USLoanType =>
  value === 'conventional' ||
  value === 'fha' ||
  value === 'va' ||
  value === 'usda' ||
  value === 'jumbo';

const safeFormatRatio = (numerator: number, denominator: number, decimals: number): string => {
  if (!Number.isFinite(denominator) || denominator === 0) {
    return formatPercentageValue(0, decimals);
  }

  return formatPercentageFromRatio(toDecimal(numerator).dividedBy(denominator), decimals);
};

interface UkFormData {
  propertyPrice: number;
  deposit: number;
  interestRate: number;
  termYears: number;
  region: UKRegion;
  firstTimeBuyer: boolean;
  additionalProperty: boolean;
  mortgageType: UKMortgageType;
  calculatorType: UKCalculatorType;
  useTwoTierRate: boolean;
  initialRatePeriod: UKInitialRatePeriod;
  initialRate: number;
  subsequentRate: number;
  useHelpToBuy: boolean;
  isLondon: boolean;
  sharePercentage: number;
  currentBalance: number;
  currentRate: number;
  currentRemainingYears: number;
  newRate: number;
  arrangementFee: number;
  annualIncome: number;
  monthlyExpenses: number;
  existingDebt: number;
}

interface UsFormData {
  homePrice: number;
  downPayment: number;
  interestRate: number;
  termYears: number;
  state: string;
  loanType: USLoanType;
  creditScore: number;
}

export default function MortgageCalculatorNew() {
  const { region } = useRegionalSettings();
  const { formatCurrency } = useRegionalCurrency();
  const { user } = useUser();
  const financialData = useRealFinancialData();
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [selectedCalculation, setSelectedCalculation] = useState<SavedCalculation | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  const initialUkFormData: UkFormData = {
    propertyPrice: 350000,
    deposit: 35000,
    interestRate: 5.5,
    termYears: 25,
    region: 'england',
    firstTimeBuyer: false,
    additionalProperty: false,
    mortgageType: 'fixed',
    calculatorType: 'standard',
    useTwoTierRate: false,
    initialRatePeriod: 2,
    initialRate: 5.5,
    subsequentRate: 4.5,
    useHelpToBuy: false,
    isLondon: false,
    sharePercentage: 0.25,
    currentBalance: 200000,
    currentRate: 6.5,
    currentRemainingYears: 20,
    newRate: 4.5,
    arrangementFee: 999,
    annualIncome: 50000,
    monthlyExpenses: 1500,
    existingDebt: 300
  };

  const [ukFormData, setUkFormData] = useState<UkFormData>(initialUkFormData);

  const initialUsFormData: UsFormData = {
    homePrice: 400000,
    downPayment: 80000,
    interestRate: 6.5,
    termYears: 30,
    state: 'CA',
    loanType: 'conventional',
    creditScore: 740
  };

  const [usFormData, setUsFormData] = useState<UsFormData>(initialUsFormData);

  const loanComparisons = useMemo(() => {
    return usMortgageService.compareLoanTypes(
      usFormData.homePrice,
      usFormData.downPayment,
      usFormData.creditScore,
      usFormData.loanType === 'va',
      usFormData.state
    );
  }, [
    usFormData.homePrice,
    usFormData.downPayment,
    usFormData.creditScore,
    usFormData.loanType,
    usFormData.state
  ]);

  // Account selection state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [useRealAccountData, setUseRealAccountData] = useState(false);
  const [useRealIncomeData, setUseRealIncomeData] = useState(false);

  const updateUkCalculatorType = (value: string) => {
    if (isUkCalculatorType(value)) {
      setUkFormData(prev => ({ ...prev, calculatorType: value }));
    }
  };

  const handleUkCalculatorTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateUkCalculatorType(event.target.value);
  };

  const handleUkRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isUkRegion(value)) {
      setUkFormData(prev => ({ ...prev, region: value }));
    }
  };

  const handleUkMortgageTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isUkMortgageType(value)) {
      setUkFormData(prev => ({ ...prev, mortgageType: value }));
    }
  };

  const handleUkInitialRatePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const period = Number(event.target.value);
    if (isUkInitialRatePeriod(period)) {
      setUkFormData(prev => ({ ...prev, initialRatePeriod: period }));
    }
  };

  const handleUsLoanTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isUsLoanType(value)) {
      setUsFormData(prev => ({ ...prev, loanType: value }));
    }
  };

  const loadCalculations = useCallback(async () => {
    if (!user) {
      setCalculations([]);
      return;
    }

    try {
      const saved = localStorage.getItem('mortgageCalculations');
      if (saved) {
        const parsed = JSON.parse(saved) as SerializedSavedCalculation[];
        setCalculations(parsed.map((calc) => ({
          ...calc,
          date: new Date(calc.date)
        })));
      } else {
        setCalculations([]);
      }
    } catch (error) {
      console.error('Error loading calculations:', error);
    }
  }, [user]);

  useEffect(() => {
    void loadCalculations();
  }, [loadCalculations]);

  // Auto-populate income data when real data toggle is enabled
  useEffect(() => {
    if (useRealIncomeData && financialData) {
      const annualIncomeRounded = financialData.annualIncome.toDecimalPlaces(0).toNumber();
      const monthlyExpensesRounded = financialData.monthlyExpenses.toDecimalPlaces(0).toNumber();
      const existingDebtRounded = financialData.totalMonthlyDebtPayments.toDecimalPlaces(0).toNumber();
      
      if (region === 'UK') {
        setUkFormData(prev => ({
          ...prev,
          annualIncome: annualIncomeRounded,
          monthlyExpenses: monthlyExpensesRounded,
          existingDebt: existingDebtRounded
        }));
      } else {
        // For US, we can use income for affordability calculations
        // This could be expanded to include more US-specific fields
        setUsFormData(prev => ({
          ...prev,
          // Could add affordability-related fields here in the future
        }));
      }
    }
  }, [useRealIncomeData, financialData, region]);

  const saveCalculation = (calculation: SavedCalculation) => {
    const updated = [...calculations, calculation];
    setCalculations(updated);
    localStorage.setItem('mortgageCalculations', JSON.stringify(updated));
  };

  const deleteCalculation = (id: string) => {
    if (window.confirm('Delete this calculation?')) {
      const updated = calculations.filter(c => c.id !== id);
      setCalculations(updated);
      localStorage.setItem('mortgageCalculations', JSON.stringify(updated));
      if (selectedCalculation?.id === id) {
        setSelectedCalculation(null);
      }
    }
  };

  const handleAccountSelection = (accountIds: string[], totalAmount: number): void => {
    setSelectedAccountIds(accountIds);
    
    // Update form data based on region with 20% buffer
    if (region === 'UK') {
      setUkFormData(prev => ({
        ...prev,
        deposit: Math.floor(totalAmount * 0.8)
      }));
    } else {
      setUsFormData(prev => ({
        ...prev,
        downPayment: Math.floor(totalAmount * 0.8)
      }));
    }
  };

  const handleUKCalculate = () => {
    let newCalc: SavedCalculation;

    switch (ukFormData.calculatorType) {
      case 'sharedOwnership': {
        // TODO: Implement calculateSharedOwnership method in UKMortgageService
        const soCalc = {
          mortgageAmount: ukFormData.propertyPrice * (ukFormData.sharePercentage || 0.5) - ukFormData.deposit,
          monthlyRent: 0,
          totalMonthlyPayment: 0,
          staircasingCosts: []
        };
        
        newCalc = {
          id: Date.now().toString(),
          date: new Date(),
          region: 'UK',
          calculatorType: 'sharedOwnership',
          propertyPrice: ukFormData.propertyPrice,
          loanAmount: soCalc.mortgageAmount,
          interestRate: ukFormData.interestRate,
          termYears: ukFormData.termYears,
          monthlyPayment: soCalc.totalMonthlyPayment,
          totalInterest: 0, // Complex for shared ownership
          ukRegion: ukFormData.region,
          loanType: `Shared Ownership (${formatPercentageFromRatio(ukFormData.sharePercentage, 0)})`,
          sharedOwnership: {
            sharePercentage: ukFormData.sharePercentage,
            monthlyRent: soCalc.monthlyRent,
            totalMonthlyPayment: soCalc.totalMonthlyPayment,
            staircasingOptions: soCalc.staircasingCosts
          }
        };
        break;
      }

      case 'remortgage': {
        // TODO: Implement compareRemortgage method in UKMortgageService
        const remortgageCalc = {
          currentMortgage: {
            monthlyPayment: 0,
            totalPayment: 0,
            totalInterest: 0
          },
          newMortgage: {
            monthlyPayment: 0,
            totalPayment: 0,
            totalInterest: 0
          },
          savings: {
            monthlySavings: 0,
            breakEvenMonths: 0,
            worthRemortgaging: false
          },
          fees: {
            exitFees: 0,
            arrangementFees: 0,
            valuationFees: 0,
            legalFees: 0,
            totalFees: 0
          }
        };
        
        newCalc = {
          id: Date.now().toString(),
          date: new Date(),
          region: 'UK',
          calculatorType: 'remortgage',
          propertyPrice: 0, // Not applicable for remortgage
          loanAmount: ukFormData.currentBalance,
          interestRate: ukFormData.newRate,
          termYears: ukFormData.termYears,
          monthlyPayment: remortgageCalc.newMortgage.monthlyPayment,
          totalInterest: 0, // Will be calculated
          ukRegion: ukFormData.region,
          loanType: 'Remortgage',
          remortgage: {
            currentPayment: remortgageCalc.currentMortgage.monthlyPayment,
            newPayment: remortgageCalc.newMortgage.monthlyPayment,
            monthlySavings: remortgageCalc.savings.monthlySavings,
            breakEvenMonths: remortgageCalc.savings.breakEvenMonths,
            worthRemortgaging: remortgageCalc.savings.worthRemortgaging
          }
        };
        break;
      }

      case 'affordability': {
        const affordabilityCalc = ukMortgageService.calculateAffordability(
          ukFormData.annualIncome,
          ukFormData.monthlyExpenses,
          ukFormData.existingDebt
        );
        
        newCalc = {
          id: Date.now().toString(),
          date: new Date(),
          region: 'UK',
          calculatorType: 'affordability',
          propertyPrice: ukFormData.propertyPrice,
          loanAmount: ukFormData.propertyPrice - ukFormData.deposit,
          interestRate: ukFormData.interestRate,
          termYears: ukFormData.termYears,
          monthlyPayment: affordabilityCalc.maxMonthlyPayment,
          totalInterest: 0,
          ukRegion: ukFormData.region,
          loanType: 'Affordability Check',
          affordability: {
            maxLoan: affordabilityCalc.maxLoan,
            stressTestPassed: false, // TODO: Add stress test to affordability calculation
            affordabilityRatio: affordabilityCalc.loanToIncome
          }
        };
        break;
      }

      default: {
        // Standard mortgage calculation
        let loanAmount = ukFormData.propertyPrice - ukFormData.deposit;
        let helpToBuyDetails = null;
        
        // Calculate Help to Buy if enabled
        if (ukFormData.useHelpToBuy && ukFormData.firstTimeBuyer) {
          try {
            const htbCalc = ukMortgageService.calculateHelpToBuy(
              ukFormData.propertyPrice,
              ukFormData.deposit,
              ukFormData.isLondon
            );
            loanAmount = htbCalc.mortgage;
            helpToBuyDetails = htbCalc;
          } catch (error) {
            console.warn('Help to Buy calculation failed:', error);
          }
        }
        
        // Use two-tier calculation if enabled
        const calculation = ukFormData.useTwoTierRate
          ? ukMortgageService.calculateTwoTierMortgage(
              loanAmount,
              ukFormData.initialRate / 100,
              ukFormData.initialRatePeriod,
              ukFormData.subsequentRate / 100,
              ukFormData.termYears
            )
          : ukMortgageService.calculateMortgage(
              loanAmount,
              ukFormData.interestRate / 100,
              ukFormData.termYears,
              ukFormData.mortgageType
            );
        
        const stampDuty = ukMortgageService.calculateStampDuty(
          ukFormData.propertyPrice,
          ukFormData.region,
          ukFormData.firstTimeBuyer,
          ukFormData.additionalProperty
        );
        
        newCalc = {
          id: Date.now().toString(),
          date: new Date(),
          region: 'UK',
          calculatorType: helpToBuyDetails ? 'helpToBuy' : 'standard',
          propertyPrice: ukFormData.propertyPrice,
          loanAmount,
          interestRate: ukFormData.useTwoTierRate ? ukFormData.initialRate : ukFormData.interestRate,
          termYears: ukFormData.termYears,
          monthlyPayment: calculation.monthlyPayment,
          totalInterest: calculation.totalInterest,
          stampDuty: stampDuty.stampDuty,
          ukRegion: ukFormData.region,
          loanType: ukFormData.useTwoTierRate 
            ? `${ukFormData.initialRatePeriod}yr fixed then variable`
            : ukFormData.mortgageType,
          calculationDetails: calculation,
          ...(helpToBuyDetails ? { helpToBuy: helpToBuyDetails } : {}),
          ...(calculation.initialPeriod ? { initialPeriod: calculation.initialPeriod } : {}),
          ...(calculation.subsequentPeriod ? { subsequentPeriod: calculation.subsequentPeriod } : {})
        };
      }
    }
    
    saveCalculation(newCalc);
    setSelectedCalculation(newCalc);
    setShowCalculator(false);
  };

  const handleUSCalculate = () => {
    const calculation = usMortgageService.calculateMortgage(
      usFormData.homePrice,
      usFormData.downPayment,
      usFormData.interestRate / 100,
      usFormData.termYears,
      usFormData.state,
      usFormData.loanType
    );
    
    const newCalc: SavedCalculation = {
      id: Date.now().toString(),
      date: new Date(),
      region: 'US',
      propertyPrice: usFormData.homePrice,
      loanAmount: usFormData.homePrice - usFormData.downPayment,
      interestRate: usFormData.interestRate,
      termYears: usFormData.termYears,
      monthlyPayment: calculation.monthlyPayment,
      totalInterest: calculation.totalInterest,
      ...(typeof calculation.monthlyPMI === 'number' ? { pmi: calculation.monthlyPMI } : {}),
      ...(typeof calculation.monthlyPropertyTax === 'number' ? { propertyTax: calculation.monthlyPropertyTax } : {}),
      usState: usFormData.state,
      loanType: usFormData.loanType,
      calculationDetails: calculation
    };
    
    saveCalculation(newCalc);
    setSelectedCalculation(newCalc);
    setShowCalculator(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mortgage Calculator
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Calculate mortgage payments with {region === 'UK' ? 'UK' : 'US'} specific features
          </p>
        </div>
        <div className="flex gap-2">
          {calculations.length > 0 && (
            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Compare Types
            </button>
          )}
          <button
            onClick={() => setShowCalculator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <CalculatorIcon size={16} />
            New Calculation
          </button>
        </div>
      </div>

      {calculations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <HomeIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No mortgage calculations yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Calculate mortgage payments with regional tax and fee calculations
          </p>
          <button
            onClick={() => setShowCalculator(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <CalculatorIcon size={16} />
            Calculate Mortgage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Saved Calculations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Saved Calculations</h3>
              <button
                onClick={() => setShowCalculator(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center"
              >
                <PlusIcon size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {calculations.map((calc) => (
                <div
                  key={calc.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedCalculation?.id === calc.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedCalculation(calc)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {calc.region}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(calc.propertyPrice)}
                      </h4>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCalculation(calc.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      {calc.initialPeriod ? (
                        <span className="text-xs">
                          {calc.initialPeriod.rate}% ({calc.initialPeriod.years}yr) → {calc.subsequentPeriod?.rate}%
                        </span>
                      ) : (
                        <span>{calc.interestRate}%</span>
                      )}
                      {' • '}{calc.termYears} years
                    </div>
                    <div className="font-medium">{formatCurrency(calc.monthlyPayment)}/month</div>
                    {calc.initialPeriod && (
                      <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">Two-tier rate</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculation Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCalculation && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Payment</p>
                        <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                          {formatCurrency(selectedCalculation.monthlyPayment)}
                        </p>
                        {selectedCalculation.pmi && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            +{formatCurrency(selectedCalculation.pmi)} PMI
                          </p>
                        )}
                      </div>
                      <DollarSignIcon size={24} className="text-gray-500" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Interest</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(selectedCalculation.totalInterest)}
                        </p>
                      </div>
                      <TrendingUpIcon size={24} className="text-red-500" />
                    </div>
                  </div>
                </div>

                {/* Regional Details */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HomeIcon size={20} />
                    Mortgage Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Property Price:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(selectedCalculation.propertyPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loan Amount:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(selectedCalculation.loanAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Interest Rate:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedCalculation.interestRate}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loan Term:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedCalculation.termYears} years
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {selectedCalculation.region === 'UK' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Stamp Duty:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(selectedCalculation.stampDuty || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Region:</span>
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {selectedCalculation.ukRegion}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Mortgage Type:</span>
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {selectedCalculation.loanType}
                            </span>
                          </div>
                        </>
                      )}
                      
                      {selectedCalculation.region === 'US' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Property Tax:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(selectedCalculation.propertyTax || 0)}/month
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">PMI:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(selectedCalculation.pmi || 0)}/month
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">State:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {selectedCalculation.usState}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Loan Type:</span>
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {selectedCalculation.loanType}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Help to Buy Breakdown */}
                  {selectedCalculation.helpToBuy && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <HomeIcon size={16} className="text-green-500" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Help to Buy Equity Loan</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Your Deposit:</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatCurrency(selectedCalculation.helpToBuy.deposit)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Government Equity Loan:</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {formatCurrency(selectedCalculation.helpToBuy.equityLoan)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Your Mortgage:</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatCurrency(selectedCalculation.helpToBuy.mortgage)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Equity Loan %:</span>
                              <span className="text-gray-900 dark:text-white">
                                {safeFormatRatio(
                                  selectedCalculation.helpToBuy.equityLoan,
                                  selectedCalculation.propertyPrice,
                                  0
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Interest from Year 6:</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatCurrency(selectedCalculation.helpToBuy.year6Interest)}/month
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Interest-free period:</span>
                              <span className="text-gray-900 dark:text-white">5 years</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          After 5 years, you'll pay 1.75% interest on the equity loan, increasing annually by RPI + 1%
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Two-tier Rate Breakdown */}
                  {selectedCalculation.initialPeriod && selectedCalculation.subsequentPeriod && (
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUpIcon size={16} className="text-gray-500" />
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Two-tier Rate Breakdown</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Initial Period ({selectedCalculation.initialPeriod.years} years @ {selectedCalculation.initialPeriod.rate}%)
                          </h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Monthly Payment:</span>
                              <span className="text-gray-900 dark:text-white font-medium">
                                {formatCurrency(selectedCalculation.initialPeriod.monthlyPayment ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Total Interest:</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatCurrency(selectedCalculation.initialPeriod.totalInterest ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Subsequent Period ({selectedCalculation.subsequentPeriod.years} years @ {selectedCalculation.subsequentPeriod.rate}%)
                          </h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Monthly Payment:</span>
                              <span className="text-gray-900 dark:text-white font-medium">
                                {formatCurrency(selectedCalculation.subsequentPeriod.monthlyPayment ?? 0)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Total Interest:</span>
                              <span className="text-gray-900 dark:text-white">
                                {formatCurrency(selectedCalculation.subsequentPeriod.totalInterest ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p>Payment change after fixed period: <span className="font-medium text-gray-900 dark:text-white">
                            {(selectedCalculation.subsequentPeriod.monthlyPayment ?? 0) > (selectedCalculation.initialPeriod.monthlyPayment ?? 0) ? '+' : ''}
                            {formatCurrency(
                              (selectedCalculation.subsequentPeriod.monthlyPayment ?? 0) -
                              (selectedCalculation.initialPeriod.monthlyPayment ?? 0)
                            )}
                          </span></p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <InfoIcon size={16} className="text-gray-500" />
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Cost Breakdown</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Principal:</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCalculation.loanAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Interest:</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCalculation.totalInterest)}</span>
                      </div>
                      {selectedCalculation.stampDuty && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Stamp Duty:</span>
                          <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCalculation.stampDuty)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t border-gray-200 dark:border-gray-600">
                        <span className="text-gray-700 dark:text-gray-300">Total Cost:</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatCurrency(
                            selectedCalculation.loanAmount + 
                            selectedCalculation.totalInterest + 
                            (selectedCalculation.stampDuty || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto my-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Calculate Mortgage - {region}
                </h3>
                <button
                  onClick={() => setShowCalculator(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <PlusIcon size={20} className="rotate-45" />
                </button>
              </div>

              {region === 'UK' ? (
                <div className="space-y-4">
                  {/* Calculator Type Selector */}
                  <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Calculator Type</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="standard"
                          checked={ukFormData.calculatorType === 'standard'}
                          onChange={handleUkCalculatorTypeChange}
                          className="mr-3 text-gray-500 focus:ring-blue-400"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Standard Mortgage</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Traditional mortgage calculator</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="sharedOwnership"
                          checked={ukFormData.calculatorType === 'sharedOwnership'}
                          onChange={handleUkCalculatorTypeChange}
                          className="mr-3 text-gray-500 focus:ring-blue-400"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Shared Ownership</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Part buy, part rent</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="remortgage"
                          checked={ukFormData.calculatorType === 'remortgage'}
                          onChange={handleUkCalculatorTypeChange}
                          className="mr-3 text-gray-500 focus:ring-blue-400"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Remortgage</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Compare existing vs new</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="calculatorType"
                          value="affordability"
                          checked={ukFormData.calculatorType === 'affordability'}
                          onChange={handleUkCalculatorTypeChange}
                          className="mr-3 text-gray-500 focus:ring-blue-400"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Affordability</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Stress test & max loan</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Options Section */}
                  {ukFormData.calculatorType === 'standard' && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Mortgage Options</h4>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="mortgageStructure"
                        checked={!ukFormData.useTwoTierRate}
                        onChange={() => setUkFormData({ ...ukFormData, useTwoTierRate: false })}
                        className="mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Single Rate Mortgage</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="mortgageStructure"
                        checked={ukFormData.useTwoTierRate}
                        onChange={() => setUkFormData({ ...ukFormData, useTwoTierRate: true })}
                        className="mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Two-tier Rate (Fixed then Variable)</span>
                    </label>
                    
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
                      <label className="flex items-center">
                        <RadioCheckbox
                          checked={ukFormData.firstTimeBuyer}
                          onChange={(checked) => setUkFormData({ ...ukFormData, firstTimeBuyer: checked })}
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">First Time Buyer</span>
                      </label>
                      
                      <label className="flex items-center">
                        <RadioCheckbox
                          checked={ukFormData.additionalProperty}
                          onChange={(checked) => setUkFormData({ ...ukFormData, additionalProperty: checked })}
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Additional Property (3% surcharge)</span>
                      </label>
                    </div>
                    </div>
                  )}

                  {/* Shared Ownership Form */}
                  {ukFormData.calculatorType === 'sharedOwnership' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Property Value
                          </label>
                          <input
                            type="number"
                            value={ukFormData.propertyPrice}
                            onChange={(e) => setUkFormData({ ...ukFormData, propertyPrice: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="5000"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Share Percentage (10-75%)
                          </label>
                          <select
                            value={ukFormData.sharePercentage}
                            onChange={(e) => setUkFormData({ ...ukFormData, sharePercentage: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={0.10}>10%</option>
                            <option value={0.25}>25%</option>
                            <option value={0.30}>30%</option>
                            <option value={0.40}>40%</option>
                            <option value={0.50}>50%</option>
                            <option value={0.75}>75%</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-4 mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Deposit Source
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setUseRealAccountData(false)}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                  !useRealAccountData 
                                    ? 'bg-gray-600 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                Manual
                              </button>
                              <button
                                type="button"
                                onClick={() => setUseRealAccountData(true)}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                  useRealAccountData 
                                    ? 'bg-gray-600 text-white' 
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                From Accounts
                              </button>
                            </div>
                          </div>
                          
                          {useRealAccountData ? (
                            <AccountSelector
                              selectedAccountIds={selectedAccountIds}
                              onSelectionChange={handleAccountSelection}
                              label="Select accounts for deposit"
                              helpText="Choose which accounts to use for your deposit. We'll automatically apply a 20% safety buffer."
                              maxSelection={3}
                              accountTypes={['checking', 'savings', 'current']}
                            />
                          ) : (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Deposit
                              </label>
                              <input
                                type="number"
                                value={ukFormData.deposit}
                                onChange={(e) => setUkFormData({ ...ukFormData, deposit: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                min="0"
                                step="1000"
                              />
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Interest Rate (%)
                          </label>
                          <input
                            type="number"
                            value={ukFormData.interestRate}
                            onChange={(e) => setUkFormData({ ...ukFormData, interestRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            max="20"
                            step="0.1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Mortgage Term
                          </label>
                          <select
                            value={ukFormData.termYears}
                            onChange={(e) => setUkFormData({ ...ukFormData, termYears: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={15}>15 years</option>
                            <option value={20}>20 years</option>
                            <option value={25}>25 years</option>
                            <option value={30}>30 years</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remortgage Form */}
                  {ukFormData.calculatorType === 'remortgage' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Mortgage</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Outstanding Balance
                          </label>
                          <input
                            type="number"
                            value={ukFormData.currentBalance}
                            onChange={(e) => setUkFormData({ ...ukFormData, currentBalance: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="5000"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Current Rate (%)
                          </label>
                          <input
                            type="number"
                            value={ukFormData.currentRate}
                            onChange={(e) => setUkFormData({ ...ukFormData, currentRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            max="20"
                            step="0.1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Years Remaining
                          </label>
                          <input
                            type="number"
                            value={ukFormData.currentRemainingYears}
                            onChange={(e) => setUkFormData({ ...ukFormData, currentRemainingYears: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="1"
                            max="35"
                          />
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-4">New Mortgage</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Rate (%)
                          </label>
                          <input
                            type="number"
                            value={ukFormData.newRate}
                            onChange={(e) => setUkFormData({ ...ukFormData, newRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            max="20"
                            step="0.1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Term (years)
                          </label>
                          <select
                            value={ukFormData.termYears}
                            onChange={(e) => setUkFormData({ ...ukFormData, termYears: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={ukFormData.currentRemainingYears}>Same ({ukFormData.currentRemainingYears} years)</option>
                            <option value={15}>15 years</option>
                            <option value={20}>20 years</option>
                            <option value={25}>25 years</option>
                            <option value={30}>30 years</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Arrangement Fee
                          </label>
                          <input
                            type="number"
                            value={ukFormData.arrangementFee}
                            onChange={(e) => setUkFormData({ ...ukFormData, arrangementFee: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="100"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Affordability Form */}
                  {ukFormData.calculatorType === 'affordability' && (
                    <div className="space-y-4">
                      {/* Real Data Toggle */}
                      {financialData && (
                        <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                                🤖 Use Real Financial Data
                              </h4>
                              <p className="text-xs text-blue-700 dark:text-gray-300">
                                Automatically fill fields with data from your accounts and transactions
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setUseRealIncomeData(!useRealIncomeData)}
                              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                useRealIncomeData 
                                  ? 'bg-gray-600 text-white' 
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {useRealIncomeData ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          
                          {financialData && (
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-500">Annual Income</p>
                                <p className="font-semibold text-blue-900 dark:text-blue-100">
                                  {formatCurrency(financialData.annualIncome.toNumber())}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-500">Monthly Expenses</p>
                                <p className="font-semibold text-blue-900 dark:text-blue-100">
                                  {formatCurrency(financialData.monthlyExpenses.toNumber())}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-500">Debt Payments</p>
                                <p className="font-semibold text-blue-900 dark:text-blue-100">
                                  {formatCurrency(financialData.totalMonthlyDebtPayments.toNumber())}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-500">Income Stability</p>
                                <p className="font-semibold text-blue-900 dark:text-blue-100">
                                  {financialData.incomeStability}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Annual Income
                            </label>
                            {useRealIncomeData && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                Auto-filled
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={ukFormData.annualIncome}
                            onChange={(e) => setUkFormData({ ...ukFormData, annualIncome: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="1000"
                            readOnly={useRealIncomeData}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Property Price
                          </label>
                          <input
                            type="number"
                            value={ukFormData.propertyPrice}
                            onChange={(e) => setUkFormData({ ...ukFormData, propertyPrice: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="5000"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Monthly Expenses
                            </label>
                            {useRealIncomeData && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                Auto-filled
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={ukFormData.monthlyExpenses}
                            onChange={(e) => setUkFormData({ ...ukFormData, monthlyExpenses: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="100"
                            readOnly={useRealIncomeData}
                          />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Existing Monthly Debt
                            </label>
                            {useRealIncomeData && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                Auto-filled
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={ukFormData.existingDebt}
                            onChange={(e) => setUkFormData({ ...ukFormData, existingDebt: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="50"
                            readOnly={useRealIncomeData}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Interest Rate (%)
                          </label>
                          <input
                            type="number"
                            value={ukFormData.interestRate}
                            onChange={(e) => setUkFormData({ ...ukFormData, interestRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            max="20"
                            step="0.1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standard Mortgage Form */}
                  {ukFormData.calculatorType === 'standard' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Property Price
                        </label>
                        <input
                          type="number"
                          value={ukFormData.propertyPrice}
                          onChange={(e) => setUkFormData({ ...ukFormData, propertyPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          step="5000"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Deposit
                        </label>
                        <input
                          type="number"
                          value={ukFormData.deposit}
                          onChange={(e) => setUkFormData({ ...ukFormData, deposit: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          step="5000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Interest Rate Section - Changes based on selection */}
                  {!ukFormData.useTwoTierRate ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Interest Rate (%)
                        </label>
                        <input
                          type="number"
                          value={ukFormData.interestRate}
                          onChange={(e) => setUkFormData({ ...ukFormData, interestRate: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          max="20"
                          step="0.1"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Term (years)
                        </label>
                        <select
                          value={ukFormData.termYears}
                          onChange={(e) => setUkFormData({ ...ukFormData, termYears: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value={15}>15 years</option>
                          <option value={20}>20 years</option>
                          <option value={25}>25 years</option>
                          <option value={30}>30 years</option>
                          <option value={35}>35 years</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Term (years)
                          </label>
                          <select
                            value={ukFormData.termYears}
                            onChange={(e) => setUkFormData({ ...ukFormData, termYears: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={15}>15 years</option>
                            <option value={20}>20 years</option>
                            <option value={25}>25 years</option>
                            <option value={30}>30 years</option>
                            <option value={35}>35 years</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Region
                      </label>
                      <select
                        value={ukFormData.region}
                        onChange={handleUkRegionChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="england">England</option>
                        <option value="scotland">Scotland</option>
                        <option value="wales">Wales</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Mortgage Type
                      </label>
                      <select
                        value={ukFormData.mortgageType}
                        onChange={handleUkMortgageTypeChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="fixed">Fixed Rate</option>
                        <option value="variable">Variable Rate</option>
                        <option value="tracker">Tracker</option>
                      </select>
                    </div>
                  </div>

                  {/* Two-tier Rate Fields - Show when selected */}
                  {ukFormData.useTwoTierRate && (
                    <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Two-tier Rate Structure</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Initial Fixed Period
                          </label>
                          <select
                            value={ukFormData.initialRatePeriod}
                            onChange={handleUkInitialRatePeriodChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value={2}>2 years</option>
                            <option value={3}>3 years</option>
                            <option value={5}>5 years</option>
                            <option value={10}>10 years</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Initial Rate (%)
                          </label>
                          <input
                            type="number"
                            value={ukFormData.initialRate}
                            onChange={(e) => setUkFormData({ ...ukFormData, initialRate: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            max="20"
                            step="0.1"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Subsequent Rate (%) - After {ukFormData.initialRatePeriod} years
                        </label>
                        <input
                          type="number"
                          value={ukFormData.subsequentRate}
                          onChange={(e) => setUkFormData({ ...ukFormData, subsequentRate: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                          max="20"
                          step="0.1"
                        />
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 p-3 rounded">
                        <p className="font-medium">Your mortgage structure:</p>
                        <ul className="list-disc list-inside mt-1">
                          <li>{ukFormData.initialRate}% interest for the first {ukFormData.initialRatePeriod} years</li>
                          <li>{ukFormData.subsequentRate}% interest for the remaining {ukFormData.termYears - ukFormData.initialRatePeriod} years</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {ukFormData.firstTimeBuyer && (
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <RadioCheckbox
                          checked={ukFormData.useHelpToBuy}
                          onChange={(checked) => setUkFormData({ ...ukFormData, useHelpToBuy: checked })}
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Use Help to Buy Equity Loan</span>
                      </label>
                      
                      {ukFormData.useHelpToBuy && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Help to Buy Details</h4>
                          
                          <label className="flex items-center">
                            <RadioCheckbox
                              checked={ukFormData.isLondon}
                              onChange={(checked) => setUkFormData({ ...ukFormData, isLondon: checked })}
                              className="mr-3"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">London property (40% equity loan)</span>
                          </label>
                          
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p>The government will provide an equity loan of:</p>
                            <ul className="list-disc list-inside mt-1">
                              <li>{ukFormData.isLondon ? '40%' : '20%'} of the property price</li>
                              <li>Interest-free for the first 5 years</li>
                              <li>1.75% interest in year 6, rising annually</li>
                              <li>You need a minimum 5% deposit</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Home Price
                      </label>
                      <input
                        type="number"
                        value={usFormData.homePrice}
                        onChange={(e) => setUsFormData({ ...usFormData, homePrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        step="5000"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-4 mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Down Payment Source
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setUseRealAccountData(false)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              !useRealAccountData 
                                ? 'bg-gray-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Manual
                          </button>
                          <button
                            type="button"
                            onClick={() => setUseRealAccountData(true)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              useRealAccountData 
                                ? 'bg-gray-600 text-white' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            From Accounts
                          </button>
                        </div>
                      </div>
                      
                      {useRealAccountData ? (
                        <AccountSelector
                          selectedAccountIds={selectedAccountIds}
                          onSelectionChange={handleAccountSelection}
                          label="Select accounts for down payment"
                          helpText="Choose which accounts to use for your down payment. We'll automatically apply a 20% safety buffer."
                          maxSelection={3}
                          accountTypes={['checking', 'savings', 'current']}
                        />
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Down Payment
                          </label>
                          <input
                            type="number"
                            value={usFormData.downPayment}
                            onChange={(e) => setUsFormData({ ...usFormData, downPayment: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            min="0"
                            step="5000"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        value={usFormData.interestRate}
                        onChange={(e) => setUsFormData({ ...usFormData, interestRate: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        min="0"
                        max="20"
                        step="0.1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Term (years)
                      </label>
                      <select
                        value={usFormData.termYears}
                        onChange={(e) => setUsFormData({ ...usFormData, termYears: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value={15}>15 years</option>
                        <option value={30}>30 years</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        State
                      </label>
                      <select
                        value={usFormData.state}
                        onChange={(e) => setUsFormData({ ...usFormData, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="CA">California</option>
                        <option value="TX">Texas</option>
                        <option value="FL">Florida</option>
                        <option value="NY">New York</option>
                        <option value="IL">Illinois</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loan Type
                      </label>
                      <select
                        value={usFormData.loanType}
                        onChange={handleUsLoanTypeChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="conventional">Conventional</option>
                        <option value="fha">FHA</option>
                        <option value="va">VA</option>
                        <option value="usda">USDA</option>
                        <option value="jumbo">Jumbo</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Credit Score
                    </label>
                    <input
                      type="number"
                      value={usFormData.creditScore}
                      onChange={(e) => setUsFormData({ ...usFormData, creditScore: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="300"
                      max="850"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCalculator(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={region === 'UK' ? handleUKCalculate : handleUSCalculate}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  Calculate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Compare Mortgage Types
                </h3>
                <button
                  onClick={() => setShowComparison(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <PlusIcon size={20} className="rotate-45" />
                </button>
              </div>

              {selectedCalculation && (
                <div className="space-y-4">
                  {region === 'UK' ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Monthly</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Total Interest</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Pros/Cons</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {ukMortgageService.compareMortgageTypes(
                            selectedCalculation.loanAmount,
                            selectedCalculation.termYears
                          ).map((type) => (
                            <tr key={type.type}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {type.type}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {formatPercentageFromRatio(type.rate, 2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {formatCurrency(type.monthlyPayment)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {formatCurrency(type.totalInterest)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="space-y-1">
                                  {type.pros.slice(0, 2).map((pro, i) => (
                                    <div key={i} className="text-green-600 dark:text-green-400 text-xs">
                                      + {pro}
                                    </div>
                                  ))}
                                  {type.cons.slice(0, 1).map((con, i) => (
                                    <div key={i} className="text-red-600 dark:text-red-400 text-xs">
                                      - {con}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Loan Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Min Down</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">PMI</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Best For</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {loanComparisons.map((loan) => {
                            const downPaymentPercentDisplay = safeFormatRatio(
                              loan.downPayment,
                              usFormData.homePrice,
                              0
                            );
                            const hasPmi = loan.totalPMI > 0;
                            const bestFor = loan.pros.length > 0 ? loan.pros[0] : 'General use';

                            return (
                              <tr key={loan.loanType}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {loan.loanType}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {downPaymentPercentDisplay}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {hasPmi ? 'Required' : 'Not Required'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {bestFor}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
