import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { financialPlanningService } from '../services/financialPlanningService';
import { useApp } from '../contexts/AppContextSupabase';
import { useRegionalSettings, useRegionalCurrency } from '../hooks/useRegionalSettings';
import { Decimal, toDecimal } from '@wealthtracker/utils';
import { taxDataService } from '../services/taxDataService';
import type { UKTaxYear } from '../services/taxDataService';
import TaxYearSelector from '../components/financial/TaxYearSelector';
import { 
  PiggyBankIcon,
  CreditCardIcon,
  TargetIcon,
  ShieldIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import RetirementPlanner from '../components/RetirementPlanner';
import MortgageCalculatorNew from '../components/MortgageCalculatorNew';
import DebtPayoffPlanner from '../components/DebtPayoffPlanner';
import FinancialGoalTracker from '../components/FinancialGoalTracker';
import InsurancePlanner from '../components/InsurancePlanner';
import NetWorthProjector from '../components/NetWorthProjector';
import TaxCalculator from '../components/TaxCalculator';
import { logger } from '../services/loggingService';
import type { FinancialPlan } from '../types/financial-plans';
import { useUserId } from '../hooks/useUserId';
import type { Goal } from '../types';

type ActiveTab = 'overview' | 'tax' | 'retirement' | 'mortgage' | 'debt' | 'goals' | 'insurance' | 'networth';

export default function FinancialPlanning() {
  const { goals } = useApp();
  const regionalSettings = useRegionalSettings();
  const { formatCurrency: formatRegionalCurrency } = useRegionalCurrency();
  const { clerkId } = useUserId();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [financialPlans, setFinancialPlans] = useState<FinancialPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaxYear, setSelectedTaxYear] = useState<UKTaxYear>(taxDataService.getSelectedUKTaxYear());
  const loadData = useCallback(async () => {
    if (!clerkId) {
      setFinancialPlans([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const plans = await financialPlanningService.getFinancialPlans(clerkId);
      setFinancialPlans(plans ?? []);
    } catch (error) {
      logger.error('Error loading financial planning data:', error);
      setFinancialPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [clerkId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDataChange = useCallback(() => {
    void loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return formatRegionalCurrency(amount);
  };

  const retirementPlans = useMemo(
    () => financialPlans.filter(plan => plan.plan_type === 'retirement'),
    [financialPlans]
  );

  const debtPlans = useMemo(
    () => financialPlans.filter(plan => plan.plan_type === 'investment'),
    [financialPlans]
  );

  const insurancePlans = useMemo(
    () => financialPlans.filter(plan => plan.plan_type === 'insurance'),
    [financialPlans]
  );

  type RetirementPlanData = {
    currentAge?: number;
    retirementAge?: number;
    currentSavings?: number;
    monthlyContribution?: number;
    expectedReturn?: number;
    inflationRate?: number;
    targetRetirementIncome?: number;
    projection?: {
      yearsToRetirement?: number;
      totalSavingsAtRetirement?: number;
      monthlyIncomeAvailable?: number;
    };
  };

  const getRetirementSummary = (plan: FinancialPlan) => {
    const data = (plan.data ?? {}) as RetirementPlanData;
    const projection = data.projection ?? {};
    const yearsToRetirement = typeof projection.yearsToRetirement === 'number'
      ? projection.yearsToRetirement
      : typeof data.retirementAge === 'number' && typeof data.currentAge === 'number'
        ? Math.max(0, data.retirementAge - data.currentAge)
        : null;
    const totalSavings = typeof projection.totalSavingsAtRetirement === 'number'
      ? projection.totalSavingsAtRetirement
      : typeof data.currentSavings === 'number'
        ? data.currentSavings
        : null;

    return { yearsToRetirement, totalSavings };
  };

  type DebtPlanData = {
    totalDebt?: number;
    debtAccounts?: Array<{
      accountName?: string;
      balance?: number;
      apr?: number;
    }>;
    projection?: {
      totalMonths?: number;
      monthsToPayoff?: number;
    };
    strategy?: string;
  };

  const getDebtSummary = (plan: FinancialPlan) => {
    const data = (plan.data ?? {}) as DebtPlanData;
    const accountsData = Array.isArray(data.debtAccounts) ? data.debtAccounts : [];
    const totalDebt = typeof data.totalDebt === 'number'
      ? data.totalDebt
      : accountsData.reduce((sum, account) => sum + (account.balance ?? 0), 0);
    const projection = data.projection ?? {};
    const monthsToPayoff = typeof projection.totalMonths === 'number'
      ? projection.totalMonths
      : typeof projection.monthsToPayoff === 'number'
        ? projection.monthsToPayoff
        : null;
    const averageApr = accountsData.length > 0
      ? accountsData.reduce((sum, account) => sum + (account.apr ?? 0), 0) / accountsData.length
      : null;

    return { totalDebt, monthsToPayoff, averageApr };
  };

  type InsurancePlanData = {
    type?: string;
    currentCoverage?: number;
    recommendedCoverage?: number;
    coverageAmount?: number;
    monthlyPremium?: number;
    annualPremium?: number;
  };

  const getInsuranceCoverageStatus = (plan: FinancialPlan) => {
    const data = (plan.data ?? {}) as InsurancePlanData;
    const currentCoverage = data.currentCoverage ?? data.coverageAmount ?? 0;
    const recommendedCoverage = data.recommendedCoverage ?? currentCoverage;
    const monthlyPremium = data.monthlyPremium ?? (data.annualPremium ? data.annualPremium / 12 : 0);

    const ratio = recommendedCoverage > 0 ? currentCoverage / recommendedCoverage : 1;
    if (ratio >= 0.9) {
      return { status: 'adequate', color: 'text-green-600 dark:text-green-400', monthlyPremium };
    }
    if (ratio >= 0.5) {
      return { status: 'low', color: 'text-yellow-600 dark:text-yellow-400', monthlyPremium };
    }
    return { status: 'critical', color: 'text-red-600 dark:text-red-400', monthlyPremium };
  };

  const evaluateGoalProgress = (goal: Goal) => {
    const targetDecimal = toDecimal(goal.targetAmount ?? 0);
    const currentDecimal = toDecimal(goal.currentAmount ?? 0);
    const remainingDecimal = Decimal.max(0, targetDecimal.minus(currentDecimal));
    const contributionDecimal = toDecimal(goal.contributionAmount ?? 0);
    const progressDecimal = targetDecimal.greaterThan(0)
      ? Decimal.min(currentDecimal.dividedBy(targetDecimal).times(100), toDecimal(100))
      : toDecimal(0);
    const progress = progressDecimal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    const now = new Date();
    const dueDate = goal.targetDate ? new Date(goal.targetDate) : null;

    if (!dueDate) {
      return { onTrack: contributionDecimal.greaterThan(0) || remainingDecimal.isZero(), progress };
    }

    if (remainingDecimal.lessThanOrEqualTo(0)) {
      return { onTrack: true, progress: 100 };
    }

    if (contributionDecimal.lessThanOrEqualTo(0)) {
      return { onTrack: false, progress };
    }

    const millisecondsPerMonth = 1000 * 60 * 60 * 24 * 30;
    const monthsUntilDueDecimal = Decimal.max(
      0,
      toDecimal(dueDate.getTime())
        .minus(now.getTime())
        .dividedBy(millisecondsPerMonth)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
    );
    const monthsNeededDecimal = remainingDecimal.dividedBy(contributionDecimal).ceil();
    const onTrack = monthsNeededDecimal.lessThanOrEqualTo(monthsUntilDueDecimal);

    return { onTrack, progress };
  };

  const getGoalStatusColor = (goal: Goal) => {
    const status = evaluateGoalProgress(goal);
    return status.onTrack ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getGoalStatusIcon = (goal: Goal) => {
    const status = evaluateGoalProgress(goal);
    return status.onTrack ? (
      <CheckCircleIcon size={16} className="text-green-500" />
    ) : (
      <AlertCircleIcon size={16} className="text-red-500" />
    );
  };

  const formatDate = (date: Date) => {
    const format = regionalSettings.region === 'UK' ? 'en-GB' : 'en-US';
    return date.toLocaleDateString(format, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <PageWrapper title="Financial Planning">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading financial planning data...</div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Financial Planning">
      <div>
        {/* Header */}
        <div 
          className="rounded-2xl p-4 mb-6 text-gray-600 dark:text-gray-300 shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59, 130, 246, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-lg">
              Plan for retirement, calculate mortgages, and achieve your financial goals
            </p>
            {regionalSettings.region === 'UK' && (
              <TaxYearSelector 
                value={selectedTaxYear}
                onChange={setSelectedTaxYear}
              />
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex justify-center gap-8 px-6 py-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'overview'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('tax')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'tax'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Tax Calculator
              </button>
              <button
                onClick={() => setActiveTab('retirement')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'retirement'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Retirement
              </button>
              <button
                onClick={() => setActiveTab('mortgage')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'mortgage'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Mortgage
              </button>
              <button
                onClick={() => setActiveTab('debt')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'debt'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Debt Payoff
              </button>
              <button
                onClick={() => setActiveTab('goals')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'goals'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Goals
              </button>
              <button
                onClick={() => setActiveTab('insurance')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'insurance'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Insurance
              </button>
              <button
                onClick={() => setActiveTab('networth')}
                className={`py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === 'networth'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Net Worth
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Retirement Plans</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {retirementPlans.length}
                    </p>
                  </div>
                  <PiggyBankIcon size={24} className="text-purple-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Goals</p>
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                      {goals.length}
                    </p>
                  </div>
                  <TargetIcon size={24} className="text-blue-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Debt Plans</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {debtPlans.length}
                    </p>
                  </div>
                  <CreditCardIcon size={24} className="text-red-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Insurance Items</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {insurancePlans.length}
                    </p>
                  </div>
                  <ShieldIcon size={24} className="text-green-500" />
                </div>
              </div>
            </div>

            {/* Active Plans Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Retirement Plans */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <PiggyBankIcon size={20} className="text-purple-600 dark:text-purple-400" />
                    Retirement Plans
                  </h3>
                  <button
                    onClick={() => setActiveTab('retirement')}
                    className="text-sm text-gray-600 dark:text-gray-500 hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRightIcon size={14} />
                  </button>
                </div>
                
                {retirementPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No retirement plans yet</p>
                    <button
                      onClick={() => setActiveTab('retirement')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Create Plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {retirementPlans.slice(0, 3).map((plan) => {
                      const summary = getRetirementSummary(plan);
                      return (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{plan.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {summary.yearsToRetirement != null
                                ? `${summary.yearsToRetirement} years to retirement`
                                : 'Timeline not available'}
                            </p>
                          </div>
                          <div className="text-right">
                            {summary.totalSavings != null ? (
                              <>
                                <p className="font-semibold text-purple-600 dark:text-purple-400">
                                  {formatCurrency(summary.totalSavings)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">projected savings</p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">Projection unavailable</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Financial Goals */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <TargetIcon size={20} className="text-gray-600 dark:text-gray-500" />
                    Financial Goals
                  </h3>
                  <button
                    onClick={() => setActiveTab('goals')}
                    className="text-sm text-gray-600 dark:text-gray-500 hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRightIcon size={14} />
                  </button>
                </div>
                
                {goals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No financial goals yet</p>
                    <button
                      onClick={() => setActiveTab('goals')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                    >
                      Create Goal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.slice(0, 3).map((goal) => {
                      const progress = goal.targetAmount > 0
                        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                        : 0;

                      return (
                        <div key={goal.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white">{goal.name}</p>
                              {getGoalStatusIcon(goal)}
                            </div>
                            <span className={`text-sm font-medium ${getGoalStatusColor(goal)}`}>
                              {formatDate(goal.targetDate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {toDecimal(progress)
                                .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
                                .toString()}%
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-gray-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Debt Plans and Insurance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Debt Plans */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCardIcon size={20} className="text-red-600 dark:text-red-400" />
                    Debt Payoff Plans
                  </h3>
                  <button
                    onClick={() => setActiveTab('debt')}
                    className="text-sm text-gray-600 dark:text-gray-500 hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRightIcon size={14} />
                  </button>
                </div>
                
                {debtPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No debt plans yet</p>
                    <button
                      onClick={() => setActiveTab('debt')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      Create Plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {debtPlans.slice(0, 3).map((plan) => {
                      const summary = getDebtSummary(plan);
                      const strategy = ((plan.data ?? {}) as DebtPlanData).strategy;

                      return (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{plan.name || 'Debt Plan'}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(summary.totalDebt)} total debt
                              {summary.averageApr != null && (
                                <span className="ml-2">
                                  • Avg APR{' '}
                                  {toDecimal(summary.averageApr ?? 0)
                                    .times(100)
                                    .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
                                    .toString()}
                                  %
                                </span>
                              )}
                              {strategy && (
                                <span className="ml-2">• {strategy}</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            {summary.monthsToPayoff != null ? (
                              <>
                                <p className="font-semibold text-red-600 dark:text-red-400">
                                  {summary.monthsToPayoff} months
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">to payoff</p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">Projection unavailable</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Insurance Overview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldIcon size={20} className="text-green-600 dark:text-green-400" />
                    Insurance Coverage
                  </h3>
                  <button
                    onClick={() => setActiveTab('insurance')}
                    className="text-sm text-gray-600 dark:text-gray-500 hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRightIcon size={14} />
                  </button>
                </div>
                
                {insurancePlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No insurance plans yet</p>
                    <button
                      onClick={() => setActiveTab('insurance')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Add Insurance
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insurancePlans.slice(0, 3).map((plan) => {
                      const status = getInsuranceCoverageStatus(plan);
                      const data = (plan.data ?? {}) as InsurancePlanData;
                      const coverageLabel = formatCurrency(data.currentCoverage ?? data.coverageAmount ?? 0);
                      const recommendedLabel = formatCurrency(data.recommendedCoverage ?? data.coverageAmount ?? 0);
                      const planType = data.type ? data.type.replace(/-/g, ' ') : 'Insurance';

                      return (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white capitalize">{planType}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {coverageLabel} / {recommendedLabel}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${status.color}`}>
                              {status.status}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(status.monthlyPremium ?? 0)}/mo
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tax' && (
          <TaxCalculator />
        )}
        {activeTab === 'retirement' && (
          <RetirementPlanner onDataChange={handleDataChange} />
        )}

        {activeTab === 'mortgage' && (
          <MortgageCalculatorNew />
        )}

        {activeTab === 'debt' && (
          <DebtPayoffPlanner onDataChange={handleDataChange} />
        )}

        {activeTab === 'goals' && (
          <FinancialGoalTracker onDataChange={handleDataChange} />
        )}

        {activeTab === 'insurance' && (
          <InsurancePlanner />
        )}

        {activeTab === 'networth' && (
          <NetWorthProjector onDataChange={handleDataChange} />
        )}
      </div>
    </PageWrapper>
  );
}
