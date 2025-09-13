import { memo, useEffect } from 'react';
import { SettingsIcon, LockIcon, UnlockIcon, XIcon } from '../../icons';
import type { DashboardWidget } from '../../../services/dashboardBuilderService';
import { DashboardBuilderService } from '../../../services/dashboardBuilderService';
import { logger } from '../../../services/loggingService';

interface WidgetCardProps {
  widget: DashboardWidget;
  isEditMode: boolean;
  onEdit: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

/**
 * Individual widget card component
 */
export const WidgetCard = memo(function WidgetCard({
  widget,
  isEditMode,
  onEdit,
  onToggleLock,
  onRemove
}: WidgetCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('WidgetCard component initialized', {
      componentName: 'WidgetCard'
    });
  }, []);

  const widgetInfo = DashboardBuilderService.WIDGET_CATALOG.find(w => w.id === widget.type);
  
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-full"
      data-grid={{
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w,
        h: widget.layout.h,
        minW: widget.layout.minW,
        minH: widget.layout.minH,
        static: widget.locked || !isEditMode
      }}
    >
      {/* Widget Header */}
      <div className="px-4 py-2 bg-blue-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-sm">{widget.title}</h3>
        {isEditMode && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(widget.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={() => onToggleLock(widget.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {widget.locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
            </button>
            <button
              onClick={() => onRemove(widget.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded transition-colors"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
      </div>
      
      {/* Widget Content */}
      <div className="p-4 h-full">
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">
              {widgetInfo?.icon}
            </div>
            <p className="text-sm">{widget.title}</p>
            <p className="text-xs mt-1">Widget Placeholder</p>
          </div>
        </div>
      </div>
    </div>
  );
});