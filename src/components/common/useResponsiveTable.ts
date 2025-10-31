import React from 'react';

export const useResponsiveTable = () => {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  const toggleRow = React.useCallback((key: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = React.useCallback((keys: string[]) => {
    setSelectedRows(new Set(keys));
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  return {
    selectedRows,
    toggleRow,
    selectAll,
    clearSelection
  };
};
