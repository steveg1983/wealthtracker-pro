import React, { useState } from 'react';
import { useAccessibilityAudit } from '../hooks/useAccessibilityAudit';

interface AccessibilityAuditOverlayProps {
  autoAudit?: boolean;
  auditDelay?: number;
  rootElement?: HTMLElement | null;
}

export function AccessibilityAuditOverlay({
  autoAudit = false,
  auditDelay = 1_000,
  rootElement,
}: AccessibilityAuditOverlayProps): React.ReactElement | null {
  const resolvedRootElement = rootElement ?? null;
  const { issues, stats, runAudit, isAuditing } = useAccessibilityAudit({
    autoAudit,
    auditDelay,
    rootElement: resolvedRootElement,
  });
  const [isVisible, setIsVisible] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 left-4 z-50 bg-purple-600 text-white rounded-full p-3 shadow-lg hover:bg-purple-700 transition-colors"
        title="Toggle Accessibility Audit (Ctrl+Shift+A)"
      >
        <span className="sr-only">Toggle Accessibility Audit</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        {stats.total > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
            {stats.errors || stats.total}
          </span>
        )}
      </button>

      {isVisible && (
        <div className="fixed bottom-16 left-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Accessibility Audit</h2>
            <button
              onClick={runAudit}
              disabled={isAuditing}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>

          {stats.total === 0 ? (
            <p className="text-green-600 dark:text-green-400">✅ No accessibility issues found!</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <span className="text-red-700 dark:text-red-300 font-medium">{stats.errors}</span> errors
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                  <span className="text-yellow-700 dark:text-yellow-300 font-medium">{stats.warnings}</span> warnings
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-sm">Issues by Category:</h3>
                {Object.entries(stats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex justify-between text-sm">
                    <span>{category}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium">View All Issues</summary>
                <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                  {issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${
                        issue.type === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-yellow-50 dark:bg-yellow-900/20'
                      }`}
                    >
                      <div className="font-medium">{issue.message}</div>
                      {issue.wcagCriteria && (
                        <div className="text-gray-600 dark:text-gray-400">
                          WCAG: {issue.wcagCriteria}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </>
  );
}
