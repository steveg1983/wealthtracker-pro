import React, { useEffect, memo } from 'react';
import DashboardWidget from '../../DashboardWidget';
import type { WidgetConfig } from '../../DashboardWidget';
import { GridIcon, PlusIcon } from '../../icons';
import { logger } from '../../../services/loggingService';

interface DashboardGridProps {
  visibleWidgets: WidgetConfig[];
  isDragMode: boolean;
  onWidgetConfigChange: (config: WidgetConfig) => void;
  onRemoveWidget: (widgetId: string) => void;
  onShowAddWidget: () => void;
  renderWidget: (config: WidgetConfig) => React.ReactNode;
}

const DashboardGrid = memo(function DashboardGrid({
  visibleWidgets,
  isDragMode,
  onWidgetConfigChange,
  onRemoveWidget,
  onShowAddWidget,
  renderWidget
}: DashboardGridProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardGrid component initialized', {
      componentName: 'DashboardGrid'
    });
  }, []);

  if (visibleWidgets.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <div className="text-gray-400 mb-4">
          <GridIcon size={48} className="mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No widgets visible
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Add some widgets to customize your dashboard
        </p>
        <button
          onClick={onShowAddWidget}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
        >
          <PlusIcon size={16} />
          Add Your First Widget
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
      {visibleWidgets.map((config) => (
        <DashboardWidget
          key={config.id}
          config={config}
          onConfigChange={onWidgetConfigChange}
          onRemove={onRemoveWidget}
          isDragMode={isDragMode}
        >
          {renderWidget(config)}
        </DashboardWidget>
      ))}
    </div>
  );
});

export default DashboardGrid;