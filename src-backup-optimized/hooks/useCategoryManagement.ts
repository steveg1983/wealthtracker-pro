import { useState, useCallback, useEffect, useMemo } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

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

interface UseCategoryManagementProps {
  categories: Category[];
  transactions: any[];
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
}

export function useCategoryManagement({
  categories,
  transactions,
  updateCategory,
  deleteCategory
}: UseCategoryManagementProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<{ [parentId: string]: string[] }>({});

  // Initialize category order
  useEffect(() => {
    const order: { [parentId: string]: string[] } = {};
    
    // Group categories by parent
    const parentIds = [...new Set(categories.map(c => c.parentId).filter(Boolean))];
    parentIds.push(''); // For top-level categories
    
    parentIds.forEach(parentId => {
      const children = categories
        .filter(c => (c.parentId || '') === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(c => c.id);
      if (children.length > 0 && parentId !== undefined) {
        order[parentId] = children;
      }
    });
    
    setCategoryOrder(order);
  }, [categories]);

  // Category path helper
  const getCategoryPath = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    
    if (category.parentId) {
      const parent = categories.find(c => c.id === category.parentId);
      return parent ? `${parent.name} > ${category.name}` : category.name;
    }
    return category.name;
  }, [categories]);

  // Toggle category expansion
  const toggleCategoryExpanded = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  }, []);

  // Edit handlers
  const handleStartEdit = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setEditingCategoryId(categoryId);
      setEditingCategoryName(category.name);
    }
  }, [categories]);

  const handleSaveEdit = useCallback(() => {
    if (editingCategoryId && editingCategoryName.trim()) {
      updateCategory(editingCategoryId, { name: editingCategoryName.trim() });
      setEditingCategoryId(null);
      setEditingCategoryName('');
    }
  }, [editingCategoryId, editingCategoryName, updateCategory]);

  const handleCancelEdit = useCallback(() => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  }, []);

  // Delete handlers
  const handleStartDelete = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    const hasTransactions = transactions.some(t => t.category === category?.name);
    const hasChildren = categories.some(c => c.parentId === categoryId);
    
    if (hasTransactions || hasChildren) {
      setDeletingCategoryId(categoryId);
      setReassignCategoryId('');
    } else {
      deleteCategory(categoryId);
    }
  }, [categories, transactions, deleteCategory]);

  const handleConfirmDelete = useCallback(() => {
    if (deletingCategoryId) {
      deleteCategory(deletingCategoryId);
      setDeletingCategoryId(null);
      setReassignCategoryId('');
    }
  }, [deletingCategoryId, deleteCategory]);

  const handleCancelDelete = useCallback(() => {
    setDeletingCategoryId(null);
    setReassignCategoryId('');
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeCategory = categories.find(c => c.id === active.id);
    const overCategory = categories.find(c => c.id === over.id);

    if (!activeCategory || !overCategory) return;

    // Same parent - reorder
    if (activeCategory.parentId === overCategory.parentId) {
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

        // Update order in database
        newOrder.forEach((id, index) => {
          updateCategory(id, { order: index });
        });
      }
    }
  }, [categories, categoryOrder, updateCategory]);

  // Computed values
  const organizedCategories = useMemo(() => {
    const organized: { [key: string]: Category[] } = {};
    
    // Get top-level categories
    const topLevel = categories
      .filter(c => !c.parentId && c.level === 'type')
      .sort((a, b) => {
        const orderA = categoryOrder['']?.indexOf(a.id) ?? 999;
        const orderB = categoryOrder['']?.indexOf(b.id) ?? 999;
        return orderA - orderB;
      });
    
    topLevel.forEach(parent => {
      const children = categories
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => {
          const orderA = categoryOrder[parent.id]?.indexOf(a.id) ?? 999;
          const orderB = categoryOrder[parent.id]?.indexOf(b.id) ?? 999;
          return orderA - orderB;
        });
      
      organized[parent.id] = children;
    });
    
    return { topLevel, organized };
  }, [categories, categoryOrder]);

  return {
    // State
    isEditMode,
    isDeleteMode,
    editingCategoryId,
    editingCategoryName,
    deletingCategoryId,
    reassignCategoryId,
    expandedCategories,
    activeId,
    categoryOrder,
    
    // Setters
    setIsEditMode,
    setIsDeleteMode,
    setEditingCategoryName,
    setReassignCategoryId,
    
    // Handlers
    toggleCategoryExpanded,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleStartDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleDragStart,
    handleDragEnd,
    
    // Computed
    organizedCategories,
    getCategoryPath
  };
}