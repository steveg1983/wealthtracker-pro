import React, { useEffect, memo } from 'react';
import { REPORT_TEMPLATES, type ReportTemplate } from '../../config/exportTemplates';
import { CheckCircleIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ExportTemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (template: ReportTemplate) => void;
}

export const ExportTemplateSelector = memo(function ExportTemplateSelector({
  selectedTemplate,
  onSelectTemplate
}: ExportTemplateSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ExportTemplateSelector component initialized', {
      componentName: 'ExportTemplateSelector'
    });
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Select Report Template
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TEMPLATES.map(template => {
          const Icon = template.icon;
          const isSelected = selectedTemplate === template.id;
          
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected 
                      ? 'bg-blue-100 dark:bg-blue-800' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`${
                      isSelected ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                    }`} size={20} />
                  </div>
                  <div>
                    <p className={`font-medium ${
                      isSelected 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {template.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {template.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircleIcon className="text-blue-500 flex-shrink-0" size={20} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});