import React, { useEffect, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, CheckIcon, XIcon } from '../icons';
import { IconButton } from '../icons/IconButton';
import { useLogger } from '../services/ServiceProvider';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  order?: number;
}

interface SortableCategoryProps {
  category: Category;
  isEditMode: boolean;
  isDeleteMode: boolean;
  isEditing: boolean;
  editingName: string;
  onEdit: () => void;
  onDelete: () => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
  isDraggable?: boolean;
  canDelete?: boolean;
}

export const SortableCategory = memo(function SortableCategory({ category, 
  isEditMode,
  isDeleteMode, 
  isEditing, 
  editingName,
  onEdit, 
  onDelete, 
  onNameChange,
  onSave,
  onCancel,
  onClick,
  children,
  isDraggable = true,
  canDelete = false
 }: SortableCategoryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('SortableCategory component initialized', {
      componentName: 'SortableCategory'
    });
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: category.id,
    disabled: !isEditMode || !isDraggable || isDeleteMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        className={`flex items-center justify-between p-2 rounded ${
          isDragging ? 'opacity-50' : ''
        } ${
          isEditMode ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-2 flex-1">
          {isEditMode && isDraggable && (
            <div {...attributes} {...listeners} className="cursor-move text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              <GripVerticalIcon className="w-4 h-4" />
            </div>
          )}
          {!isEditMode && !isDraggable && <span className="w-4" />}
          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                else if (e.key === 'Escape') onCancel();
              }}
              className="px-2 py-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div 
              className={`flex items-center gap-2 flex-1 ${
                !isEditMode && !isDeleteMode && onClick ? 'cursor-pointer' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (isDeleteMode) {
                  onDelete();
                } else if (isEditMode) {
                  onEdit();
                } else if (onClick) {
                  onClick();
                }
              }}
            >
              <span className={`${category.level === 'sub' ? 'font-medium' : ''} text-gray-900 dark:text-white ${
                isDeleteMode ? 'hover:text-red-600 dark:hover:text-red-400' : 
                isEditMode ? 'hover:text-blue-600 dark:hover:text-blue-400' : 
                !isEditMode && !isDeleteMode ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''
              }`}>
                {category.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <IconButton
                onClick={onSave}
                icon={<CheckIcon className="w-4 h-4" />}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              />
              <IconButton
                onClick={onCancel}
                icon={<XIcon className="w-4 h-4" />}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              />
            </>
          ) : (
            <>{children}</>
          )}
        </div>
      </div>
    </div>
  );
});