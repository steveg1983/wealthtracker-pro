import { useCallback, useMemo } from 'react';
import type { Category } from './types';

/**
 * Custom hook for category management operations
 * Handles CRUD operations and category hierarchy
 */
export function useCategoryManagement(
  categories: Category[],
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
) {
  const addCategory = useCallback((category: Omit<Category, 'id'>) => {
    const newCategory = {
      ...category,
      id: crypto.randomUUID()
    };
    setCategories(prev => [...prev, newCategory]);
  }, [setCategories]);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id ? { ...cat, ...updates } : cat
    ));
  }, [setCategories]);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  }, [setCategories]);

  const getSubCategories = useCallback((parentId: string): Category[] => {
    return categories.filter(cat => cat.parentId === parentId && cat.level === 'sub');
  }, [categories]);

  const getDetailCategories = useCallback((parentId: string): Category[] => {
    return categories.filter(cat => cat.parentId === parentId && cat.level === 'detail');
  }, [categories]);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find(cat => cat.id === id);
  }, [categories]);

  const getCategoryPath = useCallback((categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '';
    
    const pathParts: string[] = [category.name];
    let currentCategory = category;
    
    while (currentCategory.parentId) {
      const parent = categories.find(c => c.id === currentCategory.parentId);
      if (!parent) break;
      pathParts.unshift(parent.name);
      currentCategory = parent;
    }
    
    return pathParts.join(' > ');
  }, [categories]);

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    getSubCategories,
    getDetailCategories,
    getCategoryById,
    getCategoryPath
  };
}