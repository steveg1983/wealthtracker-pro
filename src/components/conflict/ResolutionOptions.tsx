/**
 * Resolution Options Component
 * Strategy selection buttons for conflict resolution
 */

import React, { useEffect } from 'react';
import { MergeIcon } from '../icons';
import { ConflictAnalysis } from '../../services/conflictResolutionService';
import { useLogger } from '../services/ServiceProvider';

interface ResolutionOptionsProps {
  analysis: ConflictAnalysis;
  selectedResolution: 'client' | 'server' | 'merge';
  showAdvanced: boolean;
  onSelectResolution: (resolution: 'client' | 'server' | 'merge') => void;
  onToggleAdvanced: () => void;
}

const ResolutionOptions = React.memo(({
  analysis,
  selectedResolution,
  showAdvanced,
  onSelectResolution,
  onToggleAdvanced
}: ResolutionOptionsProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white">Resolution Strategy</h4>
        <button
          onClick={onToggleAdvanced}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {analysis.canAutoResolve && (
          <button
            onClick={() => onSelectResolution('merge')}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedResolution === 'merge'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <MergeIcon className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <div className="text-sm font-medium">Smart Merge</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Intelligently combine changes
            </div>
          </button>
        )}

        <button
          onClick={() => onSelectResolution('client')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedResolution === 'client'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="text-2xl mb-2">💻</div>
          <div className="text-sm font-medium">Keep Your Version</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use your local changes
          </div>
        </button>

        <button
          onClick={() => onSelectResolution('server')}
          className={`p-3 rounded-lg border-2 transition-all ${
            selectedResolution === 'server'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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

ResolutionOptions.displayName = 'ResolutionOptions';

export default ResolutionOptions;