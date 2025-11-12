import React, { useState, useEffect } from 'react';
import { AccessibilityAuditor } from '../utils/accessibility-audit';
import { AlertTriangle, CheckCircle, Info, X } from './icons';

export default function AccessibilityAuditPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }): React.JSX.Element | null {
  const [auditResults, setAuditResults] = useState<ReturnType<AccessibilityAuditor['audit']>>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  const runAudit = () => {
    setIsAuditing(true);
    const auditor = new AccessibilityAuditor();
    const results = auditor.audit();
    setAuditResults(results);
    setIsAuditing(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const errors = auditResults.filter(r => r.severity === 'error');
  const warnings = auditResults.filter(r => r.severity === 'warning');
  const info = auditResults.filter(r => r.severity === 'info');

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle size={16} className="text-red-600" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-600" />;
      case 'info':
        return <Info size={16} className="text-blue-600" />;
      default:
        return null;
    }
  };

  const highlightElement = (element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.style.outline = '3px solid red';
    element.style.outlineOffset = '2px';
    setTimeout(() => {
      element.style.outline = '';
      element.style.outlineOffset = '';
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Accessibility Audit Results
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close audit panel"
            >
              <X size={24} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-gray-700 dark:text-gray-300">
                {errors.length} Errors
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-600" />
              <span className="text-gray-700 dark:text-gray-300">
                {warnings.length} Warnings
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Info size={16} className="text-blue-600" />
              <span className="text-gray-700 dark:text-gray-300">
                {info.length} Info
              </span>
            </div>
            {auditResults.length === 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-green-600">No issues found!</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {isAuditing ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Running accessibility audit...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditResults.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    Great job! No accessibility issues found.
                  </p>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Your application meets accessibility standards.
                  </p>
                </div>
              ) : (
                auditResults.map((result, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(result.severity)}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {result.issue}
                        </h3>
                        {result.wcagCriteria && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            WCAG: {result.wcagCriteria}
                          </p>
                        )}
                        {result.suggestion && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <strong>Fix:</strong> {result.suggestion}
                          </p>
                        )}
                        <button
                          onClick={() => highlightElement(result.element)}
                          className="mt-2 text-sm text-primary hover:underline"
                        >
                          Show element
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <button
              onClick={runAudit}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Re-run Audit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}