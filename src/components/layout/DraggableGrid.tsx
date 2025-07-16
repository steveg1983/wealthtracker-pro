import type { ReactNode } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './DraggableGrid.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DraggableGridProps {
  layouts: { lg: Layout[] };
  onLayoutChange: (layout: Layout[]) => void;
  children: ReactNode;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export function DraggableGrid({
  layouts,
  onLayoutChange,
  children,
  isDraggable = true,
  isResizable = true,
}: DraggableGridProps) {
  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      onLayoutChange={(layout) => onLayoutChange(layout)}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={60}
      isDraggable={isDraggable}
      isResizable={isResizable}
      draggableHandle=".drag-handle"
      margin={[0, 16]}
    >
      {children}
    </ResponsiveGridLayout>
  );
}