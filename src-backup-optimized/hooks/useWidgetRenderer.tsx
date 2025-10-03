// Converted to .tsx to render JSX returns
import { useCallback } from 'react';
import type { WidgetConfig } from '../components/DashboardWidget';

// Lazy load widget components
import NetWorthWidget from '../components/widgets/NetWorthWidget';
import CashFlowWidget from '../components/widgets/CashFlowWidget';
import BudgetSummaryWidget from '../components/widgets/BudgetSummaryWidget';
import RecentTransactionsWidget from '../components/widgets/RecentTransactionsWidget';
import GoalProgressWidget from '../components/widgets/GoalProgressWidget';
import ExpenseBreakdownWidget from '../components/widgets/ExpenseBreakdownWidget';
import InvestmentSummaryWidget from '../components/widgets/InvestmentSummaryWidget';
import UpcomingBillsWidget from '../components/widgets/UpcomingBillsWidget';
import WeeklySummaryWidget from '../components/widgets/WeeklySummaryWidget';
import MonthlySummaryWidget from '../components/widgets/MonthlySummaryWidget';
import BankConnectionsWidget from '../components/widgets/BankConnectionsWidget';
import AIAnalyticsWidget from '../components/widgets/AIAnalyticsWidget';
import TaxPlanningWidget from '../components/widgets/TaxPlanningWidget';
import InvestmentEnhancementWidget from '../components/widgets/InvestmentEnhancementWidget';
import SecurityWidget from '../components/widgets/SecurityWidget';
import CollaborationWidget from '../components/widgets/CollaborationWidget';
import MobileAppWidget from '../components/widgets/MobileAppWidget';
import BusinessWidget from '../components/widgets/BusinessWidget';
import FinancialPlanningWidget from '../components/widgets/FinancialPlanningWidget';
import DataIntelligenceWidget from '../components/widgets/DataIntelligenceWidget';

export function useWidgetRenderer() {
  const renderWidget = useCallback((config: WidgetConfig) => {
    const commonProps = {
      size: config.size,
      settings: config.settings
    };

    switch (config.type) {
      case 'net-worth':
        return <NetWorthWidget {...commonProps} />;
      case 'cash-flow':
        return <CashFlowWidget {...commonProps} />;
      case 'budget-summary':
        return <BudgetSummaryWidget {...commonProps} />;
      case 'recent-transactions':
        return <RecentTransactionsWidget {...commonProps} />;
      case 'goal-progress':
        return <GoalProgressWidget {...commonProps} />;
      case 'expense-breakdown':
        return <ExpenseBreakdownWidget {...commonProps} />;
      case 'investment-summary':
        return <InvestmentSummaryWidget {...commonProps} />;
      case 'upcoming-bills':
        return <UpcomingBillsWidget {...commonProps} />;
      case 'weekly-summary':
        return <WeeklySummaryWidget {...commonProps} />;
      case 'monthly-summary':
        return <MonthlySummaryWidget {...commonProps} />;
      case 'bank-connections':
        return <BankConnectionsWidget {...commonProps} />;
      case 'ai-analytics':
        return <AIAnalyticsWidget {...commonProps} />;
      case 'tax-planning':
        return <TaxPlanningWidget {...commonProps} />;
      case 'investment-enhancement':
        return <InvestmentEnhancementWidget {...commonProps} />;
      case 'security':
        return <SecurityWidget {...commonProps} />;
      case 'collaboration':
        return <CollaborationWidget {...commonProps} />;
      case 'mobile-app':
        return <MobileAppWidget {...commonProps} />;
      case 'business':
        return <BusinessWidget {...commonProps} />;
      case 'financial-planning':
        return <FinancialPlanningWidget {...commonProps} />;
      case 'data-intelligence':
        return <DataIntelligenceWidget {...commonProps} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div>Widget not implemented</div>
            </div>
          </div>
        );
    }
  }, []);

  return { renderWidget };
}

