import { useCallback, useState } from 'react';

interface UseInfiniteScrollResult<T> {
  visibleItems: T[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  reset: () => void;
  displayedItems: number;
}

export function useInfiniteScroll<T>(
  items: readonly T[],
  itemsPerBatch: number = 20
): UseInfiniteScrollResult<T> {
  const [displayedItems, setDisplayedItems] = useState(itemsPerBatch);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedItems(prev => Math.min(prev + itemsPerBatch, items.length));
      setIsLoadingMore(false);
    }, 300);
  }, [items.length, itemsPerBatch]);

  const reset = useCallback(() => {
    setDisplayedItems(itemsPerBatch);
  }, [itemsPerBatch]);

  const visibleItems = items.slice(0, displayedItems);
  const hasMore = displayedItems < items.length;

  return {
    visibleItems,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
    displayedItems,
  };
}

export default useInfiniteScroll;
