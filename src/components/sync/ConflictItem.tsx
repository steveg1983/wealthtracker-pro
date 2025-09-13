/**
 * Conflict Item Component
 * World-class conflict visualization with clear decision paths
 * Implements Dropbox-level clarity for conflict resolution
 */

import React, { useEffect, memo, useState } from 'react';
import { 
  ClockIcon as Clock,
  CloudIcon as Cloud,
  Loader2Icon as Loader2,
  ZapIcon as Zap
} from '../icons';
import { dataSyncService } from '../../services/sync/dataSyncService';
import type { SyncConflict } from '../../services/syncService';
import { logger } from '../../services/loggingService';

interface ConflictItemProps {
  conflict: SyncConflict;
  onResolve: (id: string, resolution: 'local' | 'remote' | 'merge') => void;
  isResolving: boolean;
}

/**
 * Premium conflict item with clear visual hierarchy
 */
export const ConflictItem = memo(function ConflictItem({
  conflict,
  onResolve,
  isResolving
}: ConflictItemProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ConflictItem component initialized', {
      componentName: 'ConflictItem'
    });
  }, []);

  const [showDetails, setShowDetails] = useState(false);
  const formattedConflict = dataSyncService.formatConflict(conflict);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <ConflictHeader
        formattedConflict={formattedConflict}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails(!showDetails)}
      />

      {showDetails && (
        <ConflictDetails
          conflict={conflict}
          formattedConflict={formattedConflict}
        />
      )}

      <ConflictActions
        conflict={conflict}
        onResolve={onResolve}
        isResolving={isResolving}
      />
    </div>
  );
});

/**
 * Conflict header
 */
const ConflictHeader = memo(function ConflictHeader({
  formattedConflict,
  showDetails,
  onToggleDetails
}: {
  formattedConflict: ReturnType<typeof dataSyncService.formatConflict>;
  showDetails: boolean;
  onToggleDetails: () => void;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">
          {formattedConflict.title}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Entity ID: {formattedConflict.entityId}
        </p>
      </div>
      <button
        onClick={onToggleDetails}
        className="text-sm text-gray-600 dark:text-gray-500 hover:underline focus:outline-none focus:underline"
        aria-expanded={showDetails}
        aria-label={showDetails ? 'Hide conflict details' : 'Show conflict details'}
      >
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
    </div>
  );
});

/**
 * Conflict details
 */
const ConflictDetails = memo(function ConflictDetails({
  conflict,
  formattedConflict
}: {
  conflict: SyncConflict;
  formattedConflict: ReturnType<typeof dataSyncService.formatConflict>;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* Local Version */}
      <VersionCard
        icon={<Clock size={16} className="text-gray-600 dark:text-gray-500" />}
        label={formattedConflict.local.label}
        bgColor="bg-blue-50 dark:bg-gray-900/20"
        details={{
          type: formattedConflict.local.type,
          time: formattedConflict.local.time,
          version: String(formattedConflict.local.version)
        }}
      />

      {/* Remote Version */}
      <VersionCard
        icon={<Cloud size={16} className="text-green-600 dark:text-green-400" />}
        label={formattedConflict.remote.label}
        bgColor="bg-green-50 dark:bg-green-900/20"
        details={{
          type: formattedConflict.remote.type,
          time: formattedConflict.remote.time,
          version: String(formattedConflict.remote.version)
        }}
      />
    </div>
  );
});

/**
 * Version card
 */
const VersionCard = memo(function VersionCard({
  icon,
  label,
  bgColor,
  details
}: {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  details: {
    type: string;
    time: string;
    version: string;
  };
}): React.JSX.Element {
  return (
    <div className={`p-3 ${bgColor} rounded-lg`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-300">
          {label}
        </span>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>Type: {details.type}</p>
        <p>Time: {details.time}</p>
        <p>Version: {details.version}</p>
      </div>
    </div>
  );
});

/**
 * Conflict resolution actions
 */
const ConflictActions = memo(function ConflictActions({
  conflict,
  onResolve,
  isResolving
}: {
  conflict: SyncConflict;
  onResolve: (id: string, resolution: 'local' | 'remote' | 'merge') => void;
  isResolving: boolean;
}): React.JSX.Element {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onResolve(conflict.id, 'local')}
        disabled={isResolving}
        className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
        aria-label="Keep local version"
      >
        {isResolving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Zap size={16} />
        )}
        Keep Mine
      </button>
      <button
        onClick={() => onResolve(conflict.id, 'remote')}
        disabled={isResolving}
        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        aria-label="Keep remote version"
      >
        {isResolving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Cloud size={16} />
        )}
        Use Theirs
      </button>
    </div>
  );
});