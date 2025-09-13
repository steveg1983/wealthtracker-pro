import React, { useEffect, memo } from 'react';
import { PiggyBankIcon, TargetIcon, CreditCardIcon, ShieldIcon, ArrowRightIcon } from '../icons';
// Local view-model types for this UI
interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentSavings: number;
  targetDate: Date;
}

interface DebtPayoffPlan {
  id: string;
  debtName: string;
  currentBalance: number;
  interestRate: number;
}

interface InsuranceNeed {
  id: string;
  type: string;
  currentCoverage: number;
  recommendedCoverage: number;
  monthlyPremium: number;
}

interface RetirementPlan {
  id: string;
  name: string;
}
import type { ActiveTab } from '../../services/financialPlanningPageService';
import { logger } from '../../services/loggingService';

interface OverviewTabProps {
  retirementPlans: RetirementPlan[];
  financialGoals: FinancialGoal[];
  debtPlans: DebtPayoffPlan[];
  insuranceNeeds: InsuranceNeed[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getGoalStatusColor: (goal: FinancialGoal) => string;
  getGoalStatusIcon: (goal: FinancialGoal) => React.ReactNode;
  getInsuranceCoverageStatus: (need: InsuranceNeed) => { status: string; color: string };
  getGoalProgress: (goal: FinancialGoal) => number;
  getRetirementProjection: (plan: RetirementPlan) => any;
  getDebtPayoffProjection: (plan: DebtPayoffPlan) => any;
  onTabChange: (tab: ActiveTab) => void;
}

const OverviewTab = memo(function OverviewTab({
  retirementPlans,
  financialGoals,
  debtPlans,
  insuranceNeeds,
  formatCurrency,
  formatDate,
  getGoalStatusColor,
  getGoalStatusIcon,
  getInsuranceCoverageStatus,
  getGoalProgress,
  getRetirementProjection,
  getDebtPayoffProjection,
  onTabChange
}: OverviewTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('OverviewTab component initialized', {
      componentName: 'OverviewTab'
    });
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Retirement Plans */}
      <PlanSection
        title="Retirement Plans"
        icon={<PiggyBankIcon size={20} className="text-purple-600 dark:text-purple-400" />}
        items={retirementPlans}
        emptyMessage="No retirement plans yet"
        emptyButtonText="Create Plan"
        emptyButtonColor="bg-purple-600 hover:bg-purple-700"
        onViewAll={() => onTabChange('retirement')}
        renderItem={(plan: RetirementPlan) => {
          const projection = getRetirementProjection(plan);
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
        }}
      />

      {/* Financial Goals */}
      <PlanSection
        title="Financial Goals"
        icon={<TargetIcon size={20} className="text-gray-600 dark:text-gray-500" />}
        items={financialGoals}
        emptyMessage="No financial goals yet"
        emptyButtonText="Create Goal"
        emptyButtonColor="bg-gray-600 hover:bg-gray-700"
        onViewAll={() => onTabChange('goals')}
        renderItem={(goal: FinancialGoal) => {
          const progress = getGoalProgress(goal);
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
        }}
      />

      {/* Debt Plans */}
      <PlanSection
        title="Debt Payoff Plans"
        icon={<CreditCardIcon size={20} className="text-red-600 dark:text-red-400" />}
        items={debtPlans}
        emptyMessage="No debt plans yet"
        emptyButtonText="Create Plan"
        emptyButtonColor="bg-red-600 hover:bg-red-700"
        onViewAll={() => onTabChange('debt')}
        renderItem={(plan: DebtPayoffPlan) => {
          const projection = getDebtPayoffProjection(plan);
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
        }}
      />

      {/* Insurance Overview */}
      <PlanSection
        title="Insurance Coverage"
        icon={<ShieldIcon size={20} className="text-green-600 dark:text-green-400" />}
        items={insuranceNeeds}
        emptyMessage="No insurance plans yet"
        emptyButtonText="Add Insurance"
        emptyButtonColor="bg-green-600 hover:bg-green-700"
        onViewAll={() => onTabChange('insurance')}
        renderItem={(need: InsuranceNeed) => {
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
        }}
      />
    </div>
  );
});

// Plan Section Component
const PlanSection = memo(function PlanSection({
  title,
  icon,
  items,
  emptyMessage,
  emptyButtonText,
  emptyButtonColor,
  onViewAll,
  renderItem
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  emptyMessage: string;
  emptyButtonText: string;
  emptyButtonColor: string;
  onViewAll: () => void;
  renderItem: (item: any) => React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <button
          onClick={onViewAll}
          className="text-sm text-gray-600 dark:text-gray-500 hover:underline flex items-center gap-1"
        >
          View All <ArrowRightIcon size={14} />
        </button>
      </div>
      
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">{emptyMessage}</p>
          <button
            onClick={onViewAll}
            className={`px-4 py-2 text-white rounded-lg text-sm ${emptyButtonColor}`}
          >
            {emptyButtonText}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 3).map(renderItem)}
        </div>
      )}
    </div>
  );
});

export default OverviewTab;
