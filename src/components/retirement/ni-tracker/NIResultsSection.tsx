import { memo, useEffect } from 'react';
import { 
  CheckCircleIcon as CheckCircle,
  PoundSterlingIcon as PoundSterling,
  TrendingUpIcon as TrendingUp
} from '../../icons';
import { NITrackerService, STATE_PENSION_2024, type NICalculationResults } from '../../../services/niTrackerService';
import { logger } from '../../../services/loggingService';

interface NIResultsSectionProps {
  results: NICalculationResults;
}

/**
 * NI Results Section component
 * Displays calculation results and pension estimates
 */
export const NIResultsSection = memo(function NIResultsSection({
  results
}: NIResultsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NIResultsSection component initialized', {
      componentName: 'NIResultsSection'
    });
  }, []);

  const formatCurrency = NITrackerService.formatCurrency;

  return (
    <div className="space-y-4">
      {/* NI Record Summary */}
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

      {/* Estimated State Pension */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <PoundSterling className="h-5 w-5 text-gray-600" />
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
            <div className="text-3xl font-bold text-gray-600 mb-2">
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
                  className="bg-gray-600 h-2 rounded-full"
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

      {/* Voluntary Contributions */}
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
                    Payback period: {NITrackerService.calculatePaybackPeriod(
                      results.costToBuyGaps, 
                      results.additionalPensionFromBuying
                    ).toFixed(1)} years
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});