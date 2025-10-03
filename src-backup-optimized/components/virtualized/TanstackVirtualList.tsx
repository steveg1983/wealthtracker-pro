/**
 * Tanstack Virtual List Component
 * Alternative virtualization using @tanstack/react-virtual
 */

import React, { memo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VirtualizedListService } from '../../services/virtualizedListService';
import { useLogger } from '../services/ServiceProvider';

interface TanstackVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemSize?: number;
  overscan?: number;
  className?: string;
  useWindowScroll?: boolean;
  horizontal?: boolean;
}

export function TanstackVirtualList<T>({ items,
  renderItem,
  estimatedItemSize = 60,
  overscan = 5,
  className = '',
  useWindowScroll = false,
  horizontal = false
 }: TanstackVirtualListProps<T>) {
  const logger = useLogger();
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLElement>();

  useEffect(() => {
    scrollingRef.current = useWindowScroll 
      ? document.documentElement
      : parentRef.current || undefined;
  }, [useWindowScroll]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollingRef.current || null,
    estimateSize: () => estimatedItemSize,
    overscan,
    horizontal
  });

  const virtualItems = virtualizer.getVirtualItems();
  const dimensions = VirtualizedListService.getListDimensions(
    virtualizer.getTotalSize(),
    horizontal
  );

  return (
    <div 
      ref={parentRef}
      className={`${className} ${useWindowScroll ? '' : 'h-full overflow-auto'}`}
    >
      <div style={dimensions}>
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={VirtualizedListService.getItemTransform(virtualItem.start, horizontal)}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(TanstackVirtualList) as typeof TanstackVirtualList;