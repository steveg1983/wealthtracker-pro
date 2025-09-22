import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';
import {
  DocumentTextIcon,
  TableCellsIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

interface FormatSelectorProps {
  selectedFormat: 'pdf' | 'excel' | 'csv';
  onFormatChange: (format: 'pdf' | 'excel' | 'csv') => void;
}

/**
 * Report format selector component
 */
export const FormatSelector = memo(function FormatSelector({ selectedFormat,
  onFormatChange
 }: FormatSelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('FormatSelector component initialized', {
      componentName: 'FormatSelector'
    });
  }, []);

  const formats = [
    { id: 'pdf', label: 'PDF', icon: DocumentTextIcon, color: 'text-red-600' },
    { id: 'excel', label: 'Excel', icon: TableCellsIcon, color: 'text-green-600' },
    { id: 'csv', label: 'CSV', icon: DocumentArrowDownIcon, color: 'text-gray-600' }
  ] as const;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Export Format
      </label>
      <div className="grid grid-cols-3 gap-3">
        {formats.map(format => {
          const Icon = format.icon;
          return (
            <button
              key={format.id}
              onClick={() => onFormatChange(format.id)}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${selectedFormat === format.id
                  ? 'border-gray-500 bg-blue-50 dark:bg-gray-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <Icon className={`h-6 w-6 mx-auto mb-1 ${format.color}`} />
              <span className="text-sm font-medium">{format.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});