/**
 * Verification Stats Component
 * World-class statistics with enterprise-grade metrics
 */

import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, AlertCircleIcon, XCircleIcon } from '../icons';
import type { VerificationStats } from '../../services/verification/verificationService';
import { useLogger } from '../services/ServiceProvider';

interface VerificationStatsProps {
  stats: VerificationStats;
}

/**
 * Premium statistics dashboard with institutional styling
 */
export const VerificationStatsPanel = memo(function VerificationStatsPanel({ stats
 }: VerificationStatsProps): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <SuccessCard count={stats.successCount} />
      <WarningCard count={stats.warningCount} />
      <ErrorCard count={stats.errorCount} />
    </div>
  );
});

/**
 * Success metrics card
 */
const SuccessCard = memo(function SuccessCard({
  count
}: {
  count: number;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Passed</span>
      </div>
      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
        {count}
      </p>
    </div>
  );
});

/**
 * Warning metrics card
 */
const WarningCard = memo(function WarningCard({
  count
}: {
  count: number;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <AlertCircleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Warnings</span>
      </div>
      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
        {count}
      </p>
    </div>
  );
});

/**
 * Error metrics card
 */
const ErrorCard = memo(function ErrorCard({
  count
}: {
  count: number;
}): React.JSX.Element {
  const logger = useLogger();
  return (
    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <XCircleIcon size={16} className="text-red-600 dark:text-red-400" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Errors</span>
      </div>
      <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
        {count}
      </p>
    </div>
  );
});