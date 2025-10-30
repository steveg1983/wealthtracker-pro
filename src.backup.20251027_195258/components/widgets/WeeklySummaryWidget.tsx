import React from 'react';
import FinancialSummary from '../FinancialSummary';

interface WeeklySummaryWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: Record<string, string | number | boolean | null>;
}

export default function WeeklySummaryWidget({ size: _size, settings: _settings }: WeeklySummaryWidgetProps): React.JSX.Element {
  return (
    <div className="h-full overflow-auto">
      <FinancialSummary period="weekly" />
    </div>
  );
}