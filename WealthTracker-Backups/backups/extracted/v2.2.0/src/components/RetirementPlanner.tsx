import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { financialPlanningService } from '../services/financialPlanningService';
import { logger } from '../services/loggingService';
import { useRegionalSettings, useRegionalCurrency } from '../hooks/useRegionalSettings';
import { useApp } from '../contexts/AppContextSupabase';
import { useAuth } from '@clerk/clerk-react';
import { useRealFinancialData } from '../hooks/useRealFinancialData';
import Decimal from 'decimal.js';
import StatePensionCalculator from './retirement/StatePensionCalculator';
import SocialSecurityOptimizer from './retirement/SocialSecurityOptimizer';
import Retirement401kCalculator from './retirement/Retirement401kCalculator';
import WorkplacePensionCalculator from './retirement/WorkplacePensionCalculator';
import IRAComparisonCalculator from './retirement/IRAComparisonCalculator';
import ISACalculator from './retirement/ISACalculator';
import MedicarePlanningCalculator from './retirement/MedicarePlanningCalculator';
import RMDCalculator from './retirement/RMDCalculator';
import NIYearsTracker from './retirement/NIYearsTracker';
import RetirementDisclaimer from './retirement/RetirementDisclaimer';
import StateTaxCalculator from './retirement/StateTaxCalculator';
import SIPPCalculator from './retirement/SIPPCalculator';
import { 
  PiggyBankIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  TrendingUpIcon,
  CalendarIcon,
  DollarSignIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  BarChart3Icon
} from './icons';
import RetirementPlanModal from './RetirementPlanModal';
import type { FinancialPlan, FinancialPlanCreate } from '../services/financialPlanningService';

// Types for retirement calculations
interface RetirementProjection {
  totalSavingsAtRetirement: number;
  monthlyIncomeAvailable: number;
  yearsToRetirement: number;
  shortfall: number;
  recommendedMonthlyContribution: number;
  totalContributions: number;
  totalGrowth: number;
  projectionsByYear: Array<{
    year: number;
    age: number;
    contribution: number;
    growth: number;
    balance: number;
  }>;
}

interface RetirementPlannerProps {
  onDataChange: () => void;
}

const RetirementPlanner = memo(function RetirementPlanner({ onDataChange }: RetirementPlannerProps) {
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FinancialPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FinancialPlan | null>(null);
  const [projection, setProjection] = useState<RetirementProjection | null>(null);
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { region } = useRegionalSettings();
  const { formatCurrency: formatRegionalCurrency } = useRegionalCurrency();
  const { user } = useAuth();
  const { accounts } = useApp();
  const financialData = useRealFinancialData();

  useEffect(() => {
    if (user?.id) {
      loadPlans();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedPlan) {
      calculateProjection(selectedPlan);
    }
  }, [selectedPlan]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProjectionModal(false);
      }
    };
    if (showProjectionModal) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showProjectionModal]);

  const loadPlans = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const retirementPlans = await financialPlanningService.getFinancialPlans(user.id, {
        type: 'retirement'
      });
      setPlans(retirementPlans || []);
      if (retirementPlans && retirementPlans.length > 0 && !selectedPlan) {
        setSelectedPlan(retirementPlans[0]);
      }
    } catch (error) {
      console.error('Error loading retirement plans:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const calculateProjection = (plan: FinancialPlan) => {
    if (!plan.data) return;
    
    const currentAge = plan.data.currentAge || 35;
    const retirementAge = plan.data.retirementAge || 65;
    const currentSavings = plan.data.currentSavings || 0;
    const monthlyContribution = plan.data.monthlyContribution || 0;
    const expectedReturn = plan.data.expectedReturn || 0.07;
    const inflationRate = plan.data.inflationRate || 0.025;
    const targetIncome = plan.data.targetRetirementIncome || 0;
    
    const yearsToRetirement = retirementAge - currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyReturn = expectedReturn / 12;
    
    // Calculate future value of current savings
    let balance = new Decimal(currentSavings);
    const projectionsByYear: RetirementProjection['projectionsByYear'] = [];
    let totalContributions = new Decimal(0);
    
    for (let year = 1; year <= yearsToRetirement; year++) {
      const yearlyContribution = new Decimal(monthlyContribution).times(12);
      totalContributions = totalContributions.plus(yearlyContribution);
      
      // Calculate growth for the year
      const startBalance = balance;
      balance = balance.times(1 + expectedReturn).plus(yearlyContribution);
      const growth = balance.minus(startBalance).minus(yearlyContribution);
      
      projectionsByYear.push({
        year: new Date().getFullYear() + year,
        age: currentAge + year,
        contribution: yearlyContribution.toNumber(),
        growth: growth.toNumber(),
        balance: balance.toNumber()
      });
    }
    
    const totalSavingsAtRetirement = balance.toNumber();
    const totalGrowth = balance.minus(currentSavings).minus(totalContributions).toNumber();
    
    // Calculate monthly income using 4% rule
    const annualWithdrawal = totalSavingsAtRetirement * 0.04;
    const monthlyIncomeAvailable = annualWithdrawal / 12;
    
    // Calculate shortfall
    const inflationMultiplier = Math.pow(1 + inflationRate, yearsToRetirement);
    const futureTargetIncome = targetIncome * inflationMultiplier;
    const shortfall = Math.max(0, futureTargetIncome - monthlyIncomeAvailable);
    
    // Calculate recommended contribution
    let recommendedMonthlyContribution = monthlyContribution;
    if (shortfall > 0) {
      const requiredTotal = (futureTargetIncome * 12) / 0.04;
      const requiredFV = requiredTotal - currentSavings * Math.pow(1 + expectedReturn, yearsToRetirement);
      const pmt = (requiredFV * monthlyReturn) / (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1);
      recommendedMonthlyContribution = Math.max(monthlyContribution, pmt);
    }
    
    setProjection({
      totalSavingsAtRetirement,
      monthlyIncomeAvailable,
      yearsToRetirement,
      shortfall,
      recommendedMonthlyContribution,
      totalContributions: totalContributions.toNumber(),
      totalGrowth,
      projectionsByYear
    });
  };

  const handleCreatePlan = useCallback(() => {
    setEditingPlan(null);
    setShowCreateModal(true);
  }, []);

  const handleEditPlan = useCallback((plan: RetirementPlan) => {
    setEditingPlan(plan);
    setShowCreateModal(true);
  }, []);

  const handleDeletePlan = useCallback(async (plan: FinancialPlan) => {
    if (!user?.id) return;
    
    if (window.confirm('Are you sure you want to delete this retirement plan?')) {
      try {
        await financialPlanningService.deleteFinancialPlan(user.id, plan.id);
        await loadPlans();
        onDataChange();
        
        // If we deleted the selected plan, select another one
        if (selectedPlan?.id === plan.id) {
          const remainingPlans = plans.filter(p => p.id !== plan.id);
          setSelectedPlan(remainingPlans.length > 0 ? remainingPlans[0] : null);
        }
      } catch (error) {
        logger.error('Error deleting plan:', error);
      }
    }
  }, [user, plans, selectedPlan]);

  const formatCurrency = (amount: number) => {
    return formatRegionalCurrency(amount, { decimals: 0 });
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Retirement Planning</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Plan for your retirement and track your progress
        </p>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Plans</h3>
              <button
                onClick={handleCreatePlan}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={14} />
                Create Plan
              </button>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlan?.id === plan.id
                      ? 'border-[var(--color-primary)] bg-blue-50 dark:bg-gray-900/20'
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
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-500"
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
                    <div>Age {plan.data?.currentAge || 35} → {plan.data?.retirementAge || 65}</div>
                    <div>{formatCurrency(plan.data?.monthlyContribution || 0)}/month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Details and Projection */}
          <div className="lg:col-span-2 space-y-4">
            {selectedPlan && projection && (
              <>
                {/* Summary Cards and Status - Single Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Compact Summary Box */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3">
                    <div className="grid grid-cols-2">
                      <div className="pr-3 border-r border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Projected Balance</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(projection.totalSavingsAtRetirement)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          At retirement in {projection.yearsToRetirement} years
                        </p>
                      </div>
                      <div className="pl-3">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Monthly Income</p>
                        <p className="text-lg font-bold text-gray-600 dark:text-gray-500">
                          {formatCurrency(projection.monthlyIncomeAvailable)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Based on 4% withdrawal rule
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Shortfall/Success Alert */}
                  {projection.shortfall > 0 ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-900 dark:text-red-100 text-sm">
                            Monthly Income Shortfall
                          </h4>
                          <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                            You're projected to be {formatCurrency(projection.shortfall)} short of your target monthly income.
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            <strong>Recommendation:</strong> Increase monthly contributions to{' '}
                            <span className="font-semibold">
                              {formatCurrency(projection.recommendedMonthlyContribution)}
                            </span>
                            {' '}to meet your target.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-green-900 dark:text-green-100 text-sm">
                            On Track for Retirement
                          </h4>
                          <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                            Your current savings plan will meet your retirement income target with room to spare.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Current Plan Details - Condensed */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                    <BarChart3Icon size={16} />
                    Plan Details: {selectedPlan.name}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current Age:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedPlan.data?.currentAge || 35}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPercentage(selectedPlan.data?.expectedReturn || 0.07)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Retirement Age:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedPlan.data?.retirementAge || 65}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Inflation Rate:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPercentage(selectedPlan.data?.inflationRate || 0.025)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current Savings:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(selectedPlan.data?.currentSavings || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Target Monthly Income:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(selectedPlan.data?.targetRetirementIncome || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Monthly Contribution:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(selectedPlan.data?.monthlyContribution || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Years to Retirement:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {projection.yearsToRetirement}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Projection Chart - Scrollable */}
                <div 
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowProjectionModal(true)}
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
                    Retirement Savings Projection
                  </h3>
                  
                  <div className="h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    <div className="space-y-1 text-xs">
                      {projection.projectionsByYear.map((year, index) => (
                        <div key={year.year} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Age {year.age}</span>
                            <span className="text-gray-500 dark:text-gray-500">Year {year.year}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-green-600 dark:text-green-400">+{formatCurrency(year.contribution)}</span>
                            <span className="text-gray-600 dark:text-gray-500">+{formatCurrency(year.growth)}</span>
                            <span className="font-medium text-gray-900 dark:text-white w-20 text-right">
                              {formatCurrency(year.balance)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    Click to view full projection with summary
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Employer-Sponsored Retirement Plans */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {region === 'UK' ? 'Workplace Pension Calculator' : '401(k) Contribution Calculator'}
        </h3>
        <div className="space-y-6">
          {region === 'UK' ? (
            <WorkplacePensionCalculator />
          ) : (
            <Retirement401kCalculator />
          )}
        </div>
      </div>

      {/* Individual Retirement Accounts */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {region === 'UK' ? 'ISA Optimization Calculator' : 'IRA vs Roth IRA Comparison'}
        </h3>
        <div className="space-y-6">
          {region === 'UK' ? (
            <ISACalculator />
          ) : (
            <IRAComparisonCalculator />
          )}
        </div>
      </div>

      {/* Government Retirement Benefits */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {region === 'UK' ? 'UK State Pension Calculator' : 'US Social Security Optimizer'}
        </h3>
        <div className="space-y-6">
          {region === 'UK' ? (
            <StatePensionCalculator />
          ) : (
            <SocialSecurityOptimizer />
          )}
        </div>
      </div>

      {/* Medicare Planning (US) / NI Years Tracker (UK) */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {region === 'UK' ? 'National Insurance Years Tracker' : 'Medicare Planning Calculator'}
        </h3>
        <div className="space-y-6">
          {region === 'UK' ? (
            <NIYearsTracker />
          ) : (
            <MedicarePlanningCalculator />
          )}
        </div>
      </div>

      {/* Required Minimum Distributions (US Only) */}
      {region === 'US' && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Required Minimum Distribution (RMD) Calculator
          </h3>
          <div className="space-y-6">
            <RMDCalculator />
          </div>
        </div>
      )}

      {/* State Tax Calculator (US Only) */}
      {region === 'US' && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            State Tax Impact on Retirement Income
          </h3>
          <div className="space-y-6">
            <StateTaxCalculator />
          </div>
        </div>
      )}

      {/* Personal Pension/SIPP Calculator (UK Only) */}
      {region === 'UK' && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Personal Pension (SIPP) Projection
          </h3>
          <div className="space-y-6">
            <SIPPCalculator />
          </div>
        </div>
      )}

      {/* Retirement Planning Disclaimer */}
      <RetirementDisclaimer />

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <RetirementPlanModal
          plan={editingPlan}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPlan(null);
          }}
          onSave={async (planData) => {
            if (!user?.id) return;
            
            try {
              if (editingPlan) {
                const updatedPlan = await financialPlanningService.updateFinancialPlan(
                  user.id,
                  editingPlan.id,
                  planData
                );
                if (updatedPlan) {
                  setSelectedPlan(updatedPlan);
                }
              } else {
                const newPlan = await financialPlanningService.createFinancialPlan(
                  user.id,
                  planData
                );
                if (newPlan) {
                  setSelectedPlan(newPlan);
                }
              }
              setShowCreateModal(false);
              setEditingPlan(null);
              await loadPlans();
              onDataChange();
            } catch (error) {
              console.error('Error saving plan:', error);
            }
          }}
        />
      )}

      {/* Projection Modal */}
      {showProjectionModal && projection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Full Retirement Savings Projection
                </h3>
                <button
                  onClick={() => setShowProjectionModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <PlusIcon size={20} className="rotate-45" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-2">
                {projection.projectionsByYear.map((year) => (
                  <div key={year.year} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <div className="flex items-center gap-4">
                      <div className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Age {year.age}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Year {year.year}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-green-600 dark:text-green-400">
                        +{formatCurrency(year.contribution)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-500">
                        +{formatCurrency(year.growth)}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white w-28 text-right">
                        {formatCurrency(year.balance)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Total Contributions</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(projection.totalContributions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Total Growth</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(projection.totalGrowth)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Final Balance</p>
                    <p className="font-semibold text-lg text-green-600 dark:text-green-400">
                      {formatCurrency(projection.totalSavingsAtRetirement)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Monthly Income (4% rule)</p>
                    <p className="font-semibold text-lg text-gray-600 dark:text-gray-500">
                      {formatCurrency(projection.monthlyIncomeAvailable)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RetirementPlanner;
