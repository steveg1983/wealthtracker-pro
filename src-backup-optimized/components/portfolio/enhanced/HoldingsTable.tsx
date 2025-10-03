import { memo, useEffect } from 'react';
import { Clock } from '../../icons';
import { formatCurrency } from '../../../utils/currency';
import { EnhancedPortfolioService, type EnhancedHolding } from '../../../services/enhancedPortfolioService';
import { useLogger } from '../services/ServiceProvider';

interface HoldingsTableProps {
  holdings: EnhancedHolding[];
  prices: Map<string, any>;
  totalMarketValue: number;
  currency: string;
}

/**
 * Holdings Table component
 * Displays holdings in a responsive table format
 */
export const HoldingsTable = memo(function HoldingsTable({ holdings,
  prices,
  totalMarketValue,
  currency
 }: HoldingsTableProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingsTable component initialized', {
      componentName: 'HoldingsTable'
    });
  }, []);

  if (holdings.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <TableHeader />
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {holdings.map((holding, index) => (
              <HoldingRow
                key={`${holding.ticker}-${index}`}
                holding={holding}
                hasLivePrice={EnhancedPortfolioService.isPriceLive(holding.ticker, prices)}
                livePrice={prices.get(holding.ticker)}
                currency={currency}
                totalMarketValue={totalMarketValue}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {holdings.map((holding, index) => (
          <MobileHoldingCard
            key={`${holding.ticker}-${index}`}
            holding={holding}
            hasLivePrice={EnhancedPortfolioService.isPriceLive(holding.ticker, prices)}
            currency={currency}
            totalMarketValue={totalMarketValue}
          />
        ))}
      </div>

      {/* Last Update Time */}
      {prices.size > 0 && <UpdateTimeFooter />}
    </>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="p-8 text-center">
      <p className="text-gray-500 dark:text-gray-400">
        No holdings in this portfolio yet.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
        Add investments to track your portfolio.
      </p>
    </div>
  );
});

const TableHeader = memo(function TableHeader() {
  return (
    <thead>
      <tr className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600">
        <th className="px-6 py-3 text-left text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Ticker</th>
        <th className="px-6 py-3 text-left text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Name</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Shares</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Avg Cost</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Current Price</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Market Value</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">Gain/Loss</th>
        <th className="px-6 py-3 text-right text-xs font-semibold text-white dark:text-gray-200 uppercase tracking-wider">% Portfolio</th>
      </tr>
    </thead>
  );
});

const HoldingRow = memo(function HoldingRow({
  holding,
  hasLivePrice,
  livePrice,
  currency,
  totalMarketValue
}: {
  holding: EnhancedHolding;
  hasLivePrice: boolean;
  livePrice: any;
  currency: string;
  totalMarketValue: number;
}) {
  const logger = useLogger();
  const percentage = EnhancedPortfolioService.getPortfolioPercentage(
    holding.marketValue || holding.value,
    totalMarketValue
  );

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {holding.ticker}
          </span>
          {hasLivePrice && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {holding.name}
        {holding.currency && holding.currency !== currency && (
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({holding.currency})
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
        {EnhancedPortfolioService.formatShares(holding.shares)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
        {formatCurrency(holding.averageCost || holding.value / holding.shares, currency)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
        <div className="flex flex-col items-end">
          <span className="text-gray-900 dark:text-gray-100">
            {formatCurrency(holding.currentPrice || 0, currency)}
          </span>
          {livePrice && (
            <span className={`text-xs ${livePrice.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {EnhancedPortfolioService.formatPercent(livePrice.changePercent)}
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
        {formatCurrency(holding.marketValue || holding.value, currency)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
        {holding.gain !== undefined ? (
          <div className="flex flex-col items-end">
            <span className={`font-medium ${holding.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {holding.gain >= 0 ? '+' : ''}{formatCurrency(holding.gain, currency)}
            </span>
            <span className={`text-xs ${(holding.gainPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {EnhancedPortfolioService.formatPercent(holding.gainPercent || 0)}
            </span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-gray-600 dark:text-gray-400 w-12 text-right">
            {percentage}%
          </span>
        </div>
      </td>
    </tr>
  );
});

const MobileHoldingCard = memo(function MobileHoldingCard({
  holding,
  hasLivePrice,
  currency,
  totalMarketValue
}: {
  holding: EnhancedHolding;
  hasLivePrice: boolean;
  currency: string;
  totalMarketValue: number;
}) {
  const logger = useLogger();
  const percentage = EnhancedPortfolioService.getPortfolioPercentage(
    holding.marketValue || holding.value,
    totalMarketValue
  );

  return (
    <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-white">{holding.ticker}</p>
            {hasLivePrice && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{holding.name}</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(holding.marketValue || holding.value, currency)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {percentage}%
          </p>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {EnhancedPortfolioService.formatShares(holding.shares)} @ {formatCurrency(holding.currentPrice || 0, currency)}
        </span>
        {holding.gain !== undefined && (
          <span className={`font-medium ${holding.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {holding.gain >= 0 ? '+' : ''}{formatCurrency(holding.gain, currency)} ({EnhancedPortfolioService.formatPercent(holding.gainPercent || 0)})
          </span>
        )}
      </div>
    </div>
  );
});

const UpdateTimeFooter = memo(function UpdateTimeFooter() {
  return (
    <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>Prices updated: {EnhancedPortfolioService.getLastUpdateTime()}</span>
        </div>
        <span>Live prices from Yahoo Finance</span>
      </div>
    </div>
  );
});