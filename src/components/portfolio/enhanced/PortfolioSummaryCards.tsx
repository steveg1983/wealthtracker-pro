import { memo, useEffect } from 'react';
import { TrendingUp, TrendingDown } from '../../icons';
import { formatCurrency } from '../../../utils/currency';
import { EnhancedPortfolioService, type PortfolioMetrics } from '../../../services/enhancedPortfolioService';
import { useLogger } from '../services/ServiceProvider';

interface PortfolioSummaryCardsProps {
  metrics: PortfolioMetrics;
  currency: string;
  loading: boolean;
}

/**
 * Portfolio Summary Cards component
 * Displays key portfolio metrics in card format
 */
export const PortfolioSummaryCards = memo(function PortfolioSummaryCards({ metrics,
  currency,
  loading
 }: PortfolioSummaryCardsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioSummaryCards component initialized', {
      componentName: 'PortfolioSummaryCards'
    });
  }, []);

  const { totalMarketValue, totalCost, totalGain, totalGainPercent, holdingsCount, livePricesCount } = metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        title="Market Value"
        value={formatCurrency(totalMarketValue, currency)}
        loading={loading}
      />
      
      <SummaryCard
        title="Total Cost"
        value={formatCurrency(totalCost, currency)}
      />
      
      <GainLossCard
        totalGain={totalGain}
        totalGainPercent={totalGainPercent}
        totalCost={totalCost}
        currency={currency}
      />
      
      <HoldingsCard
        holdingsCount={holdingsCount}
        livePricesCount={livePricesCount}
      />
    </div>
  );
});

/**
 * Individual summary card
 */
const SummaryCard = memo(function SummaryCard({
  title,
  value,
  loading
}: {
  title: string;
  value: string;
  loading?: boolean;
}) {
  const logger = useLogger();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {loading && (
        <p className="text-xs text-gray-400 mt-1">Updating...</p>
      )}
    </div>
  );
});

/**
 * Gain/Loss card with special styling
 */
const GainLossCard = memo(function GainLossCard({
  totalGain,
  totalGainPercent,
  totalCost,
  currency
}: {
  totalGain: number;
  totalGainPercent: number;
  totalCost: number;
  currency: string;
}) {
  const logger = useLogger();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Total Gain/Loss</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain, currency)}
        </p>
        {totalGain >= 0 ? (
          <TrendingUp className="text-green-600" size={20} />
        ) : (
          <TrendingDown className="text-red-600" size={20} />
        )}
      </div>
      <p className={`text-sm ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {EnhancedPortfolioService.formatPercent(totalGainPercent)}
      </p>
    </div>
  );
});

/**
 * Holdings count card
 */
const HoldingsCard = memo(function HoldingsCard({
  holdingsCount,
  livePricesCount
}: {
  holdingsCount: number;
  livePricesCount: number;
}) {
  const logger = useLogger();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Holdings</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{holdingsCount}</p>
      <p className="text-xs text-gray-400 mt-1">
        {livePricesCount} with live prices
      </p>
    </div>
  );
});