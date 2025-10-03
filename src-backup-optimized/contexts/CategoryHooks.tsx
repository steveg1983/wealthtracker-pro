import { useContext } from 'react';
import { CategoryContext } from './category-context-base';
import type { CategoryContextType } from './category-context-base';

export function useCategories(): CategoryContextType {
  const context = useContext(CategoryContext);

  if (!context) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }

  return context;
}
