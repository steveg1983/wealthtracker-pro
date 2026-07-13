import { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useToast } from '../../contexts/ToastContext';
import { MS_MONEY_CATEGORY_SET } from '../../data/msMoneyCategories';
import { expandSplitTransactions, splitsByTransaction } from '../../utils/transactionSplits';
import CategoryCreationModal from '../../components/CategoryCreationModal';
import CategorySelector from '../../components/CategorySelector';
import CategoryTransactionsModal from '../../components/CategoryTransactionsModal';
import { AlertCircleIcon, Settings2Icon, GripVerticalIcon } from '../../components/icons';
import { PlusIcon, XIcon, CheckIcon, ChevronRightIcon, ChevronDownIcon, DeleteIcon } from '../../components/icons';
import { IconButton } from '../../components/icons/IconButton';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PageWrapper from '../../components/PageWrapper';

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
              <GripVerticalIcon size={16} />
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
              className="px-2 py-1 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white flex-1"
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
              <IconButton
                onClick={onSave}
                icon={<CheckIcon size={16} />}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
                aria-label="Save category name"
              />
              <IconButton
                onClick={onCancel}
                icon={<XIcon size={16} />}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
                aria-label="Cancel editing"
              />
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
    transactionSplits,
    setTransactionSplits,
    updateCategory,
    deleteCategory,
    updateTransaction,
    getSubCategories,
    getDetailCategories,
    importCategoryTree
  } = useApp();
  const { showSuccess, showError } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  // Split parents expand into their per-line virtual rows so a split line
  // counts under ITS category, not nowhere (the parent's category is blank).
  const expandedTransactions = useMemo(
    () => expandSplitTransactions(transactions, transactionSplits),
    [transactions, transactionSplits]
  );

  // Transaction count per category id (split lines included), computed once
  // per data change. Every row shows its counter (view AND edit/delete
  // modes) — the old per-row transactions.filter() was O(rows × transactions)
  // at 16k+ transactions.
  const categoryTransactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of expandedTransactions) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [expandedTransactions]);

  // The type-level ids are user-specific UUIDs after cloud migration — the old
  // hardcoded 'type-income'/'type-expense'/'type-transfer' anchors matched
  // nothing, which rendered every section empty. Resolve them dynamically.
  const typeAnchorIds = useMemo(() => ({
    income: categories.find(c => c.level === 'type' && c.type === 'income')?.id ?? 'type-income',
    expense: categories.find(c => c.level === 'type' && c.type === 'expense')?.id ?? 'type-expense',
    transfer: categories.find(c => c.level === 'type' && c.type === 'both')?.id ?? 'type-transfer',
  }), [categories]);

  const handleImportMoneySet = async () => {
    if (isImporting) return;
    if (!window.confirm(
      'Switch to the Microsoft Money category set? The Money tree is imported and unused default categories are removed. Categories that transactions use, transfer categories, and system categories are always kept.'
    )) {
      return;
    }
    setIsImporting(true);
    try {
      const result = await importCategoryTree(MS_MONEY_CATEGORY_SET, { pruneOthers: true });
      const parts: string[] = [];
      if (result.created > 0) parts.push(`added ${result.created}`);
      if (result.pruned > 0) parts.push(`removed ${result.pruned} unused defaults`);
      if (result.keptForTransactions > 0) parts.push(`kept ${result.keptForTransactions} in use by transactions`);
      showSuccess(
        parts.length > 0
          ? `Categories updated: ${parts.join(', ')}.`
          : 'Your categories already match the Microsoft Money set.',
        'Money set applied'
      );
    } catch (error) {
      showError(error);
    } finally {
      setIsImporting(false);
    }
  };
  

  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
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

    // Transfer categories are system-managed structure — dragging one under an
    // income/expense sub (or dropping a normal category onto one) would
    // corrupt the tree in a way the rename/delete guards can't repair.
    if (activeCategory.isTransferCategory || overCategory.isTransferCategory) {
      if (activeCategory.parentId !== overCategory.parentId || activeCategory.level !== overCategory.level) {
        showError(new Error(
          'Transfer categories are managed automatically from their account and cannot be moved.'
        ));
        return;
      }
    }

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
        // Move subcategory to new parent type. Compare against the RESOLVED
        // anchor ids — cloud-migrated anchors are UUIDs, so matching the old
        // literal 'type-income'/'type-expense' always fell through to 'both'
        // and silently corrupted the category's type on cross-section drags.
        updateCategory(active.id as string, {
          parentId: overParent.id,
          type: overParent.id === typeAnchorIds.income
            ? 'income'
            : overParent.id === typeAnchorIds.expense
              ? 'expense'
              : 'both'
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
    // Transfer category names track their account ("To/From <account name>");
    // rename the account instead and the category follows automatically.
    const category = categories.find(c => c.id === categoryId);
    if (category?.isTransferCategory) {
      showError(new Error(
        'Transfer category names follow their account. Rename the account and this updates automatically.'
      ));
      return;
    }
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

    // Account transfer categories are system-managed bookkeeping: created
    // with the account, renamed with it, hidden when it closes. Deleting one
    // would orphan that account's transfer history (the DB blocks it too).
    if (category.isTransferCategory) {
      showError(new Error(
        'Transfer categories are managed automatically from their account. Close the account to hide it instead.'
      ));
      return;
    }

    // Count on the EXPANDED view so a category used only inside split lines
    // still routes through reassignment — deleting it outright would orphan
    // those lines' categorisation (the DB refuses that delete anyway).
    const transactionCount = expandedTransactions.filter(t => t.category === categoryId).length;
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
    // Inactive categories (a closed account's transfer category) stay out of
    // sight — reopening the account brings them back automatically.
    const subCategories = getSubCategories(parentId).filter(c => c.isActive !== false);
    
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
      getDetailCategories(sub.id).filter(d => d.isActive !== false).map(d => d.id)
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
                const detailCategories = getDetailCategories(subCategory.id).filter(d => d.isActive !== false);
                
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
                // Direct hits on the sub-category plus everything filed under
                // ANY of its detail children (including inactive ones, so the
                // rolled-up number always accounts for every transaction).
                const subTransactionCount =
                  (categoryTransactionCounts.get(subCategory.id) ?? 0) +
                  categories
                    .filter(c => c.parentId === subCategory.id)
                    .reduce((sum, c) => sum + (categoryTransactionCounts.get(c.id) ?? 0), 0);

                return (
                  <div key={subCategory.id}>
                    <SortableCategory
                      category={subCategory as Category}
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
                          <IconButton
                            onClick={(e) => {
                              e?.stopPropagation();
                              toggleCategoryExpanded(subCategory.id);
                            }}
                            icon={isExpanded ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700"
                            aria-label={isExpanded ? `Collapse ${subCategory.name}` : `Expand ${subCategory.name}`}
                          />
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({subTransactionCount})
                        </span>
                      </div>
                    </SortableCategory>

                    {/* Detail categories */}
                    {isExpanded && orderedDetailCategories.length > 0 && (
                      <div className="ml-8 space-y-1">
                        {orderedDetailCategories.map(detailCategory => {
                              const detailTransactionCount = categoryTransactionCounts.get(detailCategory.id) ?? 0;

                              return (
                                <SortableCategory
                                  key={detailCategory.id}
                                  category={detailCategory as Category}
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
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({detailTransactionCount})
                                  </span>
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
    <PageWrapper 
      title="Categories"
      rightContent={
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (isDeleteMode) setIsDeleteMode(false);
              setEditingCategoryId(null);
            }}
            className={`w-8 h-8 flex items-center justify-center transition-colors ${
              isEditMode 
                ? 'text-white bg-gray-600 hover:bg-gray-700' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={isEditMode ? 'Done Editing' : 'Edit Categories'}
          >
            <Settings2Icon size={16} />
          </button>
          {isEditMode && (
            <IconButton
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              icon={<DeleteIcon size={16} />}
              variant={isDeleteMode ? 'danger' : 'ghost'}
              size="sm"
              className={isDeleteMode ? '' : 'text-gray-500 hover:text-gray-700'}
              title={isDeleteMode ? 'Cancel Delete' : 'Delete Categories'}
            />
          )}
          <IconButton
            onClick={() => setShowCategoryModal(true)}
            icon={<PlusIcon size={16} />}
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            title="Add Category"
          />
        </div>
      }
    >

      {/* Desktop: the page chrome (title/toolbar above, instructions + import
          below) stays in view and the category tree scrolls internally, so
          the edit/delete/add buttons are always reachable. Mobile keeps the
          normal page scroll. */}
      <div className="lg:flex lg:flex-col lg:h-[calc(100vh-13rem)]">

      {/* Instructions */}
      {(isEditMode || isDeleteMode) ? (
        <div className={`lg:shrink-0 border rounded-2xl p-4 mb-6 ${
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
        <div className="lg:shrink-0 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-6">
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

      {/* Starter set import */}
      {!isEditMode && !isDeleteMode && (
        <div className="lg:shrink-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Microsoft Money category set
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Switch to the classic Money (UK) category tree. Unused default categories
              are removed; anything your transactions use is kept.
            </p>
          </div>
          <button
            onClick={() => void handleImportMoneySet()}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap self-start sm:self-auto"
          >
            {isImporting ? 'Importing…' : 'Import Money set'}
          </button>
        </div>
      )}

      {/* Categories Tree — the scrolling region on desktop */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {renderCategorySection('Income Categories', typeAnchorIds.income)}
            {renderCategorySection('Expense Categories', typeAnchorIds.expense)}
            {renderCategorySection('Transfer Categories', typeAnchorIds.transfer)}
          
          {/* Other Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Other Categories</h3>
            <div className="space-y-1">
              {categories.filter(cat => cat.type === 'both' && cat.level === 'detail' && !cat.parentId && cat.isActive !== false).map(category => {
                const transactionCount = categoryTransactionCounts.get(category.id) ?? 0;

                return (
                  <div key={category.id} className="ml-4">
                    <SortableCategory
                      category={category as Category}
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
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({transactionCount})
                      </span>
                    </SortableCategory>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 opacity-90">
                {categories.find(c => c.id === activeId)?.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      </div>{/* end desktop flex column */}

      {/* Category Delete Confirmation Dialog */}
      {deletingCategoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircleIcon className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Category</h3>
            </div>
            {(() => {
              const category = categories.find(c => c.id === deletingCategoryId);
              const directRows = transactions.filter(t => t.category === deletingCategoryId && !t.isSplit);
              const affectedSplitLines = transactionSplits.filter(s => s.category === deletingCategoryId);
              const transactionCount = directRows.length + affectedSplitLines.length;

              return (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    The category "{category?.name}" has {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} associated with it
                    {affectedSplitLines.length > 0 && (
                      <> (including {affectedSplitLines.length} split line{affectedSplitLines.length !== 1 ? 's' : ''})</>
                    )}.
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Please select a category to reassign these transactions to:
                  </p>
                  {/* Same searchable grouped picker as the transaction editor —
                      it filters out inactive categories (a closed account's
                      transfer categories, stale renames) automatically. */}
                  <div className="mb-6">
                    <CategorySelector
                      selectedCategory={reassignCategoryId}
                      onCategoryChange={setReassignCategoryId}
                      transactionType={category?.type === 'income' ? 'income' : 'expense'}
                      includeAllTypes={category?.type === 'both'}
                      excludeIds={[deletingCategoryId]}
                      placeholder="Search or select category…"
                      allowCreate={false}
                      showHelperText={false}
                      usePortal
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setDeletingCategoryId(null);
                        setReassignCategoryId('');
                      }}
                      disabled={isReassigning}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!reassignCategoryId || reassignCategoryId === deletingCategoryId || isReassigning) {
                          return;
                        }
                        setIsReassigning(true);
                        try {
                          // Ordinary rows move in one pass; failures surface
                          // instead of silently racing the category delete.
                          await Promise.all(directRows.map(transaction =>
                            updateTransaction(transaction.id, { category: reassignCategoryId })
                          ));

                          // Split lines: swap the category inside each affected
                          // parent's split set. Amounts are untouched, so the
                          // sum invariant holds and the RPC accepts.
                          const affectedParents = splitsByTransaction(affectedSplitLines);
                          for (const parentId of affectedParents.keys()) {
                            const allLines = transactionSplits
                              .filter(s => s.transactionId === parentId)
                              .sort((a, b) => a.sortOrder - b.sortOrder);
                            const parent = transactions.find(t => t.id === parentId);
                            await setTransactionSplits(
                              parentId,
                              allLines.map(line => ({
                                category: line.category === deletingCategoryId ? reassignCategoryId : line.category,
                                amount: line.amount,
                                ...(line.memo ? { memo: line.memo } : {}),
                              })),
                              parent?.amount ?? null
                            );
                          }

                          await deleteCategory(deletingCategoryId);
                          setDeletingCategoryId(null);
                          setReassignCategoryId('');
                        } catch (error) {
                          showError(error);
                        } finally {
                          setIsReassigning(false);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      disabled={!reassignCategoryId || isReassigning}
                    >
                      {isReassigning ? 'Reassigning…' : 'Delete & Reassign'}
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
                className="flex-1 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
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
    </PageWrapper>
  );
}