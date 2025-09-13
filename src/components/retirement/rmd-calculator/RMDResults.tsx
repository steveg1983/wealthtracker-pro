import { memo } from 'react';
import { 
  CalculatorIcon as Calculator,
  AlertTriangleIcon as AlertTriangle,
  InfoIcon as Info,
  CalendarIcon as Calendar,
  DollarSignIcon as DollarSign
} from '../../icons';
import { RMDCalculatorService, type RMDCalculation, type RMDResults } from '../../../services/rmdCalculatorService';
import { logger } from '../../../services/loggingService';

interface RMDResultsProps {
  calculation: RMDCalculation;
  results: RMDResults;
  currentYear: number;
  formatCurrency: (amount: number) => string;
}

/**
 * RMD results component
 * Displays calculated RMD amounts and related information
 */
export const RMDResultsSection = memo(function RMDResultsSection({
  calculation,
  results,
  currentYear,
  formatCurrency
}: RMDResultsProps) {
  // Check if still working exemption applies
  const isStillWorkingExempt = RMDCalculatorService.isStillWorkingExempt(
    calculation.stillWorking,
    calculation.accountType
  );

  if (calculation.age < results.rmdAge) {
    return <NoRMDRequiredMessage results={results} />;
  }

  if (isStillWorkingExempt) {
    return <StillWorkingMessage accountType={calculation.accountType} />;
  }

  return (
    <>
      <RMDCalculationResult
        results={results}
        calculation={calculation}
        currentYear={currentYear}
        formatCurrency={formatCurrency}
      />
      <RMDDeadlineAndPenalty
        calculation={calculation}
        results={results}
        formatCurrency={formatCurrency}
      />
      <TaxEstimate
        taxEstimate={results.taxEstimate}
        formatCurrency={formatCurrency}
      />
    </>
  );
});

/**
 * No RMD required message component
 */
const NoRMDRequiredMessage = memo(function NoRMDRequiredMessage({
  results
}: {
  results: RMDResults;
}) {
  return (
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
  );
});

/**
 * Still working message component
 */
const StillWorkingMessage = memo(function StillWorkingMessage({
  accountType
}: {
  accountType: string;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Info className="h-5 w-5 text-gray-600 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">RMD Delayed - Still Working</p>
          <p className="text-sm text-blue-700 mt-1">
            Since you're still working for this employer, you can delay RMDs from this {accountType} 
            until April 1st of the year after you retire.
          </p>
        </div>
      </div>
    </div>
  );
});

/**
 * RMD calculation result component
 */
const RMDCalculationResult = memo(function RMDCalculationResult({
  results,
  calculation,
  currentYear,
  formatCurrency
}: {
  results: RMDResults;
  calculation: RMDCalculation;
  currentYear: number;
  formatCurrency: (amount: number) => string;
}) {
  return (
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
  );
});

/**
 * RMD deadline and penalty component
 */
const RMDDeadlineAndPenalty = memo(function RMDDeadlineAndPenalty({
  calculation,
  results,
  formatCurrency
}: {
  calculation: RMDCalculation;
  results: RMDResults;
  formatCurrency: (amount: number) => string;
}) {
  return (
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
  );
});

/**
 * Tax estimate component
 */
const TaxEstimate = memo(function TaxEstimate({
  taxEstimate,
  formatCurrency
}: {
  taxEstimate: number;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="h-4 w-4 text-gray-600" />
        <span className="text-xs font-medium text-gray-700">Estimated Tax (22% bracket)</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">
        {formatCurrency(taxEstimate)}
      </p>
    </div>
  );
});