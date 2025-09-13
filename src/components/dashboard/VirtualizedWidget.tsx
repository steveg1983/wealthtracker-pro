import { memo, Suspense, ReactNode, useEffect, useRef, useState } from 'react';
import { DraggableWidget } from './DraggableWidget';
import { logger } from '../../services/loggingService';

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  isCompact?: boolean;
  settings?: Record<string, unknown>;
}

interface VirtualizedWidgetProps {
  widget: Widget;
  isEditMode: boolean;
  onRemove: () => void;
  onToggleSize: () => void;
  children: ReactNode;
}

/**
 * Widget loading skeleton component
 */
export const WidgetSkeleton = memo(function WidgetSkeleton({ size }: { size: string }) {
  return (
    <div className={`
      animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg p-4
      ${size === 'small' ? 'h-32' : size === 'medium' ? 'h-48' : 'h-64'}
    `}>
      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
      </div>
    </div>
  );
});

/**
 * Virtualized widget with lazy loading and intersection observer
 * Extracted from OptimizedDashboard for single responsibility
 */
export const VirtualizedWidget = memo(function VirtualizedWidget({ 
  widget, 
  isEditMode, 
  onRemove, 
  onToggleSize, 
  children 
}: VirtualizedWidgetProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('VirtualizedWidget component initialized', {
      componentName: 'VirtualizedWidget'
    });
  }, []);

  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let hasIntersected = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          // Simulate triggerOnce behavior
          if (!hasIntersected) {
            hasIntersected = true;
            observer.unobserve(el);
          }
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {inView ? (
        <DraggableWidget
          id={widget.id}
          title={widget.title}
          isEditMode={isEditMode}
          isCompact={widget.isCompact}
          onRemove={onRemove}
          onToggleSize={onToggleSize}
        >
          <Suspense fallback={<WidgetSkeleton size={widget.size} />}>
            {children}
          </Suspense>
        </DraggableWidget>
      ) : (
        <WidgetSkeleton size={widget.size} />
      )}
    </div>
  );
});
