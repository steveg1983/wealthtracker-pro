import { memo, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { WidgetRegistry } from '../widgets/WidgetRegistry';
import type { Widget } from '../../services/dashboardV2PageService';
import { logger } from '../../services/loggingService';

interface WidgetRendererProps {
  widget: Widget;
  isEditMode: boolean;
  onRemove: () => void;
  data: any;
}

export const WidgetRenderer = memo(function WidgetRenderer({
  widget,
  isEditMode,
  onRemove,
  data
}: WidgetRendererProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('WidgetRenderer component initialized', {
      componentName: 'WidgetRenderer'
    });
  }, []);

  const definition = WidgetRegistry.getWidget(widget.type);
  const WidgetComponent = definition?.component as (props: any) => React.JSX.Element | undefined;
  
  if (!WidgetComponent) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <p>Unknown widget type: {widget.type}</p>
      </div>
    );
  }
  
  return (
    <div className="relative h-full">
      {isEditMode && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 z-10 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          title="Remove widget"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
      
      <div className="p-4 h-full overflow-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {widget.title}
        </h3>
        <WidgetComponent {...data} settings={widget.settings} />
      </div>
    </div>
  );
});
