/**
 * Import Results Panel Component
 * World-class success/error feedback with Apple-level polish
 */

import React, { useEffect, memo } from 'react';
import { CheckIcon, AlertCircleIcon, RefreshCwIcon } from '../icons';
import type { ImportResult } from '../../services/qif/qifImportModalService';
import { logger } from '../../services/loggingService';

interface ImportResultsPanelProps {
  result: ImportResult;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Premium results panel with institutional feedback design
 */
export const ImportResultsPanel = memo(function ImportResultsPanel({
  result,
  onReset,
  onClose
}: ImportResultsPanelProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ImportResultsPanel component initialized', {
      componentName: 'ImportResultsPanel'
    });
  }, []);

  return (
    <div className="text-center">
      {result.success ? (
        <SuccessResults result={result} />
      ) : (
        <ErrorResults result={result} />
      )}
      <ResultActions onReset={onReset} onClose={onClose} />
    </div>
  );
});

/**
 * Success results display
 */
const SuccessResults = memo(function SuccessResults({
  result
}: {
  result: ImportResult;
}): React.JSX.Element {
  return (
    <>
      <SuccessIcon />
      <SuccessMessage result={result} />
      <DuplicatesWarning duplicateCount={result.duplicates} />
    </>
  );
});

/**
 * Success icon
 */
const SuccessIcon = memo(function SuccessIcon(): React.JSX.Element {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
      <CheckIcon size={32} className="text-green-600 dark:text-green-400" />
    </div>
  );
});

/**
 * Success message
 */
const SuccessMessage = memo(function SuccessMessage({
  result
}: {
  result: ImportResult;
}): React.JSX.Element {
  return (
    <>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Import Successful!
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Imported {result.imported} transactions to {result.account?.name}
      </p>
    </>
  );
});

/**
 * Duplicates warning
 */
const DuplicatesWarning = memo(function DuplicatesWarning({
  duplicateCount
}: {
  duplicateCount?: number;
}): React.JSX.Element {
  if (!duplicateCount || duplicateCount === 0) {
    return <></>;
  }

  return (
    <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
      Skipped {duplicateCount} potential duplicate transactions
    </p>
  );
});

/**
 * Error results display
 */
const ErrorResults = memo(function ErrorResults({
  result
}: {
  result: ImportResult;
}): React.JSX.Element {
  return (
    <>
      <ErrorIcon />
      <ErrorMessage error={result.error} />
    </>
  );
});

/**
 * Error icon
 */
const ErrorIcon = memo(function ErrorIcon(): React.JSX.Element {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
      <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
    </div>
  );
});

/**
 * Error message
 */
const ErrorMessage = memo(function ErrorMessage({
  error
}: {
  error?: string;
}): React.JSX.Element {
  return (
    <>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Import Failed
      </h3>
      <p className="text-red-600 dark:text-red-400 mb-6">
        {error || 'An unknown error occurred'}
      </p>
    </>
  );
});

/**
 * Result action buttons
 */
const ResultActions = memo(function ResultActions({
  onReset,
  onClose
}: {
  onReset: () => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="flex justify-center gap-3">
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        <RefreshCwIcon size={20} />
        Import Another File
      </button>
      <button
        onClick={onClose}
        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Done
      </button>
    </div>
  );
});