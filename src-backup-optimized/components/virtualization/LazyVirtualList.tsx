import React, { useEffect, Suspense, lazy, ComponentType } from 'react';
import { Skeleton } from '../loading/Skeleton';
import { useLogger } from '../services/ServiceProvider';

// Lazy load the virtualized list components with named exports
const VirtualizedList = lazy(() => 
  import('../VirtualizedList').then(m => ({ default: m.VirtualizedList }))
);
const VirtualizedTransactionList = lazy(() => 
  import('../VirtualizedTransactionList').then(m => ({ default: m.VirtualizedTransactionList }))
);
const VirtualizedListSystem = lazy(() => 
  import('../VirtualizedListSystem').then(m => ({ default: m.VirtualizedList }))
);
const VirtualizedAccountList = lazy(() => 
  import('../VirtualizedAccountList').then(m => ({ default: m.VirtualizedAccountList }))
);
const VirtualizedSearchResults = lazy(() => 
  import('../VirtualizedSearchResults').then(m => ({ default: m.VirtualizedSearchResults }))
);
const VirtualizedCategorySelector = lazy(() => 
  import('../VirtualizedCategorySelector').then(m => ({ default: m.VirtualizedCategorySelector }))
);
const InfiniteScrollTransactionList = lazy(() => 
  import('../InfiniteScrollTransactionList').then(m => ({ default: m.InfiniteScrollTransactionList }))
);

// Loading component for lists
function ListSkeleton({ itemCount = 10  }: { itemCount?: number }) {
  const logger = useLogger();
  return (
    <div className="space-y-2">
      {Array.from({ length: itemCount }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Higher-order component to wrap any virtualized list with lazy loading
export function withLazyVirtualization<P extends object>(
  Component: ComponentType<P>
): ComponentType<P> {
  return function LazyVirtualizedComponent(props: P) {
    return (
      <Suspense fallback={<ListSkeleton />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Export lazy-loaded versions
export const LazyVirtualizedList = withLazyVirtualization(VirtualizedList);
export const LazyVirtualizedTransactionList = withLazyVirtualization(VirtualizedTransactionList);
export const LazyVirtualizedListSystem = withLazyVirtualization(VirtualizedListSystem);
export const LazyVirtualizedAccountList = withLazyVirtualization(VirtualizedAccountList);
export const LazyVirtualizedSearchResults = withLazyVirtualization(VirtualizedSearchResults);
export const LazyVirtualizedCategorySelector = withLazyVirtualization(VirtualizedCategorySelector);
export const LazyInfiniteScrollTransactionList = withLazyVirtualization(InfiniteScrollTransactionList);

// Direct lazy exports for simpler usage
export { 
  VirtualizedList as LazyList,
  VirtualizedTransactionList as LazyTransactionList,
  InfiniteScrollTransactionList as LazyInfiniteList
};