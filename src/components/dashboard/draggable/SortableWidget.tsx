import { memo, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, XIcon, MinimizeIcon, MaximizeIcon } from '../../icons';
import { WidgetRenderer } from './WidgetRenderer';
import type { Widget } from '../../../services/dashboardLayoutService';
import { useLogger } from '../services/ServiceProvider';

interface SortableWidgetProps {
  widget: Widget;
  isEditMode: boolean;
  metrics: any;
  accounts: any[];
  transactions: any[];
  budgets: any[];
  formatCurrency: (amount: number) => string;
  onRemove: (widgetId: string) => void;
  onToggleCompact: (widgetId: string) => void;
}

/**
 * Sortable widget wrapper component
 * Handles drag-and-drop functionality for individual widgets
 */
export const SortableWidget = memo(function SortableWidget({ widget,
  isEditMode,
  metrics,
  accounts,
  transactions,
  budgets,
  formatCurrency,
  onRemove,
  onToggleCompact
 }: SortableWidgetProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SortableWidget component initialized', {
      componentName: 'SortableWidget'
    });
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getWidgetSizeClass = () => {
    if (widget.isCompact) return 'col-span-1';
    switch (widget.size) {
      case 'small': return 'col-span-1';
      case 'large': return 'col-span-1 lg:col-span-2';
      default: return 'col-span-1';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${getWidgetSizeClass()} ${isDragging ? 'z-50' : ''}`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
        {/* Widget Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-move text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <GripVerticalIcon size={20} />
              </button>
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {widget.title}
            </h3>
          </div>
          
          {isEditMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleCompact(widget.id)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                title={widget.isCompact ? 'Expand' : 'Compact'}
              >
                {widget.isCompact ? <MaximizeIcon size={16} /> : <MinimizeIcon size={16} />}
              </button>
              <button
                onClick={() => onRemove(widget.id)}
                className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                title="Remove widget"
              >
                <XIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Widget Content */}
        <WidgetRenderer
          widget={widget}
          metrics={metrics}
          accounts={accounts}
          transactions={transactions}
          budgets={budgets}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
});