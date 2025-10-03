import React, { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVerticalIcon,
  XIcon,
  SettingsIcon,
  MaximizeIcon,
  MinimizeIcon
} from '../icons';

interface DraggableWidgetProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
  onSettings?: () => void;
  isEditMode?: boolean;
  isCompact?: boolean;
  onToggleSize?: () => void;
  className?: string;
  isDragging?: boolean;
}

export const DraggableWidget = forwardRef<HTMLDivElement, DraggableWidgetProps>(
  function DraggableWidget({ 
    id, 
    title, 
    children, 
    onRemove, 
    onSettings,
    isEditMode = false,
    isCompact = false,
    onToggleSize,
    className = '',
    isDragging = false
  }, ref) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isSortableDragging
    } = useSortable({ 
      id,
      disabled: !isEditMode
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isSortableDragging ? 0.5 : 1,
      cursor: isEditMode ? 'move' : 'default'
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
          transition-all duration-200 hover:shadow-md
          ${isEditMode ? 'ring-2 ring-gray-500 ring-opacity-50' : ''}
          ${isSortableDragging ? 'scale-105 shadow-xl z-50' : ''}
          ${className}
        `}
      >
        {/* Widget Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {isEditMode && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-move touch-none"
              >
                <GripVerticalIcon 
                  size={20} 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                />
              </div>
            )}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
          
          {isEditMode && (
            <div className="flex items-center gap-1">
              {onToggleSize && (
                <button
                  onClick={onToggleSize}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title={isCompact ? "Expand" : "Compact"}
                >
                  {isCompact ? (
                    <MaximizeIcon size={16} className="text-gray-500" />
                  ) : (
                    <MinimizeIcon size={16} className="text-gray-500" />
                  )}
                </button>
              )}
              
              {onSettings && (
                <button
                  onClick={onSettings}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Widget settings"
                >
                  <SettingsIcon size={16} className="text-gray-500" />
                </button>
              )}
              
              {onRemove && (
                <button
                  onClick={onRemove}
                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Remove widget"
                >
                  <XIcon size={16} className="text-red-500" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Widget Content */}
        <div className={`p-4 ${isCompact ? 'max-h-48 overflow-hidden' : ''}`}>
          {children}
        </div>
      </div>
    );
  }
);

// Static widget for non-draggable items
export function StaticWidget({ 
  title, 
  children, 
  className = '' 
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
      ${className}
    `}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}