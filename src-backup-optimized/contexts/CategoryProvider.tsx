import React, { useState, useCallback, useEffect } from 'react';
import { CategoryContext } from './category-context-base';
import type { CategoryContextType, Category } from './category-context-base';

const DEFAULT_CATEGORIES: Category[] = [
  // Income categories
  { id: 'income-salary', name: 'Salary', type: 'income', level: 'type', color: '#10B981', icon: '💼' },
  { id: 'income-freelance', name: 'Freelance', type: 'income', level: 'type', color: '#10B981', icon: '💻' },
  { id: 'income-investment', name: 'Investment Returns', type: 'income', level: 'type', color: '#10B981', icon: '📈' },
  { id: 'income-business', name: 'Business Income', type: 'income', level: 'type', color: '#10B981', icon: '🏢' },
  { id: 'income-other', name: 'Other Income', type: 'income', level: 'type', color: '#10B981', icon: '💰' },

  // Expense categories
  { id: 'expense-housing', name: 'Housing', type: 'expense', level: 'type', color: '#EF4444', icon: '🏠' },
  { id: 'expense-food', name: 'Food & Dining', type: 'expense', level: 'type', color: '#F59E0B', icon: '🍽️' },
  { id: 'expense-transportation', name: 'Transportation', type: 'expense', level: 'type', color: '#8B5CF6', icon: '🚗' },
  { id: 'expense-utilities', name: 'Utilities', type: 'expense', level: 'type', color: '#06B6D4', icon: '⚡' },
  { id: 'expense-healthcare', name: 'Healthcare', type: 'expense', level: 'type', color: '#EC4899', icon: '🏥' },
  { id: 'expense-entertainment', name: 'Entertainment', type: 'expense', level: 'type', color: '#84CC16', icon: '🎬' },
  { id: 'expense-shopping', name: 'Shopping', type: 'expense', level: 'type', color: '#F97316', icon: '🛍️' },
  { id: 'expense-education', name: 'Education', type: 'expense', level: 'type', color: '#3B82F6', icon: '📚' },
  { id: 'expense-insurance', name: 'Insurance', type: 'expense', level: 'type', color: '#6366F1', icon: '🛡️' },
  { id: 'expense-debt', name: 'Debt Payments', type: 'expense', level: 'type', color: '#DC2626', icon: '💳' },
  { id: 'expense-savings', name: 'Savings & Investments', type: 'expense', level: 'type', color: '#059669', icon: '🏦' },
  { id: 'expense-personal', name: 'Personal Care', type: 'expense', level: 'type', color: '#DB2777', icon: '💅' },
  { id: 'expense-travel', name: 'Travel', type: 'expense', level: 'type', color: '#0EA5E9', icon: '✈️' },
  { id: 'expense-gifts', name: 'Gifts & Donations', type: 'expense', level: 'type', color: '#F472B6', icon: '🎁' },
  { id: 'expense-other', name: 'Other Expenses', type: 'expense', level: 'type', color: '#6B7280', icon: '📦' },
];

interface CategoryProviderProps {
  children: React.ReactNode;
}

export function CategoryProvider({ children }: CategoryProviderProps): React.JSX.Element {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);

  // Load categories from localStorage on mount
  useEffect(() => {
    const storedCategories = localStorage.getItem('wealthtracker-categories');
    if (storedCategories) {
      try {
        const parsed = JSON.parse(storedCategories);
        setCategories(parsed);
      } catch (error) {
        console.error('Failed to parse stored categories:', error);
        // Fall back to default categories
        setCategories(DEFAULT_CATEGORIES);
      }
    }
  }, []);

  // Save categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('wealthtracker-categories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = useCallback(async (category: Omit<Category, 'id'>): Promise<Category> => {
    setLoading(true);
    try {
      const newCategory: Category = {
        ...category,
        id: `${category.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>): Promise<void> => {
    setLoading(true);
    try {
      setCategories(prev =>
        prev.map(category =>
          category.id === id ? { ...category, ...updates } : category
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      setCategories(prev => prev.filter(category => category.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find(category => category.id === id);
  }, [categories]);

  const getCategoriesByType = useCallback((type: 'income' | 'expense'): Category[] => {
    return categories.filter(category => category.type === type);
  }, [categories]);

  const getSubCategories = useCallback((parentId: string): Category[] => {
    return categories.filter(
      category => category.parentId === parentId && category.level === 'sub'
    );
  }, [categories]);

  const getDetailCategories = useCallback((parentId: string): Category[] => {
    return categories.filter(
      category => category.parentId === parentId && category.level === 'detail'
    );
  }, [categories]);

  const getCategoryPath = useCallback((categoryId: string): string => {
    const category = categories.find(item => item.id === categoryId);
    if (!category) {
      return '';
    }

    if (!category.parentId) {
      return category.name;
    }

    const parent = categories.find(item => item.id === category.parentId);
    return parent ? `${parent.name} › ${category.name}` : category.name;
  }, [categories]);

  const resetToDefaults = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, []);

  const importCategories = useCallback(async (importedCategories: Category[]): Promise<void> => {
    setLoading(true);
    try {
      // Merge imported categories with existing ones, avoiding duplicates by name
      const existingNames = new Set(categories.map(c => c.name.toLowerCase()));
      const newCategories = importedCategories.filter(
        category => !existingNames.has(category.name.toLowerCase())
      );

      if (newCategories.length > 0) {
        setCategories(prev => [...prev, ...newCategories]);
      }
    } finally {
      setLoading(false);
    }
  }, [categories]);

  const contextValue: CategoryContextType = {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoriesByType,
    getSubCategories,
    getDetailCategories,
    getCategoryPath,
    resetToDefaults,
    importCategories
  };

  return (
    <CategoryContext.Provider value={contextValue}>
      {children}
    </CategoryContext.Provider>
  );
}
