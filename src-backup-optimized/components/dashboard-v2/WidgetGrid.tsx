import { memo, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { WidgetRenderer } from './WidgetRenderer';
import type { Widget, Layouts } from '../../services/dashboardV2PageService';
import { useLogger } from '../services/ServiceProvider';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface WidgetGridProps {
  widgets: Widget[];
  layouts: Layouts;
  isEditMode: boolean;
  breakpoints: Record<string, number>;
  cols: Record<string, number>;
  onLayoutChange: (currentLayout: any, allLayouts: Layouts) => void;
  onRemoveWidget: (widgetId: string) => void;
  getWidgetData: (widgetType: string) => any;
}

export const WidgetGrid = memo(function WidgetGrid({ widgets,
  layouts,
  isEditMode,
  breakpoints,
  cols,
  onLayoutChange,
  onRemoveWidget,
  getWidgetData
 }: WidgetGridProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('WidgetGrid component initialized', {
      componentName: 'WidgetGrid'
    });
  }, []);

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={breakpoints}
      cols={cols}
      rowHeight={80}
      isDraggable={isEditMode}
      isResizable={isEditMode}
      onLayoutChange={onLayoutChange}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      useCSSTransforms={true}
      compactType="vertical"
      preventCollision={false}
    >
      {widgets.map((widget) => (
        <div key={widget.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <WidgetRenderer
            widget={widget}
            isEditMode={isEditMode}
            onRemove={() => onRemoveWidget(widget.id)}
            data={getWidgetData(widget.type)}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
});