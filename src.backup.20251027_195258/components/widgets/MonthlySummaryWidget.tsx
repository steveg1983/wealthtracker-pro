import React from 'react';
import FinancialSummary from '../FinancialSummary';

interface MonthlySummaryWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: Record<string, string | number | boolean | null>;
}

export default function MonthlySummaryWidget({ size: _size, settings: _settings }: MonthlySummaryWidgetProps) {
  return (
    <div className="h-full overflow-auto">
      <FinancialSummary period="monthly" />
    </div>
  );
}