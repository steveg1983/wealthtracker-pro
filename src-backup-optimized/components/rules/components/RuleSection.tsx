/**
 * Rule Section Component
 * Renders a section with title and add button
 */

import React, { useEffect, memo } from 'react';
import { PlusIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface RuleSectionProps {
  title: string;
  subtitle?: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
}

export const RuleSection = memo(function RuleSection({ title,
  subtitle,
  onAdd,
  addLabel,
  children
 }: RuleSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RuleSection component initialized', {
      componentName: 'RuleSection'
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {title} {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
        </h4>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-secondary text-sm"
        >
          <PlusIcon size={14} />
          {addLabel}
        </button>
      </div>
      
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
});