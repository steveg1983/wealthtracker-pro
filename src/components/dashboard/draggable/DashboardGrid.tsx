import { memo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';
import type { Widget } from '../../../services/dashboardLayoutService';
import { logger } from '../../../services/loggingService';

interface DashboardGridProps {
  widgets: Widget[];
  widgetOrder: string[];
  isEditMode: boolean;
  metrics: any;
  accounts: any[];
  transactions: any[];
  budgets: any[];
  formatCurrency: (amount: number) => string;
  onDragEnd: (event: DragEndEvent) => void;
  onRemoveWidget: (widgetId: string) => void;
  onToggleCompact: (widgetId: string) => void;
}

/**
 * Dashboard grid component
 * Handles the drag-and-drop grid layout of widgets
 */
export const DashboardGrid = memo(function DashboardGrid({
  widgets,
  widgetOrder,
  isEditMode,
  metrics,
  accounts,
  transactions,
  budgets,
  formatCurrency,
  onDragEnd,
  onRemoveWidget,
  onToggleCompact
}: DashboardGridProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardGrid component initialized', {
      componentName: 'DashboardGrid'
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedWidgets = widgetOrder
    .map(id => widgets.find(w => w.id === id))
    .filter((w): w is Widget => w !== undefined);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={widgetOrder}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orderedWidgets.map(widget => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              metrics={metrics}
              accounts={accounts}
              transactions={transactions}
              budgets={budgets}
              formatCurrency={formatCurrency}
              onRemove={onRemoveWidget}
              onToggleCompact={onToggleCompact}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
});