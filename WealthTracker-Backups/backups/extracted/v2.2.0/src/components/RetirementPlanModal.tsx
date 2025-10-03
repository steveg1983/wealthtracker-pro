import React, { useState } from 'react';
import { useRegionalCurrency } from '../hooks/useRegionalSettings';
import { useRealFinancialData } from '../hooks/useRealFinancialData';
import { useApp } from '../contexts/AppContextSupabase';
import { PlusIcon } from './icons';
import type { FinancialPlan, FinancialPlanCreate } from '../services/financialPlanningService';

export default function RetirementPlanModal({
  plan,
  onClose,
  onSave
}: { plan: FinancialPlan | null; onClose: () => void; onSave: (plan: FinancialPlanCreate) => void }): React.JSX.Element {
  const { formatCurrency: formatRegionalCurrency } = useRegionalCurrency();
  const financialData = useRealFinancialData();
  const { accounts } = useApp();

  const totalRetirementSavings = accounts
    .filter(acc => acc.type === 'retirement' || acc.type === 'investment')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const [formData, setFormData] = useState({
    name: plan?.name || '',
    currentAge: (plan?.data as any)?.currentAge || 35,
    retirementAge: (plan?.data as any)?.retirementAge || 65,
    currentSavings: (plan?.data as any)?.currentSavings || totalRetirementSavings || 0,
    monthlyContribution: (plan?.data as any)?.monthlyContribution || 0,
    expectedReturn: (plan?.data as any)?.expectedReturn || 0.07,
    inflationRate: (plan?.data as any)?.inflationRate || 0.025,
    targetRetirementIncome: (plan?.data as any)?.targetRetirementIncome || financialData.monthlyIncome.toNumber() || 0
  });

  const yearsToRetirement = formData.retirementAge - formData.currentAge;
  const inflationMultiplier = Math.pow(1 + formData.inflationRate, yearsToRetirement);
  const futureValueOfTargetIncome = formData.targetRetirementIncome * inflationMultiplier;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      type: 'retirement',
      status: 'active' as const,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {plan ? 'Edit Retirement Plan' : 'Create Retirement Plan'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <PlusIcon size={20} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Plan Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Primary Retirement Plan"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Age
                </label>
                <input
                  type="number"
                  value={formData.currentAge}
                  onChange={(e) => setFormData({ ...formData, currentAge: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="18"
                  max="100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retirement Age
                </label>
                <input
                  type="number"
                  value={formData.retirementAge}
                  onChange={(e) => setFormData({ ...formData, retirementAge: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="50"
                  max="100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Savings
              </label>
              <input
                type="number"
                value={formData.currentSavings || ''}
                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                onChange={(e) => setFormData({ ...formData, currentSavings: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monthly Contribution
              </label>
              <input
                type="number"
                value={formData.monthlyContribution || ''}
                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                onChange={(e) => setFormData({ ...formData, monthlyContribution: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Annual Return (%)
              </label>
              <input
                type="number"
                value={(formData.expectedReturn * 100).toFixed(2)}
                onChange={(e) => setFormData({ ...formData, expectedReturn: Number(e.target.value) / 100 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="20"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inflation Rate (%)
              </label>
              <input
                type="number"
                value={(formData.inflationRate * 100).toFixed(2)}
                onChange={(e) => setFormData({ ...formData, inflationRate: Number(e.target.value) / 100 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="10"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Monthly Income in Retirement <span className="text-xs text-gray-500">(in today's money)</span>
              </label>
              <input
                type="number"
                value={formData.targetRetirementIncome || ''}
                onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                onChange={(e) => setFormData({ ...formData, targetRetirementIncome: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1"
                placeholder="0"
                required
              />
              {formData.targetRetirementIncome > 0 && yearsToRetirement > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Equivalent to <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {formatRegionalCurrency(futureValueOfTargetIncome, { decimals: 0 })}
                  </span> in {formData.retirementAge - formData.currentAge} years
                  ({(formData.inflationRate * 100).toFixed(1)}% inflation)
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
            >
              {plan ? 'Update' : 'Create'} Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

