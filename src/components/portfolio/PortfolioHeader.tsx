/**
 * Portfolio Header Component
 * World-class header with professional-grade controls
 */

import React, { useEffect, memo } from 'react';
import { PlusIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface PortfolioHeaderProps {
  holdingsCount: number;
  onAddHolding: () => void;
}

/**
 * Premium portfolio header with institutional styling
 */
export const PortfolioHeader = memo(function PortfolioHeader({
  holdingsCount,
  onAddHolding
}: PortfolioHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PortfolioHeader component initialized', {
      componentName: 'PortfolioHeader'
    });
  }, []);
  return (
    <div className="flex justify-between items-center">
      <PortfolioTitle holdingsCount={holdingsCount} />
      <AddHoldingButton onAddHolding={onAddHolding} />
    </div>
  );
});

/**
 * Portfolio title with holdings count
 */
const PortfolioTitle = memo(function PortfolioTitle({
  holdingsCount
}: {
  holdingsCount: number;
}): React.JSX.Element {
  return (
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
      Portfolio Holdings ({holdingsCount})
    </h3>
  );
});

/**
 * Add holding button
 */
const AddHoldingButton = memo(function AddHoldingButton({
  onAddHolding
}: {
  onAddHolding: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={onAddHolding}
      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <PlusIcon size={20} />
      Add Holding
    </button>
  );
});