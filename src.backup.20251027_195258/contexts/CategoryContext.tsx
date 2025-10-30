/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultCategories } from '../data/defaultCategories';
import { logger } from '../services/loggingService';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

interface CategoryContextType {
  categories: Category[];
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryPath: (categoryId: string) => string;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

interface CategoryProviderProps {
  children: ReactNode;
  initialCategories?: Category[];
}

export function CategoryProvider({ children, initialCategories }: CategoryProviderProps) {
  const [categories, setCategories] = useState<Category[]>(() => {
    const savedCategories = localStorage.getItem('money_management_categories');
    if (savedCategories) {
      try {
        return JSON.parse(savedCategories);
      } catch (error) {
        logger.error('Error parsing saved categories:', error);
        return initialCategories || getDefaultCategories();
      }
    }
    return initialCategories || getDefaultCategories();
  });

  // Save categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('money_management_categories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = (categoryData: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: uuidv4()
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(category => 
      category.id === id 
        ? { ...category, ...updates }
        : category
    ));
  };

  const deleteCategory = (id: string) => {
    const category = categories.find(c => c.id === id);
    if (category?.isSystem) {
      logger.warn('Cannot delete system category');
      return;
    }
    setCategories(prev => prev.filter(category => category.id !== id));
  };

  const getCategoryById = (id: string) => {
    return categories.find(category => category.id === id);
  };

  // Memoized function to get category path
  const getCategoryPath = useMemo(() => {
    const pathCache = new Map<string, string>();
    
    return (categoryId: string): string => {
      if (!categoryId) return 'Uncategorized';
      
      // Check cache first
      if (pathCache.has(categoryId)) {
        return pathCache.get(categoryId)!;
      }
      
      const category = categories.find(c => c.id === categoryId);
      if (!category) return 'Uncategorized';
      
      // Build the full path for the category
      let path = category.name;
      let currentCategory = category;
      
      while (currentCategory.parentId) {
        const parent = categories.find(c => c.id === currentCategory.parentId);
        if (parent) {
          path = `${parent.name} > ${path}`;
          currentCategory = parent;
        } else {
          break;
        }
      }
      
      // Cache the result
      pathCache.set(categoryId, path);
      return path;
    };
  }, [categories]);

  const getSubCategories = (parentId: string) => {
    return categories.filter(c => c.parentId === parentId && c.level === 'sub');
  };

  const getDetailCategories = (parentId: string) => {
    return categories.filter(c => c.parentId === parentId && c.level === 'detail');
  };

  return (
    <CategoryContext.Provider value={{
      categories,
      addCategory,
      updateCategory,
      deleteCategory,
      getCategoryById,
      getCategoryPath,
      getSubCategories,
      getDetailCategories
    }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategories must be used within CategoryProvider');
  }
  return context;
}