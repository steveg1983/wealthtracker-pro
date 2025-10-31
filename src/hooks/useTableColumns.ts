import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Column } from '../components/VirtualizedTable';

interface ColumnDefinition<T> {
  key: string;
  header: string;
  width?: string | number;
  accessor: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export function useTableColumns<T>(columnDefinitions: ColumnDefinition<T>[]): Column<T>[] {
  return useMemo(() => columnDefinitions, [columnDefinitions]);
}
