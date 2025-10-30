import { useState } from 'react';

export function useResponsiveTable() {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = (keys: string[]) => {
    setSelectedRows(new Set(keys));
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
  };

  return {
    selectedRows,
    toggleRow,
    selectAll,
    clearSelection,
  };
}
