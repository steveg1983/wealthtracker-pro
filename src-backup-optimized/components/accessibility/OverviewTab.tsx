import React, { useEffect, memo } from 'react';
import { CheckCircleIcon, AlertTriangleIcon, XCircleIcon } from '../icons';
import { accessibleColorClasses } from '../../design-system/accessible-colors';
import type { AccessibilityStats } from '../../services/accessibilityDashboardService';
import { useLogger } from '../services/ServiceProvider';

interface OverviewTabProps {
  stats: AccessibilityStats;
  lastAuditTime?: Date;
  onRunAudit: () => void;
  isAuditing: boolean;
}

const OverviewTab = memo(function OverviewTab({ stats,
  lastAuditTime,
  onRunAudit,
  isAuditing
 }: OverviewTabProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('OverviewTab component initialized', {
      componentName: 'OverviewTab'
    });
  }, []);

  const score = stats.total === 0 ? 100 : Math.round((1 - (stats.errors / 50)) * 100);
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${accessibleColorClasses['text-primary']}`}>
              Overall Score
            </h3>
            {stats.total === 0 ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangleIcon className="h-6 w-6 text-yellow-600" />
            )}
          </div>
          <div className="text-3xl font-bold">
            {score}%
          </div>
          <p className={`text-sm mt-2 ${accessibleColorClasses['text-muted']}`}>
            {stats.total === 0 ? 'Fully accessible!' : `${stats.total} issues found`}
          </p>
        </div>

        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
            Issue Breakdown
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <XCircleIcon className="h-4 w-4 text-red-600" />
                <span className={accessibleColorClasses['text-secondary']}>Errors</span>
              </span>
              <span className="font-medium">{stats.errors}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />
                <span className={accessibleColorClasses['text-secondary']}>Warnings</span>
              </span>
              <span className="font-medium">{stats.warnings}</span>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
            Last Audit
          </h3>
          <div className="space-y-2">
            <p className={accessibleColorClasses['text-secondary']}>
              {lastAuditTime ? lastAuditTime.toLocaleString() : 'Never'}
            </p>
            <button
              onClick={onRunAudit}
              disabled={isAuditing}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                isAuditing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories Breakdown */}
      {Object.keys(stats.byCategory || {}).length > 0 && (
        <div className={`p-6 rounded-lg border ${accessibleColorClasses['border-default']} ${accessibleColorClasses['bg-secondary']}`}>
          <h3 className={`font-semibold mb-4 ${accessibleColorClasses['text-primary']}`}>
            Issues by Category
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byCategory || {}).map(([category, count]) => (
              <div key={category} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className={`text-sm ${accessibleColorClasses['text-muted']} capitalize`}>
                  {category}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default OverviewTab;