import React from 'react';
import FinancialSummary from '../FinancialSummary';
import type { BaseWidgetProps } from '../../types/widget-types';

type MonthlySummaryWidgetProps = BaseWidgetProps;

export default function MonthlySummaryWidget(_: MonthlySummaryWidgetProps) {
  return (
    <div className="h-full overflow-auto">
      <FinancialSummary period="monthly" />
    </div>
  );
}
