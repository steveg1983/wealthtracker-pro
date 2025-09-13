import { memo, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { ReportSection } from '../../../services/reportGeneratorService';
import { logger } from '../../../services/loggingService';

interface SectionSelectorProps {
  sections: ReportSection[];
  onSectionToggle: (sectionId: string) => void;
}

/**
 * Report section selector component
 */
export const SectionSelector = memo(function SectionSelector({
  sections,
  onSectionToggle
}: SectionSelectorProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SectionSelector component initialized', {
      componentName: 'SectionSelector'
    });
  }, []);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Report Sections
      </label>
      <div className="space-y-2">
        {sections.map(section => (
          <div
            key={section.id}
            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSectionToggle(section.id)}
                className="text-gray-600 dark:text-gray-400"
              >
                {section.enabled ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {section.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {section.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});