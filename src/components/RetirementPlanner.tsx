import React, { useState, useEffect, useCallback } from 'react';
import { financialPlanningService } from '../services/financialPlanningService';
import { 
  PiggyBankIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  TrendingUpIcon,
  DollarSignIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BarChart3Icon
} from './icons';
import type { RetirementPlan, RetirementProjection } from '../services/financialPlanningService';

interface RetirementPlannerProps {
  onDataChange: () => void;
}

export default function RetirementPlanner({ onDataChange }: RetirementPlannerProps) {
  const [plans, setPlans] = useState<RetirementPlan[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RetirementPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<RetirementPlan | null>(null);
  const [projection, setProjection] = useState<RetirementProjection | null>(null);

  const loadPlans = useCallback(() => {
    const retirementPlans = financialPlanningService.getRetirementPlans();
    setPlans(retirementPlans);
    setSelectedPlan(current => {
      if (retirementPlans.length === 0) {
        return null;
      }
      if (current && retirementPlans.some(plan => plan.id === current.id)) {
        return current;
      }
      return retirementPlans[0];
    });
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selectedPlan) {
      const newProjection = financialPlanningService.calculateRetirementProjection(selectedPlan);
      setProjection(newProjection);
    }
  }, [selectedPlan]);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowCreateModal(true);
  };

  const handleEditPlan = (plan: RetirementPlan) => {
    setEditingPlan(plan);
    setShowCreateModal(true);
  };

  const handleDeletePlan = (plan: RetirementPlan) => {
    if (window.confirm('Are you sure you want to delete this retirement plan?')) {
      financialPlanningService.deleteRetirementPlan(plan.id);
      loadPlans();
      onDataChange();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Retirement Planning</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Plan for your retirement and track your progress
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Create Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <PiggyBankIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No retirement plans yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first retirement plan to get started with planning for your future
          </p>
          <button
            onClick={handleCreatePlan}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            <PlusIcon size={16} />
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Plans</h3>
              <button
                onClick={handleCreatePlan}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <PlusIcon size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlan?.id === plan.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{plan.name}</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPlan(plan);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>Age {plan.currentAge} → {plan.retirementAge}</div>
                    <div>{formatCurrency(plan.monthlyContribution)}/month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Details and Projection */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPlan && projection && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Projected Balance</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(projection.totalSavingsAtRetirement)}
                        </p>
                      </div>
                      <TrendingUpIcon size={24} className="text-green-500" />
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      At retirement in {projection.yearsToRetirement} years
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Income</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(projection.monthlyIncomeAvailable)}
                        </p>
                      </div>
                      <DollarSignIcon size={24} className="text-blue-500" />
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Based on 4% withdrawal rule
                    </div>
                  </div>
                </div>

                {/* Shortfall Alert */}
                {projection.shortfall > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">
                          Monthly Income Shortfall
                        </h4>
                        <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                          You're projected to be {formatCurrency(projection.shortfall)} short of your target monthly income.
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          <strong>Recommendation:</strong> Increase monthly contributions to{' '}
                          <span className="font-semibold">
                            {formatCurrency(projection.recommendedMonthlyContribution)}
                          </span>
                          {' '}to meet your target.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* On Track */}
                {projection.shortfall <= 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">
                          On Track for Retirement
                        </h4>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          Your current savings plan will meet your retirement income target with room to spare.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Plan Details */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3Icon size={20} />
                    Plan Details: {selectedPlan.name}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Current Age:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedPlan.currentAge}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Retirement Age:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{selectedPlan.retirementAge}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Current Savings:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(selectedPlan.currentSavings)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Contribution:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(selectedPlan.monthlyContribution)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Expected Return:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatPercentage(selectedPlan.expectedReturn)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Inflation Rate:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatPercentage(selectedPlan.inflationRate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Target Monthly Income:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(selectedPlan.targetRetirementIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Years to Retirement:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {projection.yearsToRetirement}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Projection Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Retirement Savings Projection
                  </h3>
                  
                  <div className="space-y-4">
                    {projection.projectionsByYear.slice(0, 10).map((year) => (
                      <div key={year.year} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className="w-12 text-sm text-gray-600 dark:text-gray-400">
                            Age {year.age}
                          </div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Year {year.year}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-green-600 dark:text-green-400">
                            +{formatCurrency(year.contribution)}
                          </div>
                          <div className="text-blue-600 dark:text-blue-400">
                            +{formatCurrency(year.growth)}
                          </div>
                          <div className="font-medium text-gray-900 dark:text-white w-24 text-right">
                            {formatCurrency(year.balance)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {projection.projectionsByYear.length > 10 && (
                      <div className="text-center py-2 text-gray-500 dark:text-gray-400">
                        ... and {projection.projectionsByYear.length - 10} more years
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <RetirementPlanModal
          plan={editingPlan}
          onClose={() => setShowCreateModal(false)}
          onSave={(plan) => {
            if (editingPlan) {
              financialPlanningService.updateRetirementPlan(editingPlan.id, plan);
            } else {
              const newPlan = financialPlanningService.addRetirementPlan(plan);
              setSelectedPlan(newPlan);
            }
            setShowCreateModal(false);
            loadPlans();
            onDataChange();
          }}
        />
      )}
    </div>
  );
}

// Retirement Plan Modal Component
interface RetirementPlanModalProps {
  plan: RetirementPlan | null;
  onClose: () => void;
  onSave: (plan: Omit<RetirementPlan, 'id' | 'createdAt' | 'lastUpdated'>) => void;
}

function RetirementPlanModal({ plan, onClose, onSave }: RetirementPlanModalProps) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    currentAge: plan?.currentAge || 35,
    retirementAge: plan?.retirementAge || 65,
    currentSavings: plan?.currentSavings || 0,
    monthlyContribution: plan?.monthlyContribution || 0,
    expectedReturn: plan?.expectedReturn || 0.07,
    inflationRate: plan?.inflationRate || 0.025,
    targetRetirementIncome: plan?.targetRetirementIncome || 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
                value={formData.currentSavings}
                onChange={(e) => setFormData({ ...formData, currentSavings: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="1000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monthly Contribution
              </label>
              <input
                type="number"
                value={formData.monthlyContribution}
                onChange={(e) => setFormData({ ...formData, monthlyContribution: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Annual Return (%)
              </label>
              <input
                type="number"
                value={formData.expectedReturn * 100}
                onChange={(e) => setFormData({ ...formData, expectedReturn: Number(e.target.value) / 100 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="20"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inflation Rate (%)
              </label>
              <input
                type="number"
                value={formData.inflationRate * 100}
                onChange={(e) => setFormData({ ...formData, inflationRate: Number(e.target.value) / 100 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                max="10"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Monthly Income in Retirement
              </label>
              <input
                type="number"
                value={formData.targetRetirementIncome}
                onChange={(e) => setFormData({ ...formData, targetRetirementIncome: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="0"
                step="100"
                required
              />
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
