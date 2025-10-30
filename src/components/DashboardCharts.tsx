import React from 'react';
import NetWorthWidget from './widgets/NetWorthWidget';
import CashFlowWidget from './widgets/CashFlowWidget';
import ExpenseBreakdownWidget from './widgets/ExpenseBreakdownWidget';
import BudgetSummaryWidget from './widgets/BudgetSummaryWidget';

interface DashboardChartsProps {
  /**
   * The mobile dashboard already provides the underlying context data via providers.
   * The props are accepted for backward compatibility but not directly used.
   */
  accounts?: unknown;
  transactions?: unknown;
}

export default function DashboardCharts(_: DashboardChartsProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <NetWorthWidget size="medium" settings={{}} />
      <CashFlowWidget size="medium" settings={{}} />
      <ExpenseBreakdownWidget size="medium" settings={{}} />
      <BudgetSummaryWidget size="medium" settings={{}} />
    </div>
  );
}