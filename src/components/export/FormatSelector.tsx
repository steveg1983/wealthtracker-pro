/**
 * Format Selector Component
 * Allows selection of export format
 */

import React, { useEffect } from 'react';
import { 
  DocumentArrowDownIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import type { ExportFormat, FormatOption } from '../../services/exportModalService';
import { logger } from '../../services/loggingService';

interface FormatSelectorProps {
  selectedFormat: ExportFormat;
  formatOptions: FormatOption[];
  onFormatChange: (format: ExportFormat) => void;
}

const IconMap = {
  'table-cells': TableCellsIcon,
  'document-text': DocumentTextIcon,
  'document-chart-bar': DocumentChartBarIcon,
  'document-arrow-down': DocumentArrowDownIcon
};

const FormatSelector = React.memo(({
  selectedFormat,
  formatOptions,
  onFormatChange
}: FormatSelectorProps) => {
  // Component initialization logging
  useEffect(() => {
    try {
      logger.info('FormatSelector component initialized', {
        selectedFormat,
        formatOptionsCount: formatOptions.length,
        componentName: 'FormatSelector'
      });
    } catch (error) {
      logger.error('FormatSelector initialization failed:', error, 'FormatSelector');
    }
  }, [selectedFormat, formatOptions.length]);

  try {
    return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Export Format
      </label>
      <div className="grid grid-cols-3 gap-3">
        {formatOptions.map(format => {
          const Icon = IconMap[format.icon as keyof typeof IconMap] || DocumentTextIcon;
          return (
            <button
              key={format.value}
              onClick={() => {
                try {
                  logger.debug('Export format selected', { 
                    selectedFormat: format.value, 
                    componentName: 'FormatSelector' 
                  });
                  onFormatChange(format.value);
                } catch (error) {
                  logger.error('Failed to handle format change:', error, 'FormatSelector');
                }
              }}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                selectedFormat === format.value
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {selectedFormat === format.value && (
                <CheckIcon className="absolute top-2 right-2 h-4 w-4 text-gray-600 dark:text-gray-500" />
              )}
              <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-1" />
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {format.label || 'Unknown Format'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format.description || 'No description available'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
    );
  } catch (error) {
    logger.error('Failed to render FormatSelector:', error, 'FormatSelector');
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Export Format
        </label>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
          <div className="text-red-600 dark:text-red-400 text-sm">
            Error loading export format options. Please try again.
          </div>
        </div>
      </div>
    );
  }
});

FormatSelector.displayName = 'FormatSelector';

export default FormatSelector;