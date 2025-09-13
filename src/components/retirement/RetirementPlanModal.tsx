import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { FinancialPlan, FinancialPlanCreate } from '../../types/financial-plans';
import { useApp } from '../../contexts/AppContextSupabase';
import { useRealFinancialData } from '../../hooks/useRealFinancialData';
import { useRegionalCurrency } from '../../hooks/useRegionalCurrency';
import { logger } from '../../services/loggingService';

interface RetirementPlanModalProps {
  plan: FinancialPlan | null;
  onClose: () => void;
  onSave: (plan: FinancialPlanCreate) => void;
}

export function RetirementPlanModal({ plan, onClose, onSave }: RetirementPlanModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('RetirementPlanModal component initialized', {
      componentName: 'RetirementPlanModal'
    });
  }, []);

  const { formatCurrency: formatRegionalCurrency } = useRegionalCurrency();
  const financialData = useRealFinancialData();
  const { accounts, user } = useApp();
  
  // Calculate total retirement savings from accounts
  const totalRetirementSavings = accounts
    .filter(acc => acc.type === 'investment' || acc.type === 'assets')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    currentAge: plan?.data?.currentAge || 35,
    retirementAge: plan?.data?.retirementAge || 65,
    currentSavings: plan?.data?.currentSavings || totalRetirementSavings || 0,
    monthlyContribution: plan?.data?.monthlyContribution || 0,
    expectedReturn: plan?.data?.expectedReturn || 0.07,
    inflationRate: plan?.data?.inflationRate || 0.025,
    targetRetirementIncome: plan?.data?.targetRetirementIncome || financialData?.monthlyIncome.toNumber() || 0
  });
  
  // Calculate inflation-adjusted target income
  const yearsToRetirement = formData.retirementAge - formData.currentAge;
  const inflationMultiplier = Math.pow(1 + formData.inflationRate, yearsToRetirement);
  const futureValueOfTargetIncome = formData.targetRetirementIncome * inflationMultiplier;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      user_id: user?.id || '',
      name: formData.name,
      plan_type: 'retirement',
      region: 'US',
      currency: 'USD',
      is_active: true,
      is_favorite: false,
      data: {
        currentAge: formData.currentAge,
        retirementAge: formData.retirementAge,
        currentSavings: formData.currentSavings,
        monthlyContribution: formData.monthlyContribution,
        expectedReturn: formData.expectedReturn,
        inflationRate: formData.inflationRate,
        targetRetirementIncome: formData.targetRetirementIncome
      }
    });
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      size="lg"
      title={plan ? 'Edit Retirement Plan' : 'Create Retirement Plan'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">
          {plan ? 'Edit Retirement Plan' : 'Create Retirement Plan'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Plan Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="My Retirement Plan"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Current Age
              </label>
              <input
                type="number"
                required
                min="18"
                max="100"
                value={formData.currentAge}
                onChange={(e) => setFormData({ ...formData, currentAge: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Retirement Age
              </label>
              <input
                type="number"
                required
                min={formData.currentAge + 1}
                max="100"
                value={formData.retirementAge}
                onChange={(e) => setFormData({ ...formData, retirementAge: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Current Retirement Savings
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.currentSavings}
              onChange={(e) => setFormData({ ...formData, currentSavings: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Total from retirement accounts: {formatRegionalCurrency(totalRetirementSavings)}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Monthly Contribution
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.monthlyContribution}
              onChange={(e) => setFormData({ ...formData, monthlyContribution: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Target Monthly Retirement Income
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.targetRetirementIncome}
              onChange={(e) => setFormData({ ...formData, targetRetirementIncome: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Inflation-adjusted value: {formatRegionalCurrency(futureValueOfTargetIncome)}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Expected Annual Return
              </label>
              <input
                type="number"
                required
                min="0"
                max="1"
                step="0.01"
                value={formData.expectedReturn}
                onChange={(e) => setFormData({ ...formData, expectedReturn: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(formData.expectedReturn * 100).toFixed(1)}% per year
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Inflation Rate
              </label>
              <input
                type="number"
                required
                min="0"
                max="1"
                step="0.001"
                value={formData.inflationRate}
                onChange={(e) => setFormData({ ...formData, inflationRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(formData.inflationRate * 100).toFixed(1)}% per year
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {plan ? 'Update' : 'Create'} Plan
          </button>
        </div>
      </form>
    </Modal>
  );
}