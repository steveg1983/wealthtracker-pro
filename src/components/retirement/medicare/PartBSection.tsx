import { memo, useEffect } from 'react';
import { ShieldIcon as Shield, InfoIcon as Info } from '../../icons';
import { PART_B_2024, MedicareCalculationService } from '../../../services/medicareCalculationService';
import type { MedicarePlan } from '../../../services/medicareCalculationService';
import { logger } from '../../../services/loggingService';

interface PartBSectionProps {
  plan: MedicarePlan;
  partBCost: number;
  onUpdatePlan: (updates: Partial<MedicarePlan>) => void;
}

/**
 * Medicare Part B section component
 * Handles medical insurance configuration
 */
export const PartBSection = memo(function PartBSection({
  plan,
  partBCost,
  onUpdatePlan
}: PartBSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PartBSection component initialized', {
      componentName: 'PartBSection'
    });
  }, []);

  const formatCurrency = MedicareCalculationService.formatCurrency;

  return (
    <div className="border-b pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-gray-500" />
        <h4 className="font-medium text-gray-900">Part B - Medical Insurance</h4>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="partB"
            checked={plan.partB.enrolled}
            onChange={(e) => onUpdatePlan({
              partB: { ...plan.partB, enrolled: e.target.checked }
            })}
            className="h-4 w-4 text-gray-600"
          />
          <label htmlFor="partB" className="text-sm font-medium text-gray-700">
            Enroll in Part B
          </label>
        </div>

        {plan.partB.enrolled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modified Adjusted Gross Income (MAGI)
              </label>
              <input
                type="number"
                value={plan.partB.income}
                onChange={(e) => {
                  const income = Number(e.target.value) || 0;
                  onUpdatePlan({
                    partB: { ...plan.partB, income },
                    partD: { ...plan.partD, income }
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Filing Status
              </label>
              <select
                value={plan.partB.filingStatus}
                onChange={(e) => onUpdatePlan({
                  partB: { ...plan.partB, filingStatus: e.target.value as 'single' | 'married_joint' | 'married_separate' }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
              </select>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-gray-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p>Part B Deductible: {formatCurrency(PART_B_2024.deductible)}/year</p>
                  <p className="mt-1">Standard Premium: {formatCurrency(PART_B_2024.standard_premium)}/month</p>
                  {partBCost > PART_B_2024.standard_premium && (
                    <p className="mt-1 font-medium">IRMAA applies due to income level</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});