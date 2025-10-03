import { useState, useCallback } from 'react';
import type { BulkEditChanges } from '../components/bulk-edit/EditOptionsPanel';

interface EditHistory {
  changes: BulkEditChanges;
  selectedIds: Set<string>;
  timestamp: number;
}

export function useBulkEditHistory() {
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addToHistory = useCallback((changes: BulkEditChanges, selectedIds: Set<string>) => {
    const newEntry: EditHistory = {
      changes: { ...changes },
      selectedIds: new Set(selectedIds),
      timestamp: Date.now()
    };
    
    // Remove any future history if we're not at the end
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(newEntry);
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [editHistory, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = editHistory[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      return prevState;
    }
    return null;
  }, [historyIndex, editHistory]);

  const redo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      const nextState = editHistory[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      return nextState;
    }
    return null;
  }, [historyIndex, editHistory]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < editHistory.length - 1;

  return {
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo
  };
}