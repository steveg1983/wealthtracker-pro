import { memo, useEffect } from 'react';
import { AlertCircleIcon } from '../../icons';
import { SIPPCalculatorService } from '../../../services/sippCalculatorService';
import { useLogger } from '../services/ServiceProvider';

interface SIPPWarningsProps {
  currentAge: number;
  monthlyContribution: number;
  employerContribution: number;
  formatCurrency: (amount: number) => string;
}

/**
 * SIPP warnings component
 */
export const SIPPWarnings = memo(function SIPPWarnings({ currentAge,
  monthlyContribution,
  employerContribution,
  formatCurrency
 }: SIPPWarningsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SIPPWarnings component initialized', {
      componentName: 'SIPPWarnings'
    });
  }, []);

  const { canAccessNow, yearsUntilAccess } = SIPPCalculatorService.canAccessPension(currentAge);
  const isAllowanceExceeded = SIPPCalculatorService.isAnnualAllowanceExceeded(
    monthlyContribution,
    employerContribution
  );

  return (
    <>
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
                You can access your pension from age {SIPPCalculatorService.MINIMUM_PENSION_AGE}. 
                You have {yearsUntilAccess} years until you can access your SIPP.
                Note: The minimum pension age will increase to 57 in 2028.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Annual Allowance Check */}
      {isAllowanceExceeded && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Annual Allowance Exceeded
              </p>
              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                Your total annual contributions exceed the {formatCurrency(SIPPCalculatorService.ANNUAL_ALLOWANCE)} annual allowance.
                Contributions above this limit won't receive tax relief and may incur charges.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});