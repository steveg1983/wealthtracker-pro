import React from 'react';
import FinancialSummary from '../FinancialSummary';
import type { BaseWidgetProps } from '../../types/widget-types';

type WeeklySummaryWidgetProps = BaseWidgetProps;

export default function WeeklySummaryWidget(_: WeeklySummaryWidgetProps): React.JSX.Element {
  return (
    <div className="h-full overflow-auto">
      <FinancialSummary period="weekly" />
    </div>
  );
}
