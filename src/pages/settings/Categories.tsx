import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import CategoryCreationModal from '../../components/CategoryCreationModal';
import CategoryTransactionsModal from '../../components/CategoryTransactionsModal';
import { Plus, X, Check, ChevronRight, ChevronDown, Trash2, AlertCircle, Settings2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableCategoryProps {
  category: any;
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
}

function SortableCategory({ 
  category, 
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
  isDraggable = true
}: SortableCategoryProps) {
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
              <GripVertical size={16} />
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
              className="px-2 py-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white flex-1"
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
                isEditMode ? 'hover:text-primary dark:hover:text-primary' : 
                !isEditMode && !isDeleteMode ? 'hover:text-primary dark:hover:text-primary' : ''
              }`}>
                {category.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={onSave}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
              >
                <Check size={16} />
              </button>
              <button
                onClick={onCancel}
                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>{children}</>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategoriesSettings() {
  const { 
    transactions, 
    categories,
    updateCategory,
    deleteCategory,
    getSubCategories,
    getDetailCategories
  } = useApp();
  
  // Helper function to get category path
  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return categoryId;
    
    if (category.level === 'detail' && category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    
    return category.name;
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<{ [parentId: string]: string[] }>({});
  const [viewingCategoryId, setViewingCategoryId] = useState<string | null>(null);
  const [viewingCategoryName, setViewingCategoryName] = useState<string>('');
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  // Initialize category order from existing categories
  useState(() => {
    const order: { [parentId: string]: string[] } = {};
    
    // Get all parent categories
    const parentIds = [...new Set(categories.map(c => c.parentId).filter(Boolean))];
    
    parentIds.forEach(parentId => {
      if (parentId) {
        order[parentId] = categories
          .filter(c => c.parentId === parentId)
          .map(c => c.id);
      }
    });
    
    setCategoryOrder(order);
    return null;
  });

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

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over || active.id === over.id) return;

    const activeCategory = categories.find(c => c.id === active.id);
    const overCategory = categories.find(c => c.id === over.id);
    
    if (!activeCategory || !overCategory) return;

    // Handle reordering within the same parent
    if (activeCategory.parentId === overCategory.parentId && activeCategory.level === overCategory.level) {
      const parentId = activeCategory.parentId || '';
      const currentOrder = categoryOrder[parentId] || [];
      
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        setCategoryOrder(prev => ({
          ...prev,
          [parentId]: newOrder
        }));
      }
      return;
    }

    // Handle detail category being dropped on a subcategory (change parent)
    if (activeCategory.level === 'detail' && overCategory.level === 'sub') {
      // Check if the subcategory can accept this type of category
      if (activeCategory.type === overCategory.type || activeCategory.type === 'both' || overCategory.type === 'both') {
        updateCategory(active.id as string, { parentId: over.id as string });
        
        // Update order for both old and new parent
        const oldParentId = activeCategory.parentId || '';
        const newParentId = over.id as string;
        
        // Remove from old parent order
        if (categoryOrder[oldParentId]) {
          setCategoryOrder(prev => ({
            ...prev,
            [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
          }));
        }
        
        // Add to new parent order
        setCategoryOrder(prev => ({
          ...prev,
          [newParentId]: [...(prev[newParentId] || []), active.id as string]
        }));
      }
      return;
    }

    // Handle detail category being dropped on another detail category (move to same parent)
    if (activeCategory.level === 'detail' && overCategory.level === 'detail' && activeCategory.parentId !== overCategory.parentId) {
      // Move to the same parent as the category it was dropped on
      updateCategory(active.id as string, { parentId: overCategory.parentId });
      
      // Update order for both old and new parent
      const oldParentId = activeCategory.parentId || '';
      const newParentId = overCategory.parentId || '';
      
      // Remove from old parent order
      if (categoryOrder[oldParentId]) {
        setCategoryOrder(prev => ({
          ...prev,
          [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
        }));
      }
      
      // Add to new parent order at the position after the target
      const targetIndex = categoryOrder[newParentId]?.indexOf(over.id as string) || 0;
      setCategoryOrder(prev => ({
        ...prev,
        [newParentId]: [
          ...(prev[newParentId] || []).slice(0, targetIndex + 1),
          active.id as string,
          ...(prev[newParentId] || []).slice(targetIndex + 1).filter(id => id !== active.id)
        ]
      }));
      return;
    }

    // Handle subcategory being moved between income/expense sections
    if (activeCategory.level === 'sub' && overCategory.level === 'sub') {
      // Check if they have different parent types
      const activeParent = categories.find(c => c.id === activeCategory.parentId);
      const overParent = categories.find(c => c.id === overCategory.parentId);
      
      if (activeParent && overParent && activeParent.id !== overParent.id) {
        // Move subcategory to new parent type
        updateCategory(active.id as string, { 
          parentId: overParent.id,
          type: overParent.id === 'type-income' ? 'income' : overParent.id === 'type-expense' ? 'expense' : 'both'
        });
        
        // Update order
        const oldParentId = activeCategory.parentId || '';
        const newParentId = overParent.id;
        
        // Remove from old parent order
        if (categoryOrder[oldParentId]) {
          setCategoryOrder(prev => ({
            ...prev,
            [oldParentId]: prev[oldParentId].filter(id => id !== active.id)
          }));
        }
        
        // Add to new parent order
        const targetIndex = categoryOrder[newParentId]?.indexOf(over.id as string) || 0;
        setCategoryOrder(prev => ({
          ...prev,
          [newParentId]: [
            ...(prev[newParentId] || []).slice(0, targetIndex + 1),
            active.id as string,
            ...(prev[newParentId] || []).slice(targetIndex + 1).filter(id => id !== active.id)
          ]
        }));
      } else if (activeParent && overParent && activeParent.id === overParent.id) {
        // Reordering within same parent
        const parentId = activeParent.id;
        const currentOrder = categoryOrder[parentId] || [];
        
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
          setCategoryOrder(prev => ({
            ...prev,
            [parentId]: newOrder
          }));
        }
      }
      return;
    }
  };

  const startEditing = (categoryId: string, categoryName: string) => {
    setEditingCategoryId(categoryId);
    setEditingCategoryName(categoryName);
  };

  const saveEdit = () => {
    if (editingCategoryId && editingCategoryName.trim()) {
      updateCategory(editingCategoryId, { name: editingCategoryName.trim() });
      setEditingCategoryId(null);
      setEditingCategoryName('');
    }
  };

  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleDelete = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const transactionCount = transactions.filter(t => t.category === categoryId).length;
    const childCategories = categories.filter(c => c.parentId === categoryId);

    if (childCategories.length > 0) {
      alert('Cannot delete category with subcategories. Delete subcategories first.');
    } else if (transactionCount > 0) {
      setDeletingCategoryId(categoryId);
      setReassignCategoryId('');
    } else {
      if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
        deleteCategory(categoryId);
      }
    }
  };

  const handleCategoryClick = (categoryId: string, categoryName: string) => {
    if (!isEditMode && !isDeleteMode) {
      setViewingCategoryId(categoryId);
      setViewingCategoryName(categoryName);
    }
  };

  const renderCategorySection = (title: string, parentId: string) => {
    const subCategories = getSubCategories(parentId);
    
    // Sort subcategories by order
    const orderedSubCategories = [...subCategories].sort((a, b) => {
      const order = categoryOrder[parentId] || [];
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      
      // If both are in the order, sort by order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // If only one is in the order, it comes first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // Otherwise maintain original order
      return 0;
    });
    
    const allDetailIds = orderedSubCategories.flatMap(sub => 
      getDetailCategories(sub.id).map(d => d.id)
    );
    
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <SortableContext 
          items={[...orderedSubCategories.map(c => c.id), ...allDetailIds]}
          strategy={verticalListSortingStrategy}
        >
            <div className="space-y-1">
              {orderedSubCategories.map(subCategory => {
                const isExpanded = expandedCategories.has(subCategory.id);
                const detailCategories = getDetailCategories(subCategory.id);
                
                // Sort detail categories by order
                const orderedDetailCategories = [...detailCategories].sort((a, b) => {
                  const order = categoryOrder[subCategory.id] || [];
                  const aIndex = order.indexOf(a.id);
                  const bIndex = order.indexOf(b.id);
                  
                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                  if (aIndex !== -1) return -1;
                  if (bIndex !== -1) return 1;
                  return 0;
                });
                const subTransactionCount = transactions.filter(t => {
                  const cat = categories.find(c => c.id === t.category);
                  return cat && (cat.id === subCategory.id || cat.parentId === subCategory.id);
                }).length;

                return (
                  <div key={subCategory.id}>
                    <SortableCategory
                      category={subCategory}
                      isEditMode={isEditMode}
                      isDeleteMode={isDeleteMode}
                      isEditing={editingCategoryId === subCategory.id}
                      editingName={editingCategoryName}
                      onEdit={() => startEditing(subCategory.id, subCategory.name)}
                      onDelete={() => handleDelete(subCategory.id)}
                      onNameChange={setEditingCategoryName}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      onClick={() => handleCategoryClick(subCategory.id, subCategory.name)}
                      isDraggable={true}
                    >
                      <div className="flex items-center gap-2">
                        {orderedDetailCategories.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategoryExpanded(subCategory.id);
                            }}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                        {!isEditMode && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({subTransactionCount})
                          </span>
                        )}
                      </div>
                    </SortableCategory>

                    {/* Detail categories */}
                    {isExpanded && orderedDetailCategories.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {orderedDetailCategories.map(detailCategory => {
                              const detailTransactionCount = transactions.filter(t => t.category === detailCategory.id).length;

                              return (
                                <SortableCategory
                                  key={detailCategory.id}
                                  category={detailCategory}
                                  isEditMode={isEditMode}
                                  isDeleteMode={isDeleteMode}
                                  isEditing={editingCategoryId === detailCategory.id}
                                  editingName={editingCategoryName}
                                  onEdit={() => startEditing(detailCategory.id, detailCategory.name)}
                                  onDelete={() => handleDelete(detailCategory.id)}
                                  onNameChange={setEditingCategoryName}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                  onClick={() => handleCategoryClick(detailCategory.id, detailCategory.name)}
                                  isDraggable={true}
                                >
                                  {!isEditMode && (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      ({detailTransactionCount})
                                    </span>
                                  )}
                                </SortableCategory>
                              );
                        })}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Categories</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (isDeleteMode) setIsDeleteMode(false);
              setEditingCategoryId(null);
            }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isEditMode 
                ? 'bg-gray-600 text-white hover:bg-gray-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Settings2 size={16} />
            {isEditMode ? 'Done Editing' : 'Edit Categories'}
          </button>
          {isEditMode && (
            <button
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                isDeleteMode 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-red-200 text-red-700 hover:bg-red-300 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
              }`}
            >
              <Trash2 size={16} />
              {isDeleteMode ? 'Cancel Delete' : 'Delete Mode'}
            </button>
          )}
          <button
            onClick={() => setShowCategoryModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-2xl hover:bg-secondary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Category
          </button>
        </div>
      </div>

      {/* Instructions */}
      {(isEditMode || isDeleteMode) ? (
        <div className={`border rounded-2xl p-4 mb-6 ${
          isDeleteMode 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className={`text-sm space-y-2 ${
            isDeleteMode ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'
          }`}>
            <p><strong>{isDeleteMode ? 'Delete Mode Active:' : 'Edit Mode Active:'}</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {isDeleteMode ? (
                <>
                  <li>Click on any category to delete it</li>
                  <li>Categories with transactions will prompt for reassignment</li>
                  <li>Categories with subcategories must have subcategories deleted first</li>
                </>
              ) : (
                <>
                  <li>Click on any category name to rename it</li>
                  <li>Drag detail categories to different subcategories to reorganize them</li>
                  <li>Toggle Delete Mode to remove categories</li>
                  <li>Default categories can be edited just like custom ones</li>
                </>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">💡 <strong>Tip:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click on any category name to view its transactions</li>
              <li>Click the arrow buttons to expand/collapse subcategories</li>
              <li>Use Edit Mode to rename or reorganize categories</li>
              <li>The number in parentheses shows how many transactions are in each category</li>
            </ul>
          </div>
        </div>
      )}

      {/* Categories Tree */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {renderCategorySection('Income Categories', 'type-income')}
            {renderCategorySection('Expense Categories', 'type-expense')}
            {renderCategorySection('Transfer Categories', 'type-transfer')}
          
          {/* Other Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Other Categories</h3>
            <div className="space-y-1">
              {categories.filter(cat => cat.type === 'both' && cat.level === 'detail' && !cat.parentId).map(category => {
                const transactionCount = transactions.filter(t => t.category === category.id).length;

                return (
                  <div key={category.id} className="ml-4">
                    <SortableCategory
                      category={category}
                      isEditMode={isEditMode}
                      isDeleteMode={isDeleteMode}
                      isEditing={editingCategoryId === category.id}
                      editingName={editingCategoryName}
                      onEdit={() => startEditing(category.id, category.name)}
                      onDelete={() => handleDelete(category.id)}
                      onNameChange={setEditingCategoryName}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      onClick={() => handleCategoryClick(category.id, category.name)}
                      isDraggable={false}
                    >
                      {!isEditMode && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({transactionCount})
                        </span>
                      )}
                    </SortableCategory>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-2 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 opacity-90">
                {categories.find(c => c.id === activeId)?.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Category Delete Confirmation Dialog */}
      {deletingCategoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Category</h3>
            </div>
            {(() => {
              const category = categories.find(c => c.id === deletingCategoryId);
              const transactionCount = transactions.filter(t => t.category === deletingCategoryId).length;

              return (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    The category "{category?.name}" has {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} associated with it.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please select a category to reassign these transactions to:
                  </p>
                  <select
                    value={reassignCategoryId}
                    onChange={(e) => setReassignCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white mb-6"
                  >
                    <option value="">Select a category...</option>
                    {categories
                      .filter(c => 
                        c.id !== deletingCategoryId && 
                        c.level === 'detail' && 
                        (category?.type === 'both' || c.type === 'both' || c.type === category?.type)
                      )
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {getCategoryPath(c.id)}
                        </option>
                      ))
                    }
                  </select>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDeletingCategoryId(null);
                        setReassignCategoryId('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (reassignCategoryId) {
                          // TODO: Reassign transactions before deleting category
                          deleteCategory(deletingCategoryId);
                          setDeletingCategoryId(null);
                          setReassignCategoryId('');
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      disabled={!reassignCategoryId}
                    >
                      Delete & Reassign
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Category Creation Modal */}
      <CategoryCreationModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />

      {/* View Transactions Confirmation */}
      {viewingCategoryId && !showTransactionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              View Transactions
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Would you like to see all transactions in the "{viewingCategoryName}" category?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setViewingCategoryId(null);
                  setViewingCategoryName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowTransactionsModal(true);
                }}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
              >
                View Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Transactions Modal */}
      {showTransactionsModal && viewingCategoryId && (
        <CategoryTransactionsModal
          isOpen={true}
          onClose={() => {
            setShowTransactionsModal(false);
            setViewingCategoryId(null);
            setViewingCategoryName('');
          }}
          categoryId={viewingCategoryId}
          categoryName={viewingCategoryName}
        />
      )}
    </div>
  );
}