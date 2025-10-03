import React, { useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useMobileOptimizations } from '../../hooks/useMobileOptimizations';

interface MobileOptimizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  threshold?: number;
}

export function MobileOptimizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  threshold = 10
}: MobileOptimizedListProps<T>) {
  const { isMobile, shouldLazyLoad } = useMobileOptimizations();

  // Use virtualization only when needed
  const shouldVirtualize = isMobile ? items.length > threshold : items.length > threshold * 2;

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  ), [items, renderItem]);

  if (!shouldVirtualize) {
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
      overscanCount={isMobile ? 2 : 5} // Reduce overscan on mobile
    >
      {Row}
    </List>
  );
}