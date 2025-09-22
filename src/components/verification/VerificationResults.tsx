/**
 * Verification Results Component
 * World-class results display with enterprise-grade clarity
 */

import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, AlertCircleIcon, XCircleIcon, DatabaseIcon } from '../icons';
import type { VerificationResult } from '../../services/verification/verificationService';
import { useLogger } from '../services/ServiceProvider';

interface VerificationResultsProps {
  results: VerificationResult[];
}

/**
 * Premium results display with institutional styling
 */
export const VerificationResultsList = memo(function VerificationResultsList({ results
 }: VerificationResultsProps): React.JSX.Element {
  const logger = useLogger();
  if (results.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <ResultItem key={index} result={result} />
      ))}
    </div>
  );
});

/**
 * Empty state when no results
 */
const EmptyState = memo(function EmptyState(): React.JSX.Element {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <DatabaseIcon size={48} className="mx-auto mb-4 opacity-50" />
      <p>Click "Run Verification" to check system status</p>
    </div>
  );
});

/**
 * Individual verification result item
 */
const ResultItem = memo(function ResultItem({
  result
}: {
  result: VerificationResult;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}>
      <div className="flex items-start gap-3">
        <StatusIcon status={result.status} />
        <ResultContent result={result} />
      </div>
    </div>
  );
});

/**
 * Status icon component
 */
const StatusIcon = memo(function StatusIcon({
  status
}: {
  status: VerificationResult['status'];
}): React.JSX.Element {
  const logger = useLogger();
  switch (status) {
    case 'success':
      return <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />;
    case 'warning':
      return <AlertCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400" />;
    case 'error':
      return <XCircleIcon size={20} className="text-red-600 dark:text-red-400" />;
  }
});

/**
 * Result content display
 */
const ResultContent = memo(function ResultContent({
  result
}: {
  result: VerificationResult;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="flex-1">
      <h4 className="font-medium text-gray-900 dark:text-white">
        {result.component}
      </h4>
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
        {result.message}
      </p>
      {result.details && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {result.details}
        </p>
      )}
    </div>
  );
});

/**
 * Get status-specific styling
 */
function getStatusColor(status: VerificationResult['status']): string {
  switch (status) {
    case 'success':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    case 'error':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  }
}