import React, { useEffect, memo, useMemo } from 'react';
import { ValidationIssueCard } from './ValidationIssueCard';
import type { ValidationIssue } from '../../services/validationChecksService';
import { useLogger } from '../services/ServiceProvider';

interface ValidationIssuesListProps {
  issues: ValidationIssue[];
  selectedIssues: Set<string>;
  onToggleSelection: (issueId: string) => void;
  onViewDetails: (issue: ValidationIssue) => void;
}

export const ValidationIssuesList = memo(function ValidationIssuesList({ issues,
  selectedIssues,
  onToggleSelection,
  onViewDetails
 }: ValidationIssuesListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ValidationIssuesList component initialized', {
      componentName: 'ValidationIssuesList'
    });
  }, []);

  
  const groupedIssues = useMemo(() => {
    const groups: { [key: string]: ValidationIssue[] } = {};
    
    issues.forEach(issue => {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
    });
    
    return groups;
  }, [issues]);

  const getSectionTitle = (type: string) => {
    switch (type) {
      case 'error':
        return 'Critical Issues';
      case 'warning':
        return 'Warnings';
      case 'info':
        return 'Information';
      default:
        return 'Other Issues';
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Issues Found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Your data is in good shape! No validation issues were detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Validation Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(groupedIssues).map(([type, typeIssues]) => (
            <div key={type} className="text-center">
              <div className={`text-2xl font-bold ${getSectionColor(type)}`}>
                {typeIssues.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getSectionTitle(type)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues by Type */}
      {['error', 'warning', 'info'].map(type => {
        const typeIssues = groupedIssues[type];
        if (!typeIssues || typeIssues.length === 0) return null;

        return (
          <div key={type}>
            <h3 className={`text-sm font-semibold mb-3 ${getSectionColor(type)}`}>
              {getSectionTitle(type)} ({typeIssues.length})
            </h3>
            <div className="space-y-3">
              {typeIssues.map(issue => (
                <ValidationIssueCard
                  key={issue.id}
                  issue={issue}
                  isSelected={selectedIssues.has(issue.id)}
                  onToggleSelection={onToggleSelection}
                  onViewDetails={onViewDetails}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});