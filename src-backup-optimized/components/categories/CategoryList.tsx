import React, { useEffect, memo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronRightIcon, ChevronDownIcon, AlertCircleIcon } from '../icons';
import { SortableCategory } from './SortableCategory';
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

interface CategoryListProps {
  categories: Category[];
  organizedCategories: {
    topLevel: Category[];
    organized: { [key: string]: Category[] };
  };
  expandedCategories: Set<string>;
  isEditMode: boolean;
  isDeleteMode: boolean;
  editingCategoryId: string | null;
  editingCategoryName: string;
  activeId: string | null;
  transactions: any[];
  onToggleExpanded: (categoryId: string) => void;
  onStartEdit: (categoryId: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartDelete: (categoryId: string) => void;
  onEditingNameChange: (name: string) => void;
  onViewTransactions: (categoryId: string, categoryName: string) => void;
  onDragStart: (event: any) => void;
  onDragEnd: (event: any) => void;
}

export const CategoryList = memo(function CategoryList({ categories,
  organizedCategories,
  expandedCategories,
  isEditMode,
  isDeleteMode,
  editingCategoryId,
  editingCategoryName,
  activeId,
  transactions,
  onToggleExpanded,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onStartDelete,
  onEditingNameChange,
  onViewTransactions,
  onDragStart,
  onDragEnd
 }: CategoryListProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CategoryList component initialized', {
      componentName: 'CategoryList'
    });
  }, []);

  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getCategoryTransactionCount = (categoryName: string) => {
    return transactions.filter(t => t.category === categoryName).length;
  };

  const renderCategoryItem = (category: Category, level: number = 0) => {
    const hasChildren = ((organizedCategories.organized[category.id]?.length) ?? 0) > 0;
    const isExpanded = expandedCategories.has(category.id);
    const transactionCount = getCategoryTransactionCount(category.name);
    const hasTransactions = transactionCount > 0;
    const canDelete = !hasChildren && !category.isSystem;

    return (
      <div key={category.id}>
        <SortableCategory
          category={category}
          isEditMode={isEditMode}
          isDeleteMode={isDeleteMode}
          isEditing={editingCategoryId === category.id}
          editingName={editingCategoryName}
          onEdit={() => onStartEdit(category.id)}
          onDelete={() => onStartDelete(category.id)}
          onNameChange={onEditingNameChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          onClick={() => { if (!isEditMode && !isDeleteMode) { onViewTransactions(category.id, category.name); } }}
          isDraggable={level === 0}
          canDelete={canDelete}
        >
          {hasChildren && (
            <button
              onClick={() => onToggleExpanded(category.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}
          {hasTransactions && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
              {transactionCount}
            </span>
          )}
          {isDeleteMode && !canDelete && (
            <div className="group relative">
              <AlertCircleIcon className="w-4 h-4 text-gray-400" />
              <div className="absolute right-0 top-6 hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 whitespace-nowrap z-10">
                {hasChildren ? 'Has subcategories' : 'System category'}
              </div>
            </div>
          )}
        </SortableCategory>
        
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
            <SortableContext
              items={organizedCategories.organized[category.id].map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {organizedCategories.organized[category.id].map(child => 
                renderCategoryItem(child, level + 1)
              )}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  const activeDragCategory = categories.find(c => c.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-1">
        <SortableContext
          items={organizedCategories.topLevel.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {organizedCategories.topLevel.map(category => renderCategoryItem(category))}
        </SortableContext>
      </div>
      
      <DragOverlay>
        {activeId && activeDragCategory ? (
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded p-2 opacity-90">
            <span className="text-gray-900 dark:text-white">
              {activeDragCategory.name}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
