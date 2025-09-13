/**
 * Widget Renderer Component
 * Maps widget types to their corresponding components
 */

import React, { useEffect } from 'react';
import type { WidgetConfig } from '../DashboardWidget';
import NetWorthWidget from '../widgets/NetWorthWidget';
import CashFlowWidget from '../widgets/CashFlowWidget';
import BudgetSummaryWidget from '../widgets/BudgetSummaryWidget';
import RecentTransactionsWidget from '../widgets/RecentTransactionsWidget';
import GoalProgressWidget from '../widgets/GoalProgressWidget';
import ExpenseBreakdownWidget from '../widgets/ExpenseBreakdownWidget';
import InvestmentSummaryWidget from '../widgets/InvestmentSummaryWidget';
import UpcomingBillsWidget from '../widgets/UpcomingBillsWidget';
import WeeklySummaryWidget from '../widgets/WeeklySummaryWidget';
import MonthlySummaryWidget from '../widgets/MonthlySummaryWidget';
import BankConnectionsWidget from '../widgets/BankConnectionsWidget';
import AIAnalyticsWidget from '../widgets/AIAnalyticsWidget';
import TaxPlanningWidget from '../widgets/TaxPlanningWidget';
import InvestmentEnhancementWidget from '../widgets/InvestmentEnhancementWidget';
import SecurityWidget from '../widgets/SecurityWidget';
import CollaborationWidget from '../widgets/CollaborationWidget';
import MobileAppWidget from '../widgets/MobileAppWidget';
import BusinessWidget from '../widgets/BusinessWidget';
import FinancialPlanningWidget from '../widgets/FinancialPlanningWidget';
import DataIntelligenceWidget from '../widgets/DataIntelligenceWidget';
import { logger } from '../../services/loggingService';

interface WidgetRendererProps {
  config: WidgetConfig;
}

const WidgetRenderer = React.memo(({ config }: WidgetRendererProps) => {
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
            <div className="text-4xl mb-2">🚧</div>
            <div>Widget not implemented</div>
          </div>
        </div>
      );
  }
});

WidgetRenderer.displayName = 'WidgetRenderer';

export default WidgetRenderer;