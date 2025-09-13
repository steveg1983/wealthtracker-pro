import { memo, useEffect } from 'react';
import { InfoIcon, CheckCircleIcon, AlertCircleIcon } from '../../icons';
import type { PensionContribution, PensionFormData } from '../../../services/workplacePensionService';
import { WorkplacePensionService } from '../../../services/workplacePensionService';
import { logger } from '../../../services/loggingService';

interface PensionResultsProps {
  results: PensionContribution | null;
  formData: PensionFormData;
  formatCurrency: (amount: number) => string;
}

/**
 * Pension results component
 * Shows calculated contributions and projections
 */
export const PensionResults = memo(function PensionResults({
  results,
  formData,
  formatCurrency
}: PensionResultsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PensionResults component initialized', {
      componentName: 'PensionResults'
    });
  }, []);

  if (!results) return <></>;

  const meetsMinimumContribution = WorkplacePensionService.meetsMinimumContribution(
    formData.employeePercent,
    formData.employerPercent
  );

  return (
    <div className="space-y-4">
      {/* Annual Contributions */}
      <ContributionSummary
        results={results}
        formData={formData}
        formatCurrency={formatCurrency}
      />

      {/* Tax Benefits */}
      <TaxBenefitsSummary
        results={results}
        formData={formData}
        formatCurrency={formatCurrency}
      />

      {/* Projections */}
      <ProjectionSummary
        results={results}
        formData={formData}
        formatCurrency={formatCurrency}
      />

      {/* Qualifying Earnings Info */}
      {formData.qualifyingEarnings && (
        <QualifyingEarningsInfo formatCurrency={formatCurrency} />
      )}

      {/* Auto-enrollment Status */}
      <AutoEnrollmentStatus
        meetsMinimumContribution={meetsMinimumContribution}
      />
    </div>
  );
});

/**
 * Contribution summary sub-component
 */
const ContributionSummary = memo(function ContributionSummary({
  results,
  formData,
  formatCurrency
}: {
  results: PensionContribution;
  formData: PensionFormData;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="bg-blue-50 dark:bg-gray-900/20 rounded-lg p-4">
      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
        Annual Contributions
      </h4>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-blue-700 dark:text-gray-300">Your Contribution:</span>
          <span className="font-medium text-blue-900 dark:text-blue-100">
            {formatCurrency(results.employeeContribution)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-blue-700 dark:text-gray-300">Employer Contribution:</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            +{formatCurrency(results.employerContribution)}
          </span>
        </div>
        {results.taxRelief > 0 && !formData.salaryExchange && (
          <div className="flex justify-between">
            <span className="text-sm text-blue-700 dark:text-gray-300">Tax Relief:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              +{formatCurrency(results.taxRelief)}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-700 dark:text-gray-300">Total:</span>
          <span className="font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(results.totalAnnualContribution)}
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * Tax benefits summary sub-component
 */
const TaxBenefitsSummary = memo(function TaxBenefitsSummary({
  results,
  formData,
  formatCurrency
}: {
  results: PensionContribution;
  formData: PensionFormData;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
      <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
        Tax Benefits
      </h4>
      <div className="space-y-2">
        {formData.salaryExchange ? (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">Tax & NI Savings:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {formatCurrency(results.taxRelief)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">Net Cost to You:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {formatCurrency(results.netCost)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">Tax Relief Added:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {formatCurrency(results.taxRelief)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">Cost from Net Pay:</span>
              <span className="font-medium text-green-900 dark:text-green-100">
                {formatCurrency(results.netCost)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Projection summary sub-component
 */
const ProjectionSummary = memo(function ProjectionSummary({
  results,
  formData,
  formatCurrency
}: {
  results: PensionContribution;
  formData: PensionFormData;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
      <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
        Projected at Retirement
      </h4>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-purple-700 dark:text-purple-300">
            Total Pension Pot:
          </span>
          <span className="font-bold text-xl text-purple-900 dark:text-purple-100">
            {formatCurrency(results.projectedPot)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-purple-700 dark:text-purple-300">
            Est. Annual Pension:
          </span>
          <span className="font-medium text-purple-900 dark:text-purple-100">
            {formatCurrency(results.annualPension)}/year
          </span>
        </div>
        <div className="text-xs text-purple-600 dark:text-purple-400">
          Based on {formData.expectedReturn}% annual return
        </div>
      </div>
    </div>
  );
});

/**
 * Qualifying earnings info sub-component
 */
const QualifyingEarningsInfo = memo(function QualifyingEarningsInfo({
  formatCurrency
}: {
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <InfoIcon size={16} className="text-gray-500 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Qualifying Earnings Band 2024/25
          </h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div>• Lower limit: {formatCurrency(WorkplacePensionService.LOWER_EARNINGS_LIMIT)}</div>
            <div>• Upper limit: {formatCurrency(WorkplacePensionService.UPPER_EARNINGS_LIMIT)}</div>
            <div>• Contributions calculated on earnings between these limits</div>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Auto-enrollment status sub-component
 */
const AutoEnrollmentStatus = memo(function AutoEnrollmentStatus({
  meetsMinimumContribution
}: {
  meetsMinimumContribution: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${
      meetsMinimumContribution 
        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex items-start gap-2">
        {meetsMinimumContribution ? (
          <>
            <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                Meets Auto-Enrollment Requirements
              </h4>
              <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                Your pension meets the minimum 8% total contribution with at least 3% from employer.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircleIcon size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Below Auto-Enrollment Minimum
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                Consider increasing contributions to meet the 8% minimum (with 3% from employer).
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
});