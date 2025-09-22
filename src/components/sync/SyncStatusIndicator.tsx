/**
 * Sync Status Indicator Component
 * World-class sync status display with Dropbox-level clarity
 * Implements progressive disclosure pattern
 */

import React, { useEffect, memo, useCallback } from 'react';
import { 
  CloudIcon as Cloud,
  CloudOffIcon as CloudOff,
  RefreshCwIcon as RefreshCw,
  AlertTriangleIcon as AlertTriangle,
  Loader2Icon as Loader2
} from '../icons';
import { dataSyncService, type SyncStatus } from '../../services/sync/dataSyncService';
import { useLogger } from '../services/ServiceProvider';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  conflictCount: number;
  onClick: () => void;
  onForceSync: () => void;
}

/**
 * Premium sync status indicator with micro-interactions
 */
export const SyncStatusIndicator = memo(function SyncStatusIndicator({ status,
  conflictCount,
  onClick,
  onForceSync
 }: SyncStatusIndicatorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SyncStatusIndicator component initialized', {
      componentName: 'SyncStatusIndicator'
    });
  }, []);

  const iconConfig = dataSyncService.getSyncIconConfig(status, conflictCount);
  const message = dataSyncService.getSyncMessage(status, conflictCount);
  const showQuickAction = status.pendingOperations > 0 || !status.isConnected;

  const handleQuickSync = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onForceSync();
  }, [onForceSync]);

  return (
    <div className="fixed top-4 right-4 z-40">
      <button
        onClick={onClick}
        className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        aria-label={`Sync status: ${message}`}
      >
        <StatusIcon config={iconConfig} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </span>
      </button>

      {/* Quick Sync Action */}
      {showQuickAction && (
        <button
          onClick={handleQuickSync}
          className="absolute -bottom-2 -right-2 p-1.5 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-all duration-200 hover:scale-110 shadow-md"
          title="Sync now"
          aria-label="Force sync now"
        >
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  );
});

/**
 * Dynamic status icon
 */
const StatusIcon = memo(function StatusIcon({
  config
}: {
  config: ReturnType<typeof dataSyncService.getSyncIconConfig>;
}): React.JSX.Element {
  const logger = useLogger();
  const iconProps = {
    size: 20,
    className: `${config.color} ${config.animate ? 'animate-spin' : ''}`,
    'aria-hidden': true
  };

  switch (config.icon) {
    case 'Loader2':
      return <Loader2 {...iconProps} />;
    case 'CloudOff':
      return <CloudOff {...iconProps} />;
    case 'RefreshCw':
      return <RefreshCw {...iconProps} />;
    case 'AlertTriangle':
      return <AlertTriangle {...iconProps} />;
    case 'Cloud':
    default:
      return <Cloud {...iconProps} />;
  }
});