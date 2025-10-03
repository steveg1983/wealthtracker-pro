import React, { useEffect, memo } from 'react';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import type { InsurancePlan } from './types';
import { INSURANCE_ICONS } from './types';
import { useLogger } from '../services/ServiceProvider';

interface PlanCardProps {
  plan: InsurancePlan;
  onEdit: (plan: InsurancePlan) => void;
  onDelete: (planId: string) => void;
}

export const PlanCard = memo(function PlanCard({ plan, onEdit, onDelete  }: PlanCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PlanCard component initialized', {
      componentName: 'PlanCard'
    });
  }, []);

  const { formatCurrency } = useRegionalCurrency();

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="text-2xl mr-2">{INSURANCE_ICONS[plan.type] || '📋'}</span>
          <div>
            <h4 className="font-semibold capitalize">{plan.type.replace('-', ' ')}</h4>
            <p className="text-sm text-gray-600">{plan.provider}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(plan)}
            className="text-gray-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => plan.id && onDelete(plan.id)}
            className="text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      </div>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Coverage:</span>
          <span className="font-medium">{formatCurrency(plan.coverageAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Monthly:</span>
          <span className="font-medium">{formatCurrency(plan.monthlyPremium)}</span>
        </div>
        {plan.deductible > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Deductible:</span>
            <span className="font-medium">{formatCurrency(plan.deductible)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">Renewal:</span>
          <span className="font-medium">
            {new Date(plan.renewalDate).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className={`font-medium ${plan.isActive ? 'text-green-600' : 'text-gray-400'}`}>
            {plan.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
});