import { useState, useCallback, useEffect } from 'react';
import { logger } from '../../../services/loggingService';

export function useColumnDragDrop(initialOrder: string[]) {
  // Component initialization logging
  useEffect(() => {
    logger.info('useColumnDragDrop component initialized', {
      componentName: 'useColumnDragDrop'
    });
  }, []);

  const [columnOrder, setColumnOrder] = useState(initialOrder);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = useCallback((column: string, e: React.DragEvent) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
    
    // Create a custom drag image with enhanced styling
    const dragImage = document.createElement('div');
    const columnLabels: Record<string, string> = {
      date: 'Date',
      reconciled: '✓',
      account: 'Account',
      description: 'Description',
      category: 'Category',
      amount: 'Amount',
      actions: 'Actions'
    };
    
    dragImage.textContent = columnLabels[column] || column;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 12px 24px;
      background: rgba(107, 134, 179, 0.95);
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(10px);
      z-index: 1000;
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, []);

  const handleDragOver = useCallback((column: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((targetColumn: string, e: React.DragEvent) => {
    e.preventDefault();
    const draggedCol = e.dataTransfer.getData('text/plain');
    
    if (draggedCol && draggedCol !== targetColumn) {
      const newOrder = [...columnOrder];
      const draggedIndex = newOrder.indexOf(draggedCol);
      const targetIndex = newOrder.indexOf(targetColumn);
      
      // Remove dragged column from its current position
      newOrder.splice(draggedIndex, 1);
      
      // Insert dragged column at target position
      newOrder.splice(targetIndex, 0, draggedCol);
      
      setColumnOrder(newOrder);
    }
    
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [columnOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  return {
    columnOrder,
    draggedColumn,
    dragOverColumn,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  };
}