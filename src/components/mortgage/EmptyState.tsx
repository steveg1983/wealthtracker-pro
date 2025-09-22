/**
 * Empty State Component
 * Displays when no mortgage calculations exist
 */

import React, { useEffect } from 'react';
import { HomeIcon, CalculatorIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface EmptyStateProps {
  onNewCalculation: () => void;
}

const EmptyState = React.memo(({ onNewCalculation }: EmptyStateProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
      <HomeIcon size={48} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        No mortgage calculations yet
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        Calculate your mortgage payments and view detailed amortization schedules
      </p>
      <button
        onClick={onNewCalculation}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
      >
        <CalculatorIcon size={16} />
        Calculate Mortgage
      </button>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;