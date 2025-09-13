import React, { useEffect, memo } from 'react';
import { format } from 'date-fns';
import { 
  AlertTriangleIcon, 
  XIcon,
  DollarSignIcon,
  TrendingUpIcon,
  RepeatIcon,
  ShieldIcon,
  ClockIcon
} from '../icons';
import type { Anomaly } from '../../services/anomalyDetectionService';
import { ANOMALY_COLORS } from './types';
import { logger } from '../../services/loggingService';

interface AnomalyCardProps {
  anomaly: Anomaly;
  onDismiss: (id: string) => void;
  onViewTransaction: (transactionId?: string) => void;
  onClick: () => void;
}

export const AnomalyCard = memo(function AnomalyCard({
  anomaly,
  onDismiss,
  onViewTransaction,
  onClick
}: AnomalyCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AnomalyCard component initialized', {
      componentName: 'AnomalyCard'
    });
  }, []);

  const getAnomalyIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'unusual_amount': return <DollarSignIcon size={16} />;
      case 'frequency_spike': return <TrendingUpIcon size={16} />;
      case 'new_merchant': return <ShieldIcon size={16} />;
      case 'category_overspend': return <AlertTriangleIcon size={16} />;
      case 'time_pattern': return <ClockIcon size={16} />;
      case 'duplicate_charge': return <RepeatIcon size={16} />;
      default: return <AlertTriangleIcon size={16} />;
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
        ANOMALY_COLORS[anomaly.severity]
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {getAnomalyIcon(anomaly.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {anomaly.description}
            </h4>
            {/* Additional details can be shown if available */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{format(new Date(anomaly.detectedAt), 'MMM d, yyyy')}</span>
              {anomaly.transactionId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewTransaction(anomaly.transactionId);
                  }}
                  className="text-primary hover:underline"
                >
                  View Transaction
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(anomaly.id);
          }}
          className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
});
