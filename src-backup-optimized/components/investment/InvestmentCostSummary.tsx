/**
 * Investment Cost Summary Component
 * World-class cost breakdown with institutional clarity
 */

import React, { useEffect, memo } from 'react';
import { investmentService, type InvestmentFormData } from '../../services/investment/investmentService';
import { formatCurrency } from '../../utils/formatters';
import { getCurrencySymbol } from '../../utils/currency';
import type { Account } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface InvestmentCostSummaryProps {
  formData: InvestmentFormData;
  account?: Account;
}

/**
 * Premium cost summary with detailed breakdown
 */
export const InvestmentCostSummary = memo(function InvestmentCostSummary({ formData,
  account
 }: InvestmentCostSummaryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('InvestmentCostSummary component initialized', {
      componentName: 'InvestmentCostSummary'
    });
  }, []);

  const total = investmentService.calculateTotal(formData);
  const currency = account?.currency || 'GBP';
  const currencySymbol = getCurrencySymbol(currency);
  const breakdown = investmentService.formatCostBreakdown(formData, currencySymbol);

  return (
    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <TotalCost total={total} currency={currency} />
      {formData.units && formData.pricePerUnit && breakdown.length > 0 && (
        <CostBreakdown breakdown={breakdown} />
      )}
    </div>
  );
});

/**
 * Total cost display
 */
const TotalCost = memo(function TotalCost({
  total,
  currency
}: {
  total: number;
  currency: string;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost:</span>
      <span className="text-xl font-bold text-gray-900 dark:text-white">
        {formatCurrency(total, currency)}
      </span>
    </div>
  );
});

/**
 * Cost breakdown
 */
const CostBreakdown = memo(function CostBreakdown({
  breakdown
}: {
  breakdown: Array<{ label: string; value: string }>;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 space-y-1">
      {breakdown.map((item, index) => (
        <div key={index} className="flex justify-between">
          <span>{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
});