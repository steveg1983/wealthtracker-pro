import React, { useEffect, memo, useCallback } from 'react';
import { RadioCheckbox } from '../common/RadioCheckbox';
import { logger } from '../../services/loggingService';
import { 
  AlertCircleIcon,
  CheckCircleIcon,
  WrenchIcon,
  AlertTriangleIcon,
  XCircleIcon,
  EyeIcon
} from '../icons';

interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  affectedItems: string[];
  fix?: () => Promise<any[]>;
  fixDescription?: string;
}

interface ValidationIssueCardProps {
  issue: ValidationIssue;
  isSelected: boolean;
  onToggleSelection: (issueId: string) => void;
  onViewDetails: (issue: ValidationIssue) => void;
}

export const ValidationIssueCard = memo(function ValidationIssueCard({
  issue,
  isSelected,
  onToggleSelection,
  onViewDetails
}: ValidationIssueCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ValidationIssueCard component initialized', {
      componentName: 'ValidationIssueCard'
    });
  }, []);

  
  const handleToggle = useCallback(() => {
    onToggleSelection(issue.id);
  }, [issue.id, onToggleSelection]);

  const handleViewDetails = useCallback(() => {
    onViewDetails(issue);
  }, [issue, onViewDetails]);

  const getIcon = () => {
    switch (issue.type) {
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <AlertCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (issue.type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getBgColor()}`}>
      <div className="flex items-start space-x-3">
        {issue.fix && (
          <RadioCheckbox
            checked={isSelected}
            onChange={handleToggle}
            className="mt-0.5"
          />
        )}
        {getIcon()}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {issue.category}
              </h4>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {issue.description}
              </p>
              {issue.fixDescription && (
                <div className="mt-2 flex items-center space-x-2">
                  <WrenchIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Fix: {issue.fixDescription}
                  </span>
                </div>
              )}
            </div>
            {issue.affectedItems.length > 0 && (
              <button
                onClick={handleViewDetails}
                className="ml-4 p-1 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                title="View affected items"
              >
                <EyeIcon className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});