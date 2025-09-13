/**
 * Template Card Component
 * Displays individual layout template information
 */

import React, { useEffect, memo } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { layoutTemplatesService } from '../../../services/layoutTemplatesService';
import type { LayoutTemplate } from '../../../services/layoutTemplatesService';
import { logger } from '../../../services/loggingService';

interface TemplateCardProps {
  template: LayoutTemplate;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}

export const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  onSelect
}: TemplateCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('TemplateCard component initialized', {
      componentName: 'TemplateCard'
    });
  }, []);

  const categoryColor = layoutTemplatesService.getCategoryColor(template.category);

  return (
    <div
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      onClick={() => onSelect(template.id)}
    >
      {isSelected && (
        <CheckIcon className="absolute top-4 right-4 h-5 w-5 text-gray-600 dark:text-gray-500" />
      )}
      
      <div className="flex items-start space-x-3">
        <div className="text-gray-600 dark:text-gray-400">
          {template.icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
            {template.name}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {template.description}
          </p>
          
          <div className="flex items-center justify-between">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${categoryColor}`}>
              {template.category}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {template.widgets.length} widgets
            </span>
          </div>
          
          {/* Widget Preview */}
          <div className="mt-3 flex flex-wrap gap-1">
            {template.widgets.slice(0, 5).map(widget => (
              <span 
                key={widget}
                className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
              >
                {layoutTemplatesService.formatWidgetTitle(widget)}
              </span>
            ))}
            {template.widgets.length > 5 && (
              <span className="inline-block px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                +{template.widgets.length - 5} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});