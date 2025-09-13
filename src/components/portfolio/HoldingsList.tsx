/**
 * Holdings List Component
 * World-class portfolio display with institutional clarity
 */

import React, { useEffect, memo } from 'react';
import { PlusIcon, EditIcon, DeleteIcon } from '../icons';
import type { StockHolding } from '../../services/portfolio/portfolioManagerService';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

interface HoldingsListProps {
  holdings: StockHolding[];
  totalCostBasis: DecimalInstance;
  formatCurrency: (value: DecimalInstance) => string;
  onAddHolding: () => void;
  onEditHolding: (holding: StockHolding) => void;
  onDeleteHolding: (holdingId: string) => void;
}

/**
 * Premium holdings list with enterprise-grade styling
 */
export const HoldingsList = memo(function HoldingsList({
  holdings,
  totalCostBasis,
  formatCurrency,
  onAddHolding,
  onEditHolding,
  onDeleteHolding
}: HoldingsListProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('HoldingsList component initialized', {
      componentName: 'HoldingsList'
    });
  }, []);

  if (holdings.length === 0) {
    return <EmptyState onAddHolding={onAddHolding} />;
  }

  return (
    <div className="space-y-3">
      <HoldingItems
        holdings={holdings}
        formatCurrency={formatCurrency}
        onEditHolding={onEditHolding}
        onDeleteHolding={onDeleteHolding}
      />
      <TotalSummary totalCostBasis={totalCostBasis} formatCurrency={formatCurrency} />
    </div>
  );
});

/**
 * Empty state when no holdings
 */
const EmptyState = memo(function EmptyState({
  onAddHolding
}: {
  onAddHolding: () => void;
}): React.JSX.Element {
  return (
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        No holdings yet. Add stocks to track your portfolio performance.
      </p>
      <button
        onClick={onAddHolding}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <PlusIcon size={20} />
        Add Your First Stock
      </button>
    </div>
  );
});

/**
 * Holdings items list
 */
const HoldingItems = memo(function HoldingItems({
  holdings,
  formatCurrency,
  onEditHolding,
  onDeleteHolding
}: {
  holdings: StockHolding[];
  formatCurrency: (value: DecimalInstance) => string;
  onEditHolding: (holding: StockHolding) => void;
  onDeleteHolding: (holdingId: string) => void;
}): React.JSX.Element {
  return (
    <>
      {holdings.map((holding) => (
        <HoldingItem
          key={holding.id}
          holding={holding}
          formatCurrency={formatCurrency}
          onEdit={() => onEditHolding(holding)}
          onDelete={() => onDeleteHolding(holding.id)}
        />
      ))}
    </>
  );
});

/**
 * Individual holding item
 */
const HoldingItem = memo(function HoldingItem({
  holding,
  formatCurrency,
  onEdit,
  onDelete
}: {
  holding: StockHolding;
  formatCurrency: (value: DecimalInstance) => string;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  const handleDelete = () => {
    if (confirm('Are you sure you want to remove this holding?')) {
      onDelete();
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <HoldingInfo holding={holding} formatCurrency={formatCurrency} />
      <HoldingActions onEdit={onEdit} onDelete={handleDelete} />
    </div>
  );
});

/**
 * Holding information display
 */
const HoldingInfo = memo(function HoldingInfo({
  holding,
  formatCurrency
}: {
  holding: StockHolding;
  formatCurrency: (value: DecimalInstance) => string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-6 flex-1">
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white">
          {holding.symbol}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {holding.shares.toFixed(2)} shares @ {formatCurrency(holding.averageCost)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cost Basis</p>
        <p className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(holding.costBasis)}
        </p>
      </div>
    </div>
  );
});

/**
 * Holding action buttons
 */
const HoldingActions = memo(function HoldingActions({
  onEdit,
  onDelete
}: {
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        title="Edit holding"
      >
        <EditIcon size={18} />
      </button>
      <button
        onClick={onDelete}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        title="Remove holding"
      >
        <DeleteIcon size={18} />
      </button>
    </div>
  );
});

/**
 * Total cost basis summary
 */
const TotalSummary = memo(function TotalSummary({
  totalCostBasis,
  formatCurrency
}: {
  totalCostBasis: DecimalInstance;
  formatCurrency: (value: DecimalInstance) => string;
}): React.JSX.Element {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-900 dark:text-white">
          Total Cost Basis
        </span>
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalCostBasis)}
        </span>
      </div>
    </div>
  );
});