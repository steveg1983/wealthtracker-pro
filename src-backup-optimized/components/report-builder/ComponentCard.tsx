import { memo, useEffect } from 'react';
import { SettingsIcon, XIcon } from '../icons';
import type { ReportComponent } from '../../services/customReportService';
import { ComponentPreview } from './ComponentPreview';
import { useLogger } from '../services/ServiceProvider';

interface ComponentCardProps {
  component: ReportComponent;
  index: number;
  totalComponents: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateWidth: (width: 'full' | 'half' | 'third') => void;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * Component card for report builder
 */
export const ComponentCard = memo(function ComponentCard({ component,
  index,
  totalComponents,
  onMoveUp,
  onMoveDown,
  onUpdateWidth,
  onEdit,
  onRemove
 }: ComponentCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ComponentCard component initialized', {
      componentName: 'ComponentCard'
    });
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === totalComponents - 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Move down"
            >
              ▼
            </button>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {component.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Type: {component.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={component.width}
            onChange={(e) => onUpdateWidth(e.target.value as 'full' | 'half' | 'third')}
            className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
          >
            <option value="full">Full Width</option>
            <option value="half">Half Width</option>
            <option value="third">Third Width</option>
          </select>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-primary"
            title="Configure"
          >
            <SettingsIcon size={16} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600"
            title="Remove"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
      <div className="p-4">
        <ComponentPreview component={component} />
      </div>
    </div>
  );
});