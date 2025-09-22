/**
 * 401k Contribution Results Component
 * Displays calculated results and projections
 */

import React, { useEffect } from 'react';
import { InfoIcon, AlertCircleIcon } from '../../icons';
import { useRegionalCurrency } from '../../../hooks/useRegionalSettings';
import InfoCard from './InfoCard';
import type { Contribution401k, Retirement401kFormData } from '../../../services/retirement401kService';
import { useLogger } from '../services/ServiceProvider';

interface ContributionResultsProps {
  results: Contribution401k;
  formData: Retirement401kFormData;
  isEligibleForCatchUp: boolean;
  maxContribution: number;
  contributionLimits: { regular: number; catchUp: number };
  isBelowMatchLimit: boolean;
  lostMatchAmount: number;
}

const ContributionResults = React.memo(({
  results,
  formData,
  isEligibleForCatchUp,
  maxContribution,
  contributionLimits,
  isBelowMatchLimit,
  lostMatchAmount
}: ContributionResultsProps) => {
  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="space-y-4">
      {/* Annual Contributions */}
      <InfoCard title="Annual Contributions" colorScheme="blue">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm opacity-80">Your Contribution:</span>
            <span className="font-medium">{formatCurrency(results.employeeContribution)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm opacity-80">Employer Match:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              +{formatCurrency(results.employerMatch)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-current opacity-20">
            <span className="text-sm font-medium">Total:</span>
            <span className="font-bold">{formatCurrency(results.totalAnnualContribution)}</span>
          </div>
        </div>
      </InfoCard>

      {/* Tax Benefits */}
      <InfoCard title="Tax Benefits" colorScheme="green">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm opacity-80">Tax Savings:</span>
            <span className="font-medium">{formatCurrency(results.taxSavings)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm opacity-80">Net Cost to You:</span>
            <span className="font-medium">{formatCurrency(results.netCost)}</span>
          </div>
        </div>
      </InfoCard>

      {/* Projected Balance */}
      <InfoCard title="Projected at Retirement" colorScheme="purple">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm opacity-80">Age {formData.retirementAge} Balance:</span>
            <span className="font-bold text-xl">{formatCurrency(results.projectedBalance)}</span>
          </div>
          <div className="text-xs opacity-60">
            Based on {formData.expectedReturn}% annual return
          </div>
        </div>
      </InfoCard>

      {/* IRS Limits */}
      <InfoCard title="2024 IRS Contribution Limits" colorScheme="gray">
        <div className="flex items-start gap-2">
          <InfoIcon size={16} className="opacity-50 mt-0.5" />
          <div className="flex-1 space-y-1 text-xs opacity-80">
            <div>• Regular limit: {formatCurrency(contributionLimits.regular)}</div>
            {isEligibleForCatchUp && (
              <div>• Catch-up (50+): +{formatCurrency(contributionLimits.catchUp)}</div>
            )}
            <div>• Your max: {formatCurrency(maxContribution)}</div>
          </div>
        </div>
      </InfoCard>

      {/* Match Alert */}
      {isBelowMatchLimit && (
        <InfoCard title="Maximize Your Match!" colorScheme="amber">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="opacity-60 mt-0.5" />
            <p className="text-xs opacity-80">
              Increase your contribution to {formData.employerMatchLimit}% to get the full employer match.
              That's an extra {formatCurrency(lostMatchAmount)} per year in free money!
            </p>
          </div>
        </InfoCard>
      )}
    </div>
  );
});

ContributionResults.displayName = 'ContributionResults';

export default ContributionResults;