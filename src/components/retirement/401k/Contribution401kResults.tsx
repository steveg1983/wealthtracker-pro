import React, { useEffect, memo } from 'react';
import { AlertCircleIcon } from '../../icons';
import type { Contribution401k, Retirement401kFormData } from './types';
import { retirement401kService } from '../../../services/retirement401kService';
import { useLogger } from '../services/ServiceProvider';

interface Contribution401kResultsProps {
  results: Contribution401k;
  formData: Retirement401kFormData;
  formatCurrency: (value: number) => string;
}

export const Contribution401kResults = memo(function Contribution401kResults({ results,
  formData,
  formatCurrency
 }: Contribution401kResultsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('Contribution401kResults component initialized', {
      componentName: 'Contribution401kResults'
    });
  }, []);

  const lostMatch = retirement401kService.calculateLostMatch(
    formData.annualSalary,
    formData.contributionPercent,
    formData.employerMatchPercent,
    formData.employerMatchLimit
  );

  return (
    <>
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
            <span className="text-sm text-blue-700 dark:text-gray-300">Employer Match:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              +{formatCurrency(results.employerMatch)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
            <span className="text-sm font-medium text-blue-700 dark:text-gray-300">Total:</span>
            <span className="font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(results.totalAnnualContribution)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
        <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">
          Tax Benefits
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-green-700 dark:text-green-300">Tax Savings:</span>
            <span className="font-medium text-green-900 dark:text-green-100">
              {formatCurrency(results.taxSavings)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-green-700 dark:text-green-300">Net Cost to You:</span>
            <span className="font-medium text-green-900 dark:text-green-100">
              {formatCurrency(results.netCost)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
        <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">
          Projected at Retirement
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-purple-700 dark:text-purple-300">
              Age {formData.retirementAge} Balance:
            </span>
            <span className="font-bold text-xl text-purple-900 dark:text-purple-100">
              {formatCurrency(results.projectedBalance)}
            </span>
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            Based on {formData.expectedReturn}% annual return
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {lostMatch > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Maximize Your Match!
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                Increase your contribution to {formData.employerMatchLimit}% to get the full employer match.
                That's an extra {formatCurrency(lostMatch)} per year in free money!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});