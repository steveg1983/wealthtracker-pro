import { memo } from 'react';
import { LoadingIcon } from '../icons';
import type { ListChildComponentProps } from 'react-window';
import { useLogger } from '../services/ServiceProvider';

interface VirtualizedRowProps<T> extends ListChildComponentProps<T[]> {
  isItemLoaded: (index: number) => boolean;
  renderItem: (item: T, index: number, isScrolling?: boolean) => React.ReactNode;
}

export const VirtualizedRow = memo(function VirtualizedRow<T>({ index,
  style,
  isScrolling,
  data,
  isItemLoaded,
  renderItem
 }: VirtualizedRowProps<T>) {
  const logger = useLogger();
  if (!isItemLoaded(index)) {
    return (
      <div style={style} className="flex items-center justify-center p-4">
        <LoadingIcon size={24} className="animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading more...</span>
      </div>
    );
  }

  const item = data[index];
  if (!item) return null;

  return (
    <div style={style} className="virtualized-item">
      {renderItem(item, index, isScrolling)}
    </div>
  );
}) as <T>(props: VirtualizedRowProps<T>) => JSX.Element;

(VirtualizedRow as any).displayName = 'VirtualizedRow';