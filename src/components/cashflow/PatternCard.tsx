/**
 * Pattern Card Component
 * World-class pattern display with financial clarity
 */

import React, { useEffect, memo } from 'react';
import { EditIcon, DeleteIcon } from '../icons';
import { cashFlowService } from '../../services/cashflow/cashFlowService';
import type { RecurringPattern } from '../../services/cashFlowForecastService';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

interface PatternCardProps {
  pattern: RecurringPattern;
  formatCurrency: (value: DecimalInstance | number) => string;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * Premium pattern card with institutional styling
 */
export const PatternCard = memo(function PatternCard({ 
  pattern, 
  formatCurrency, 
  onEdit, 
  onRemove 
}: PatternCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('PatternCard component initialized', {
      componentName: 'PatternCard'
    });
  }, []);

  const statusColor = cashFlowService.getPatternStatusColor(pattern);
  const details = cashFlowService.formatPatternDetails(pattern);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <PatternInfo 
        statusColor={statusColor}
        description={details.description}
        amount={formatCurrency(pattern.amount)}
        frequency={pattern.frequency}
        nextOccurrence={details.nextOccurrence}
      />
      
      <PatternActions
        confidence={pattern.confidence}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    </div>
  );
});

/**
 * Pattern information
 */
const PatternInfo = memo(function PatternInfo({
  statusColor,
  description,
  amount,
  frequency,
  nextOccurrence
}: {
  statusColor: string;
  description: string;
  amount: string;
  frequency: string;
  nextOccurrence: string;
}): React.JSX.Element {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {description}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {amount} • {frequency} • Next: {nextOccurrence}
          </p>
        </div>
      </div>
    </div>
  );
});

/**
 * Pattern actions
 */
const PatternActions = memo(function PatternActions({
  confidence,
  onEdit,
  onRemove
}: {
  confidence: number;
  onEdit: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <ConfidenceDisplay confidence={confidence} />
      <ActionButtons onEdit={onEdit} onRemove={onRemove} />
    </div>
  );
});

/**
 * Confidence display
 */
const ConfidenceDisplay = memo(function ConfidenceDisplay({
  confidence
}: {
  confidence: number;
}): React.JSX.Element {
  return (
    <div className="text-right">
      <p className="text-xs text-gray-500 dark:text-gray-400">Confidence</p>
      <p className="font-medium text-gray-900 dark:text-white">{confidence}%</p>
    </div>
  );
});

/**
 * Action buttons
 */
const ActionButtons = memo(function ActionButtons({
  onEdit,
  onRemove
}: {
  onEdit: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        title="Edit pattern"
        aria-label="Edit pattern"
      >
        <EditIcon size={16} />
      </button>
      <button
        onClick={onRemove}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        title="Remove pattern"
        aria-label="Remove pattern"
      >
        <DeleteIcon size={16} />
      </button>
    </div>
  );
});