import React, { useState, useEffect } from 'react';
import { financialPlanningService } from '../services/financialPlanningService';
import { useApp } from '../contexts/AppContextSupabase';
import { useRegionalSettings, useRegionalCurrency } from '../hooks/useRegionalSettings';
import { taxDataService, UKTaxYear } from '../services/taxDataService';
import TaxYearSelector from '../components/financial/TaxYearSelector';
import { 
  CalculatorIcon,
  PiggyBankIcon,
  TrendingUpIcon,
  HomeIcon,
  CreditCardIcon,
  TargetIcon,
  ShieldIcon,
  BarChart3Icon,
  CalendarIcon,
  DollarSignIcon,
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
import type { RetirementPlan, MortgageCalculation, DebtPayoffPlan, FinancialGoal, InsuranceNeed } from '../services/financialPlanningService';
import { logger } from '../services/loggingService';

type ActiveTab = 'overview' | 'tax' | 'retirement' | 'mortgage' | 'debt' | 'goals' | 'insurance' | 'networth';

export default function FinancialPlanning() {
  const { accounts, transactions, budgets } = useApp();
  const regionalSettings = useRegionalSettings();
  const { formatCurrency: formatRegionalCurrency, currencySymbol } = useRegionalCurrency();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [retirementPlans, setRetirementPlans] = useState<RetirementPlan[]>([]);
  const [mortgageCalculations, setMortgageCalculations] = useState<MortgageCalculation[]>([]);
  const [debtPlans, setDebtPlans] = useState<DebtPayoffPlan[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [insuranceNeeds, setInsuranceNeeds] = useState<InsuranceNeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaxYear, setSelectedTaxYear] = useState<UKTaxYear>(taxDataService.getSelectedUKTaxYear());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setRetirementPlans(financialPlanningService.getRetirementPlans());
      setMortgageCalculations(financialPlanningService.getMortgageCalculations());
      setDebtPlans(financialPlanningService.getDebtPlans());
      setFinancialGoals(financialPlanningService.getFinancialGoals());
      setInsuranceNeeds(financialPlanningService.getInsuranceNeeds());
    } catch (error) {
      logger.error('Error loading financial planning data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = () => {
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return formatRegionalCurrency(amount, { decimals: 0 });
  };

  const formatDate = (date: Date) => {
    const format = regionalSettings.region === 'UK' ? 'en-GB' : 'en-US';
    return date.toLocaleDateString(format, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getGoalStatusColor = (goal: FinancialGoal) => {
    const projection = financialPlanningService.calculateGoalProjection(goal);
    return projection.onTrack ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getGoalStatusIcon = (goal: FinancialGoal) => {
    const projection = financialPlanningService.calculateGoalProjection(goal);
    return projection.onTrack ? (
      <CheckCircleIcon size={16} className="text-green-500" />
    ) : (
      <AlertCircleIcon size={16} className="text-red-500" />
    );
  };

  const getInsuranceCoverageStatus = (need: InsuranceNeed) => {
    const coverageRatio = need.currentCoverage / need.recommendedCoverage;
    if (coverageRatio >= 0.9) return { status: 'adequate', color: 'text-green-600 dark:text-green-400' };
    if (coverageRatio >= 0.5) return { status: 'low', color: 'text-yellow-600 dark:text-yellow-400' };
    return { status: 'critical', color: 'text-red-600 dark:text-red-400' };
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
                      {financialGoals.length}
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
                      {insuranceNeeds.length}
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
                      const projection = financialPlanningService.calculateRetirementProjection(plan);
                      return (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{plan.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {projection.yearsToRetirement} years to retirement
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-purple-600 dark:text-purple-400">
                              {formatCurrency(projection.totalSavingsAtRetirement)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">projected</p>
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
                
                {financialGoals.length === 0 ? (
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
                    {financialGoals.slice(0, 3).map((goal) => {
                      const projection = financialPlanningService.calculateGoalProjection(goal);
                      const progress = (goal.currentSavings / goal.targetAmount) * 100;
                      
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
                              {formatCurrency(goal.currentSavings)} of {formatCurrency(goal.targetAmount)}
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {progress.toFixed(1)}%
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-gray-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(progress, 100)}%` }}
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
                      const projection = financialPlanningService.calculateDebtPayoff(plan);
                      return (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{plan.debtName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(plan.currentBalance)} at {(plan.interestRate * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600 dark:text-red-400">
                              {projection.monthsToPayoff} months
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">to payoff</p>
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
                
                {insuranceNeeds.length === 0 ? (
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
                    {insuranceNeeds.slice(0, 3).map((need) => {
                      const status = getInsuranceCoverageStatus(need);
                      return (
                        <div key={need.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white capitalize">{need.type} Insurance</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(need.currentCoverage)} / {formatCurrency(need.recommendedCoverage)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${status.color}`}>
                              {status.status}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              ${need.monthlyPremium}/mo
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
          <InsurancePlanner onDataChange={handleDataChange} />
        )}

        {activeTab === 'networth' && (
          <NetWorthProjector onDataChange={handleDataChange} />
        )}
      </div>
    </PageWrapper>
  );
}