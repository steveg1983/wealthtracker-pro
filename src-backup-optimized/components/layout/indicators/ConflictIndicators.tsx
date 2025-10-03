import React, { useEffect } from 'react';
import { ConflictState } from '../../../hooks/useConflictResolution';
import { useLogger } from '../services/ServiceProvider';

interface ConflictIndicatorsProps {
  conflictState: ConflictState;
}

export function ConflictIndicators({ conflictState  }: ConflictIndicatorsProps): React.JSX.Element | null {
  if (!conflictState.requiresUserIntervention && conflictState.autoResolvedCount === 0) {
    return null;
  }

  return (
    <>
      {/* Conflict Status Indicator - Show when there are unresolved conflicts */}
      {conflictState.requiresUserIntervention && (
        <div className="fixed bottom-20 right-4 z-50 bg-amber-100 dark:bg-amber-900/90 p-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {conflictState.conflicts.length} conflict{conflictState.conflicts.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </div>
      )}
      
      {/* Auto-resolved notification */}
      {conflictState.autoResolvedCount > 0 && (
        <div className="fixed top-20 right-4 z-50 bg-green-100 dark:bg-green-900/90 p-3 rounded-lg shadow-lg animate-fade-in-out">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-800 dark:text-green-200">
              {conflictState.autoResolvedCount} conflict{conflictState.autoResolvedCount !== 1 ? 's' : ''} auto-resolved
            </span>
          </div>
        </div>
      )}
    </>
  );
}