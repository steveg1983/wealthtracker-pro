import { memo, useEffect } from 'react';
import { EyeIcon as Eye } from '../../icons';
import type { MedicarePlan } from '../../../services/medicareCalculationService';
import { logger } from '../../../services/loggingService';

interface SupplementalSectionProps {
  plan: MedicarePlan;
  onUpdatePlan: (updates: Partial<MedicarePlan>) => void;
}

/**
 * Medicare supplemental coverage section component
 * Handles Medigap and Medicare Advantage configuration
 */
export const SupplementalSection = memo(function SupplementalSection({
  plan,
  onUpdatePlan
}: SupplementalSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SupplementalSection component initialized', {
      componentName: 'SupplementalSection'
    });
  }, []);

  return (
    <div className="border-b pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="h-5 w-5 text-purple-500" />
        <h4 className="font-medium text-gray-900">Supplemental Coverage</h4>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coverage Type
          </label>
          <select
            value={plan.supplemental.type}
            onChange={(e) => onUpdatePlan({
              supplemental: { ...plan.supplemental, type: e.target.value as 'none' | 'medigap' | 'advantage' }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <option value="none">No Supplemental Coverage</option>
            <option value="medigap">Medigap (Medicare Supplement)</option>
            <option value="advantage">Medicare Advantage (Part C)</option>
          </select>
        </div>

        {plan.supplemental.type !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Premium
            </label>
            <input
              type="number"
              value={plan.supplemental.planCost}
              onChange={(e) => onUpdatePlan({
                supplemental: { ...plan.supplemental, planCost: Number(e.target.value) || 0 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {plan.supplemental.type === 'medigap' 
                ? 'Typical range: $100-$300/month'
                : 'May include Part D coverage'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});