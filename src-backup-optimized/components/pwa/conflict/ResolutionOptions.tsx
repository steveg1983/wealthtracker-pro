/**
 * Resolution Options Component
 * Displays resolution strategy selection buttons
 */

import React, { useEffect, memo } from 'react';
import { MergeIcon } from '../../icons';
import type { ConflictAnalysis } from '../../../services/conflictResolutionService';
import { useLogger } from '../services/ServiceProvider';

interface ResolutionOptionsProps {
  selectedResolution: 'client' | 'server' | 'merge';
  analysis: ConflictAnalysis;
  showAdvanced: boolean;
  onResolutionChange: (resolution: 'client' | 'server' | 'merge') => void;
  onToggleAdvanced: () => void;
}

export const ResolutionOptions = memo(function ResolutionOptions({ selectedResolution,
  analysis,
  showAdvanced,
  onResolutionChange,
  onToggleAdvanced
 }: ResolutionOptionsProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ResolutionOptions component initialized', {
      componentName: 'ResolutionOptions'
    });
  }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Resolution Strategy</h4>
        <button
          onClick={onToggleAdvanced}
          className="text-sm text-gray-600 dark:text-gray-500 hover:underline"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {analysis.canAutoResolve && (
          <button
            onClick={() => onResolutionChange('merge')}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedResolution === 'merge'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <MergeIcon size={24} className="mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <div className="text-sm font-medium">Smart Merge</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Intelligently combine changes
            </div>
          </button>
        )}

        <button
          onClick={() => onResolutionChange('client')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedResolution === 'client'
              ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="text-2xl mb-2">💻</div>
          <div className="text-sm font-medium">Keep Your Version</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use your local changes
          </div>
        </button>

        <button
          onClick={() => onResolutionChange('server')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedResolution === 'server'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="text-2xl mb-2">☁️</div>
          <div className="text-sm font-medium">Keep Server Version</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use server changes
          </div>
        </button>
      </div>
    </div>
  );
});