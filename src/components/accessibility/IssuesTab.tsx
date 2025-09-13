import React, { useEffect, memo } from 'react';
import { XCircleIcon, AlertTriangleIcon, CheckCircleIcon } from '../icons';
import { accessibleColorClasses } from '../../design-system/accessible-colors';
import type { AccessibilityIssue } from '../../services/accessibilityDashboardService';
import { logger } from '../../services/loggingService';

interface IssuesTabProps {
  issues: AccessibilityIssue[];
}

const IssuesTab = memo(function IssuesTab({ issues }: IssuesTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('IssuesTab component initialized', {
      componentName: 'IssuesTab'
    });
  }, []);

  if (issues.length === 0) {
    return (
      <div className={`text-center py-12 ${accessibleColorClasses['text-secondary']}`}>
        <CheckCircleIcon className="h-12 w-12 mx-auto mb-4 text-green-600" />
        <p className="text-lg">No accessibility issues found!</p>
        <p className="text-sm mt-2">Your app meets WCAG 2.1 AA standards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {issues.map((issue, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg border ${accessibleColorClasses['border-default']} ${
            issue.type === 'error' ? 'border-red-300 dark:border-red-700' : 'border-yellow-300 dark:border-yellow-700'
          }`}
        >
          <div className="flex items-start gap-3">
            {issue.type === 'error' ? (
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            ) : (
              <AlertTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`font-medium ${accessibleColorClasses['text-primary']}`}>
                {issue.message}
              </h4>
              {issue.wcagCriteria && (
                <p className={`text-sm mt-1 ${accessibleColorClasses['text-muted']}`}>
                  WCAG {issue.wcagCriteria}
                </p>
              )}
              {issue.howToFix && (
                <p className={`text-sm mt-2 ${accessibleColorClasses['text-secondary']}`}>
                  <strong>How to fix:</strong> {issue.howToFix}
                </p>
              )}
              <p className={`text-xs mt-2 font-mono ${accessibleColorClasses['text-muted']}`}>
                {issue.element.tagName.toLowerCase()}
                {issue.element.className && `.${issue.element.className.split(' ')[0]}`}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default IssuesTab;