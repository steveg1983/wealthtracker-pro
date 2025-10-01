import React from 'react';
import NetWorthTrendWidget from './dashboard/widgets/NetWorthTrendWidget';
import CashFlowWidget from './dashboard/widgets/CashFlowWidget';
import ExpenseCategoriesWidget from './dashboard/widgets/ExpenseCategoriesWidget';
import RecentAlertsWidget from './dashboard/widgets/RecentAlertsWidget';

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
      <NetWorthTrendWidget isCompact />
      <CashFlowWidget isCompact />
      <ExpenseCategoriesWidget isCompact />
      <RecentAlertsWidget isCompact />
    </div>
  );
}
