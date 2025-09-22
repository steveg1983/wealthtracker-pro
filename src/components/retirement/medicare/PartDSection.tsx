import { memo, useEffect } from 'react';
import { PillIcon as Pill, InfoIcon as Info } from '../../icons';
import { PART_D_2024, MedicareCalculationService } from '../../../services/medicareCalculationService';
import type { MedicarePlan } from '../../../services/medicareCalculationService';
import { useLogger } from '../services/ServiceProvider';

interface PartDSectionProps {
  plan: MedicarePlan;
  onUpdatePlan: (updates: Partial<MedicarePlan>) => void;
}

/**
 * Medicare Part D section component
 * Handles prescription drug coverage configuration
 */
export const PartDSection = memo(function PartDSection({ plan,
  onUpdatePlan
 }: PartDSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PartDSection component initialized', {
      componentName: 'PartDSection'
    });
  }, []);

  const formatCurrency = MedicareCalculationService.formatCurrency;

  return (
    <div className="border-b pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Pill className="h-5 w-5 text-green-500" />
        <h4 className="font-medium text-gray-900">Part D - Prescription Drug Coverage</h4>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="partD"
            checked={plan.partD.enrolled}
            onChange={(e) => onUpdatePlan({
              partD: { ...plan.partD, enrolled: e.target.checked }
            })}
            className="h-4 w-4 text-gray-600"
          />
          <label htmlFor="partD" className="text-sm font-medium text-gray-700">
            Enroll in Part D
          </label>
        </div>

        {plan.partD.enrolled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Premium (Monthly)
              </label>
              <input
                type="number"
                value={plan.partD.planCost}
                onChange={(e) => onUpdatePlan({
                  partD: { ...plan.partD, planCost: Number(e.target.value) || 0 }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                2024 average: {formatCurrency(PART_D_2024.average_premium)}/month
              </p>
            </div>

            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-900">
                  <p className="font-medium">2024 Improvements:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• Insulin capped at $35/month</li>
                    <li>• No cost for recommended vaccines</li>
                    <li>• Expanded Extra Help eligibility</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});