import { createContext } from 'react';
import type { Category } from '../types';

export type { Category };

export interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryPath: (categoryId: string) => string;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
}

export const CategoryContext = createContext<CategoryContextType | undefined>(undefined);
