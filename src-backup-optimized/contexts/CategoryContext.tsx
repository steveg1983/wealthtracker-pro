import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CategoryContextType {
  // Add properties here
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within CategoryProvider');
  }
  return context;
};

// Alias for compatibility
export const useCategories = useCategory;

interface CategoryProviderProps {
  children: ReactNode;
  initialAccounts?: any[];
  initialTransactions?: any[];
  initialRecurringTransactions?: any[];
}

export const CategoryProvider: React.FC<CategoryProviderProps> = ({ children }) => {
  const value: CategoryContextType = {
    // Add implementation here
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};