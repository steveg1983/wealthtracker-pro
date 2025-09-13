import { memo, useEffect } from 'react';
import { DollarSignIcon as DollarSign } from '../../icons';
import { MedicareCalculationService } from '../../../services/medicareCalculationService';
import type { MedicarePlan, MedicareCosts } from '../../../services/medicareCalculationService';
import { logger } from '../../../services/loggingService';

interface CostSummaryProps {
  plan: MedicarePlan;
  costs: MedicareCosts;
}

/**
 * Medicare cost summary component
 * Displays calculated costs breakdown
 */
export const CostSummary = memo(function CostSummary({
  plan,
  costs
}: CostSummaryProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('CostSummary component initialized', {
      componentName: 'CostSummary'
    });
  }, []);

  const formatCurrency = MedicareCalculationService.formatCurrency;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-6 w-6 text-gray-600" />
        <h4 className="text-lg font-semibold text-gray-900">Estimated Medicare Costs</h4>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-blue-100">
          <span className="text-gray-700">Part A (Hospital)</span>
          <span className="font-medium text-gray-900">{formatCurrency(costs.partA)}/month</span>
        </div>
        
        {plan.partB.enrolled && (
          <div className="flex justify-between items-center py-2 border-b border-blue-100">
            <span className="text-gray-700">Part B (Medical)</span>
            <span className="font-medium text-gray-900">{formatCurrency(costs.partB)}/month</span>
          </div>
        )}
        
        {plan.partD.enrolled && (
          <div className="flex justify-between items-center py-2 border-b border-blue-100">
            <span className="text-gray-700">Part D (Prescription)</span>
            <span className="font-medium text-gray-900">{formatCurrency(costs.partD)}/month</span>
          </div>
        )}
        
        {plan.supplemental.type !== 'none' && (
          <div className="flex justify-between items-center py-2 border-b border-blue-100">
            <span className="text-gray-700">
              {plan.supplemental.type === 'medigap' ? 'Medigap' : 'Medicare Advantage'}
            </span>
            <span className="font-medium text-gray-900">{formatCurrency(costs.supplemental)}/month</span>
          </div>
        )}

        <div className="pt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Monthly</span>
            <span className="text-lg font-bold text-gray-600">{formatCurrency(costs.total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Annual</span>
            <span className="text-lg font-bold text-gray-600">{formatCurrency(costs.annual)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-white rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> These are estimated costs based on 2024 Medicare rates. 
          Actual costs may vary based on your specific plan choices, health needs, and location. 
          This calculator does not include out-of-pocket costs like deductibles, copayments, or coinsurance.
        </p>
      </div>
    </div>
  );
});