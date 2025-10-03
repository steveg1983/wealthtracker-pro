import { useState, useCallback, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface ColumnWidths {
  date: number;
  reconciled: number;
  account: number;
  description: number;
  category: number;
  amount: number;
  actions: number;
}

export function useColumnResize(initialWidths: ColumnWidths) {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('useColumnResize component initialized', {
      componentName: 'useColumnResize'
    });
  }, []);

  const [columnWidths, setColumnWidths] = useState(initialWidths);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column as keyof ColumnWidths]);
  }, [columnWidths]);

  // Add mouse event listeners when resizing
  useEffect(() => {
    if (isResizing) {
      const handleMouseMoveEvent = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        
        setColumnWidths(prev => ({
          ...prev,
          [isResizing]: newWidth
        }));
      };

      const handleMouseUpEvent = () => {
        setIsResizing(null);
      };

      document.addEventListener('mousemove', handleMouseMoveEvent);
      document.addEventListener('mouseup', handleMouseUpEvent);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveEvent);
        document.removeEventListener('mouseup', handleMouseUpEvent);
      };
    }
  }, [isResizing, startX, startWidth]);

  return {
    columnWidths,
    isResizing,
    handleMouseDown
  };
}