import { memo, useState, useMemo, useEffect } from 'react';
import PageWrapper from '../../components/PageWrapper';
import CashFlowForecast from '../../components/CashFlowForecast';
import SeasonalTrends from '../../components/SeasonalTrends';
import EnvelopeBudgeting from '../../components/EnvelopeBudgeting';
import RecurringBudgetTemplates from '../../components/RecurringBudgetTemplates';
import BudgetRollover from '../../components/BudgetRollover';
import SpendingAlerts from '../../components/SpendingAlerts';
import ZeroBasedBudgeting from '../../components/ZeroBasedBudgeting';
import BudgetModal from '../../components/BudgetModal';
import { SkeletonCard } from '../../components/loading/Skeleton';
import { useApp } from '../../contexts/AppContextSupabase';
import { AlertCircleIcon, TrendingUpIcon } from '../../components/icons';
import { TabNavigation } from './TabNavigation';
import { BudgetSummary } from './BudgetSummary';
import { BudgetCard } from './BudgetCard';
import { AccountFilter } from './AccountFilter';
import { useBudgetCalculations } from './useBudgetCalculations';
import type { ActiveTab, BudgetSubTab, ForecastingState, DateValues } from './types';
import type { Budget } from '../../types';

/**
 * Main Forecasting page component
 * Manages budgets, forecasts, and seasonal trends
 */
const Forecasting = memo(function Forecasting() {
  const { accounts, budgets, updateBudget, deleteBudget, transactions, categories } = useApp();
  
  // State management
  const [state, setState] = useState<ForecastingState>({
    activeTab: 'budget',
    budgetSubTab: 'traditional',
    selectedAccountIds: [],
    isModalOpen: false,
    editingBudget: null,
    isLoading: true
  });

  // Memoize current date values
  const dateValues = useMemo<DateValues>(() => {
    const now = new Date();
    return {
      currentMonth: now.getMonth(),
      currentYear: now.getFullYear()
    };
  }, []);

  // Use budget calculations hook
  const { budgetsWithSpent, totals } = useBudgetCalculations(
    budgets,
    transactions,
    categories,
    dateValues
  );

  // Set loading to false when data is loaded
  useEffect(() => {
    if (budgets !== undefined && transactions !== undefined && categories !== undefined) {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [budgets, transactions, categories]);

  // Event handlers
  const handleEdit = (budget: Budget) => {
    setState(prev => ({
      ...prev,
      editingBudget: budget,
      isModalOpen: true
    }));
  };

  const handleModalClose = () => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      editingBudget: null
    }));
  };

  const handleToggleActive = (budgetId: string, currentStatus: boolean | undefined) => {
    updateBudget(budgetId, { isActive: !currentStatus });
  };

  const handleAccountToggle = (accountId: string) => {
    setState(prev => ({
      ...prev,
      selectedAccountIds: prev.selectedAccountIds.includes(accountId)
        ? prev.selectedAccountIds.filter(id => id !== accountId)
        : [...prev.selectedAccountIds, accountId]
    }));
  };

  const handleClearAccountSelection = () => {
    setState(prev => ({ ...prev, selectedAccountIds: [] }));
  };

  const handleTabChange = (tab: ActiveTab) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  const handleBudgetSubTabChange = (tab: BudgetSubTab) => {
    setState(prev => ({ ...prev, budgetSubTab: tab }));
  };

  // Render add button
  const renderAddButton = () => (
    <div 
      onClick={() => setState(prev => ({ ...prev, isModalOpen: true }))}
      className="cursor-pointer"
      title="Add Budget"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-200 hover:scale-110 drop-shadow-lg hover:drop-shadow-xl"
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
      >
        <circle
          cx="24"
          cy="24"
          r="24"
          fill="#D9E1F2"
          className="transition-all duration-200"
          onMouseEnter={(e) => e.currentTarget.setAttribute('fill', '#C5D3E8')}
          onMouseLeave={(e) => e.currentTarget.setAttribute('fill', '#D9E1F2')}
        />
        <g transform="translate(12, 12)">
          <circle cx="12" cy="12" r="10" stroke="#1F2937" strokeWidth="2" fill="none" />
          <path d="M12 8v8M8 12h8" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );

  return (
    <PageWrapper
      title="Forecasting & Budget"
      rightContent={state.activeTab === 'budget' && renderAddButton()}
    >
      {/* Navigation */}
      <TabNavigation
        activeTab={state.activeTab}
        budgetSubTab={state.budgetSubTab}
        onTabChange={handleTabChange}
        onBudgetSubTabChange={handleBudgetSubTabChange}
      />

      {/* Budget Tab Content */}
      {state.activeTab === 'budget' && (
        <>
          {state.budgetSubTab === 'traditional' && (
            <div className="space-y-6">
              <BudgetSummary totals={totals} />
              
              {/* Budget Cards */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Your Budgets
                </h2>
                
                {state.isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                ) : budgetsWithSpent.length === 0 ? (
                  <div className="text-center py-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
                      <svg className="mx-auto text-gray-400 mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2"/>
                      <path d="M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0 -6 0"/>
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">
                      No budgets created yet. Click the + button to add your first budget.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {budgetsWithSpent.map((budget) => (
                      <BudgetCard
                        key={budget.id}
                        budget={budget}
                        category={categories.find(c => c.id === ((budget as any).categoryId || (budget as any).category))}
                        onEdit={() => handleEdit(budget)}
                        onDelete={() => deleteBudget(budget.id)}
                        onToggleActive={() => handleToggleActive(budget.id, budget.isActive)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {state.budgetSubTab === 'envelope' && <EnvelopeBudgeting />}
          {state.budgetSubTab === 'templates' && <RecurringBudgetTemplates />}
          {state.budgetSubTab === 'rollover' && <BudgetRollover />}
          {state.budgetSubTab === 'alerts' && <SpendingAlerts />}
          {state.budgetSubTab === 'zero-based' && <ZeroBasedBudgeting />}
        </>
      )}

      {/* Account Filter for Forecast and Seasonal tabs */}
      {(state.activeTab === 'forecast' || state.activeTab === 'seasonal') && (
        <AccountFilter
          accounts={accounts}
          selectedAccountIds={state.selectedAccountIds}
          onAccountToggle={handleAccountToggle}
          onClearSelection={handleClearAccountSelection}
        />
      )}

      {/* Forecast Tab Content */}
      {state.activeTab === 'forecast' && (
        <CashFlowForecast 
          accountIds={state.selectedAccountIds.length > 0 ? state.selectedAccountIds : undefined}
        />
      )}

      {/* Seasonal Tab Content */}
      {state.activeTab === 'seasonal' && (
        <div className="space-y-6">
          <SeasonalTrends />
          
          {/* Tips Section */}
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                  <TrendingUpIcon className="text-primary" size={24} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Improve Your Financial Future
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Based on Forecast
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Set up automatic savings transfers</li>
                      <li>• Review and adjust recurring expenses</li>
                      <li>• Plan for irregular expenses</li>
                      <li>• Build emergency fund for low months</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                      Seasonal Planning
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Save extra during high-income months</li>
                      <li>• Budget for seasonal expenses</li>
                      <li>• Track holiday spending patterns</li>
                      <li>• Adjust goals based on trends</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature Info */}
      <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <div className="flex items-start gap-3">
          <AlertCircleIcon className="text-amber-600 dark:text-amber-400 mt-1" size={20} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              About Financial Forecasting & Budgeting
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Our forecasting engine analyzes your transaction history to identify patterns and predict future cash flow. 
              Combined with comprehensive budgeting tools, you can plan and track your finances effectively.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <h4 className="font-medium mb-1">Budgeting Features:</h4>
                <ul className="space-y-1">
                  <li>• Traditional, Envelope, and Zero-Based methods</li>
                  <li>• Budget templates and rollover options</li>
                  <li>• Smart spending alerts</li>
                  <li>• Category-based tracking</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Forecasting Features:</h4>
                <ul className="space-y-1">
                  <li>• 6-month cash flow projections</li>
                  <li>• Seasonal pattern detection</li>
                  <li>• Account-specific analysis</li>
                  <li>• Recurring transaction predictions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Modal */}
      {state.isModalOpen && (
        <BudgetModal
          isOpen={state.isModalOpen}
          onClose={handleModalClose}
          budget={state.editingBudget}
        />
      )}
    </PageWrapper>
  );
});

export default Forecasting;
