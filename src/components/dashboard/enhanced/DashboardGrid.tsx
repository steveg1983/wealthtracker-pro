import { memo, useEffect } from 'react';
import {
  SortableContext,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { DraggableWidget } from '../DraggableWidget';
import { WidgetRenderer } from './WidgetRenderer';
import type { Widget, WidgetLayout, DashboardMetrics } from '../../../services/enhancedDashboardService';
import type { Account, Transaction, Budget } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface DashboardGridProps {
  layout: WidgetLayout;
  metrics: DashboardMetrics;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  isEditMode: boolean;
  formatCurrency: (amount: number) => string;
  onRemoveWidget: (id: string) => void;
  onToggleSize: (id: string) => void;
}

/**
 * Dashboard grid with sortable widgets
 */
export const DashboardGrid = memo(function DashboardGrid({ layout,
  metrics,
  accounts,
  transactions,
  budgets,
  isEditMode,
  formatCurrency,
  onRemoveWidget,
  onToggleSize
 }: DashboardGridProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DashboardGrid component initialized', {
      componentName: 'DashboardGrid'
    });
  }, []);

  return (
    <SortableContext items={layout.order} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {layout.order.map(widgetId => {
          const widget = layout.widgets.find(w => w.id === widgetId);
          if (!widget) return null;
          
          return (
            <div
              key={widget.id}
              className={`
                ${widget.size === 'small' ? 'md:col-span-1' : ''}
                ${widget.size === 'medium' ? 'md:col-span-1 lg:col-span-1' : ''}
                ${widget.size === 'large' ? 'md:col-span-2 lg:col-span-2' : ''}
              `}
            >
              <DraggableWidget
                id={widget.id}
                title={widget.title}
                isEditMode={isEditMode}
                isCompact={widget.isCompact}
                onRemove={() => onRemoveWidget(widget.id)}
                onToggleSize={() => onToggleSize(widget.id)}
              >
                <WidgetRenderer
                  widget={widget}
                  metrics={metrics}
                  accounts={accounts}
                  transactions={transactions}
                  budgets={budgets}
                  formatCurrency={formatCurrency}
                />
              </DraggableWidget>
            </div>
          );
        })}
      </div>
    </SortableContext>
  );
});