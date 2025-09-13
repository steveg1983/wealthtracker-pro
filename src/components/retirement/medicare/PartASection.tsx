import { memo, useEffect } from 'react';
import { HeartIcon as Heart, InfoIcon as Info } from '../../icons';
import { PART_A_2024, MedicareCalculationService } from '../../../services/medicareCalculationService';
import type { MedicarePlan } from '../../../services/medicareCalculationService';
import { logger } from '../../../services/loggingService';

interface PartASectionProps {
  plan: MedicarePlan;
  onUpdatePlan: (updates: Partial<MedicarePlan>) => void;
}

/**
 * Medicare Part A section component
 * Handles hospital insurance configuration
 */
export const PartASection = memo(function PartASection({
  plan,
  onUpdatePlan
}: PartASectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PartASection component initialized', {
      componentName: 'PartASection'
    });
  }, []);

  const formatCurrency = MedicareCalculationService.formatCurrency;

  return (
    <div className="border-b pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-5 w-5 text-red-500" />
        <h4 className="font-medium text-gray-900">Part A - Hospital Insurance</h4>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work History (Quarters of Coverage)
          </label>
          <select
            value={plan.partA.coverage}
            onChange={(e) => onUpdatePlan({
              partA: { ...plan.partA, coverage: Number(e.target.value) }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <option value={40}>40+ quarters (Premium-free)</option>
            <option value={30}>30-39 quarters ({formatCurrency(PART_A_2024.premiums[30])}/month)</option>
            <option value={0}>Less than 30 quarters ({formatCurrency(PART_A_2024.premiums[0])}/month)</option>
          </select>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-gray-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p>Part A Deductible: {formatCurrency(PART_A_2024.deductible)} per benefit period</p>
              <p className="mt-1">Coinsurance: Days 61-90: {formatCurrency(PART_A_2024.coinsurance.days_61_90)}/day</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});