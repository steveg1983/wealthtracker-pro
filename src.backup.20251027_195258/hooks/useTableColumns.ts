import { useMemo, type ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  width?: string | number;
  accessor: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export function useTableColumns<T>(
  columnDefinitions: Array<TableColumn<T>>
): Array<TableColumn<T>> {
  return useMemo(() => columnDefinitions, [columnDefinitions]);
}
