/**
 * CategoryContext Tests
 * Comprehensive tests for the category context provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { CategoryProvider, useCategories } from './CategoryContext';
import { getDefaultCategories } from '../data/defaultCategories';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock uuid
const mockUuidV4 = vi.fn(() => 'mock-uuid-123');
vi.mock('uuid', () => ({
  v4: () => mockUuidV4(),
}));

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock getDefaultCategories
vi.mock('../data/defaultCategories', () => ({
  getDefaultCategories: vi.fn(() => [
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
    { id: 'sub-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
    { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
    { id: 'detail-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  ]),
}));

describe('CategoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.setItem.mockImplementation(() => {}); // Reset to no-op
    mockUuidV4.mockReturnValue('mock-uuid-123');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <CategoryProvider>{children}</CategoryProvider>
  );

  const wrapperWithInitial = (initialCategories: any[]) => 
    ({ children }: { children: ReactNode }) => (
      <CategoryProvider initialCategories={initialCategories}>{children}</CategoryProvider>
    );

  describe('initialization', () => {
    it('provides default categories when localStorage is empty', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      expect(result.current.categories).toHaveLength(6);
      expect(result.current.categories[0]).toMatchObject({
        id: 'type-income',
        name: 'Income',
        type: 'income',
        level: 'type',
        isSystem: true,
      });
    });

    it('loads categories from localStorage', () => {
      const savedCategories = [
        { id: 'cat-1', name: 'Custom Category', type: 'expense', level: 'sub' },
        { id: 'cat-2', name: 'Another Category', type: 'income', level: 'detail' },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCategories));

      const { result } = renderHook(() => useCategories(), { wrapper });

      expect(result.current.categories).toEqual(savedCategories);
    });

    it('handles invalid localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useCategories(), { wrapper });

      expect(result.current.categories).toHaveLength(6); // Falls back to default
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error parsing saved categories:',
        expect.any(Error)
      );
    });

    it('uses initialCategories when provided and localStorage is empty', () => {
      const initialCategories = [
        { id: 'init-1', name: 'Initial Category', type: 'expense', level: 'type' },
      ];

      const { result } = renderHook(
        () => useCategories(),
        { wrapper: wrapperWithInitial(initialCategories) }
      );

      expect(result.current.categories).toEqual(initialCategories);
    });

    it('prefers localStorage over initialCategories', () => {
      const savedCategories = [
        { id: 'saved-1', name: 'Saved Category', type: 'income', level: 'sub' },
      ];
      const initialCategories = [
        { id: 'init-1', name: 'Initial Category', type: 'expense', level: 'type' },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCategories));

      const { result } = renderHook(
        () => useCategories(),
        { wrapper: wrapperWithInitial(initialCategories) }
      );

      expect(result.current.categories).toEqual(savedCategories);
    });
  });

  describe('addCategory', () => {
    it('adds a new category with generated id', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const newCategory = {
        name: 'Entertainment',
        type: 'expense' as const,
        level: 'sub' as const,
        parentId: 'type-expense',
      };

      act(() => {
        result.current.addCategory(newCategory);
      });

      const addedCategory = result.current.categories.find(c => c.id === 'mock-uuid-123');
      expect(addedCategory).toMatchObject({
        ...newCategory,
        id: 'mock-uuid-123',
      });
    });

    it('saves to localStorage after adding', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      act(() => {
        result.current.addCategory({
          name: 'New Category',
          type: 'income',
          level: 'sub',
        });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_categories',
        expect.stringContaining('New Category')
      );
    });

    it('handles categories with all optional fields', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const fullCategory = {
        name: 'Full Category',
        type: 'expense' as const,
        level: 'detail' as const,
        parentId: 'sub-food',
        color: '#FF5733',
        icon: '🎮',
      };

      act(() => {
        result.current.addCategory(fullCategory);
      });

      const added = result.current.categories.find(c => c.name === 'Full Category');
      expect(added).toMatchObject(fullCategory);
    });
  });

  describe('updateCategory', () => {
    it('updates an existing category', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const initialLength = result.current.categories.length;

      act(() => {
        result.current.updateCategory('sub-food', {
          name: 'Food & Dining',
          color: '#00FF00',
        });
      });

      expect(result.current.categories).toHaveLength(initialLength);
      
      const updated = result.current.categories.find(c => c.id === 'sub-food');
      expect(updated?.name).toBe('Food & Dining');
      expect(updated?.color).toBe('#00FF00');
      expect(updated?.type).toBe('expense'); // Unchanged fields preserved
    });

    it('does nothing if category not found', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const categoriesBefore = [...result.current.categories];

      act(() => {
        result.current.updateCategory('non-existent', { name: 'New Name' });
      });

      expect(result.current.categories).toEqual(categoriesBefore);
    });

    it('saves to localStorage after updating', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.updateCategory('sub-salary', { name: 'Wages' });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'money_management_categories',
        expect.stringContaining('Wages')
      );
    });

    it('can update system categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      act(() => {
        result.current.updateCategory('type-income', { color: '#0000FF' });
      });

      const updated = result.current.categories.find(c => c.id === 'type-income');
      expect(updated?.color).toBe('#0000FF');
      expect(updated?.isSystem).toBe(true); // System flag preserved
    });
  });

  describe('deleteCategory', () => {
    it('deletes a non-system category', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      act(() => {
        result.current.deleteCategory('sub-salary');
      });

      const deleted = result.current.categories.find(c => c.id === 'sub-salary');
      expect(deleted).toBeUndefined();
    });

    it('prevents deletion of system categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const systemCategoriesBefore = result.current.categories.filter(c => c.isSystem);

      act(() => {
        result.current.deleteCategory('type-income');
      });

      const systemCategoriesAfter = result.current.categories.filter(c => c.isSystem);
      expect(systemCategoriesAfter).toEqual(systemCategoriesBefore);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Cannot delete system category');
    });

    it('saves to localStorage after deletion', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.deleteCategory('sub-food');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = mockLocalStorage.setItem.mock.calls[0][1];
      const savedCategories = JSON.parse(savedData);
      
      // Check that sub-food was deleted
      const deletedCategory = savedCategories.find((c: any) => c.id === 'sub-food');
      expect(deletedCategory).toBeUndefined();
    });

    it('does nothing if category not found', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const categoriesBefore = [...result.current.categories];

      act(() => {
        result.current.deleteCategory('non-existent');
      });

      expect(result.current.categories).toEqual(categoriesBefore);
    });
  });

  describe('getCategoryById', () => {
    it('returns category by id', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const category = result.current.getCategoryById('sub-food');

      expect(category).toMatchObject({
        id: 'sub-food',
        name: 'Food',
        type: 'expense',
        level: 'sub',
        parentId: 'type-expense',
      });
    });

    it('returns undefined for non-existent id', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const category = result.current.getCategoryById('non-existent');

      expect(category).toBeUndefined();
    });
  });

  describe('getCategoryPath', () => {
    it('returns full path for detail category', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const path = result.current.getCategoryPath('detail-groceries');

      expect(path).toBe('Expense > Food > Groceries');
    });

    it('returns path for sub category', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const path = result.current.getCategoryPath('sub-food');

      expect(path).toBe('Expense > Food');
    });

    it('returns path for type category', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const path = result.current.getCategoryPath('type-income');

      expect(path).toBe('Income');
    });

    it('returns Uncategorized for empty id', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const path = result.current.getCategoryPath('');

      expect(path).toBe('Uncategorized');
    });

    it('returns Uncategorized for non-existent id', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const path = result.current.getCategoryPath('non-existent');

      expect(path).toBe('Uncategorized');
    });

    it('handles broken parent chain gracefully', () => {
      const categoriesWithBrokenChain = [
        { id: 'orphan', name: 'Orphan', type: 'expense', level: 'detail', parentId: 'missing-parent' },
      ];

      const { result } = renderHook(
        () => useCategories(),
        { wrapper: wrapperWithInitial(categoriesWithBrokenChain) }
      );

      const path = result.current.getCategoryPath('orphan');

      expect(path).toBe('Orphan');
    });

    it('caches paths for performance', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      // Call multiple times
      const path1 = result.current.getCategoryPath('detail-groceries');
      const path2 = result.current.getCategoryPath('detail-groceries');
      const path3 = result.current.getCategoryPath('detail-groceries');

      expect(path1).toBe('Expense > Food > Groceries');
      expect(path2).toBe(path1);
      expect(path3).toBe(path1);
    });

    it('updates cache when categories change', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const pathBefore = result.current.getCategoryPath('sub-food');
      expect(pathBefore).toBe('Expense > Food');

      act(() => {
        result.current.updateCategory('sub-food', { name: 'Dining' });
      });

      const pathAfter = result.current.getCategoryPath('sub-food');
      expect(pathAfter).toBe('Expense > Dining');
    });
  });

  describe('getSubCategories', () => {
    it('returns sub-level categories for a parent', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const subs = result.current.getSubCategories('type-income');

      expect(subs).toHaveLength(1);
      expect(subs[0]).toMatchObject({
        id: 'sub-salary',
        name: 'Salary',
        level: 'sub',
        parentId: 'type-income',
      });
    });

    it('returns empty array for parent with no sub categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const subs = result.current.getSubCategories('type-transfer');

      expect(subs).toEqual([]);
    });

    it('filters out non-sub level categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      // type-expense has sub-food (sub) and detail-groceries (detail) as children
      const subs = result.current.getSubCategories('type-expense');

      expect(subs).toHaveLength(1);
      expect(subs[0].level).toBe('sub');
    });
  });

  describe('getDetailCategories', () => {
    it('returns detail-level categories for a parent', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const details = result.current.getDetailCategories('sub-food');

      expect(details).toHaveLength(1);
      expect(details[0]).toMatchObject({
        id: 'detail-groceries',
        name: 'Groceries',
        level: 'detail',
        parentId: 'sub-food',
      });
    });

    it('returns empty array for parent with no detail categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const details = result.current.getDetailCategories('type-income');

      expect(details).toEqual([]);
    });

    it('filters out non-detail level categories', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const details = result.current.getDetailCategories('type-expense');

      expect(details).toEqual([]); // type-expense only has sub-level children
    });
  });

  describe('persistence', () => {
    it('saves to localStorage on every change', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      mockLocalStorage.setItem.mockClear();

      // Add
      act(() => {
        result.current.addCategory({ name: 'Test 1', type: 'expense', level: 'sub' });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);

      // Update
      act(() => {
        result.current.updateCategory('mock-uuid-123', { name: 'Test 1 Updated' });
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);

      // Delete
      act(() => {
        result.current.deleteCategory('mock-uuid-123');
      });
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('persists categories across remounts', () => {
      const testCategory = {
        id: 'persist-1',
        name: 'Persistent Category',
        type: 'expense' as const,
        level: 'sub' as const,
      };

      // First mount
      const { result: result1, unmount } = renderHook(() => useCategories(), { wrapper });

      act(() => {
        result1.current.addCategory(testCategory);
      });

      // Unmount
      unmount();

      // Mock localStorage to return saved categories
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'money_management_categories') {
          return JSON.stringify([...getDefaultCategories(), { ...testCategory, id: 'mock-uuid-123' }]);
        }
        return null;
      });

      // Remount
      const { result: result2 } = renderHook(() => useCategories(), { wrapper });

      const found = result2.current.categories.find(c => c.name === 'Persistent Category');
      expect(found).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws error when useCategories is used outside provider', () => {
      expect(() => {
        renderHook(() => useCategories());
      }).toThrow('useCategories must be used within CategoryProvider');
    });

    it('throws when localStorage fails', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      // Set up error after initialization
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should throw when adding category because localStorage.setItem throws
      expect(() => {
        act(() => {
          result.current.addCategory({ name: 'Test', type: 'expense', level: 'sub' });
        });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('complex scenarios', () => {
    it('handles hierarchical category operations', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      // Add a sub-category
      act(() => {
        result.current.addCategory({
          name: 'Utilities',
          type: 'expense',
          level: 'sub',
          parentId: 'type-expense',
        });
      });

      const utilityId = 'mock-uuid-123';

      // Add detail categories under it
      mockUuidV4.mockReturnValueOnce('detail-1');
      act(() => {
        result.current.addCategory({
          name: 'Electricity',
          type: 'expense',
          level: 'detail',
          parentId: utilityId,
        });
      });

      mockUuidV4.mockReturnValueOnce('detail-2');
      act(() => {
        result.current.addCategory({
          name: 'Water',
          type: 'expense',
          level: 'detail',
          parentId: utilityId,
        });
      });

      // Verify hierarchy
      const utilityDetails = result.current.getDetailCategories(utilityId);
      expect(utilityDetails).toHaveLength(2);
      expect(utilityDetails[0].name).toBe('Electricity');
      expect(utilityDetails[1].name).toBe('Water');

      // Verify paths
      expect(result.current.getCategoryPath('detail-1')).toBe('Expense > Utilities > Electricity');
      expect(result.current.getCategoryPath('detail-2')).toBe('Expense > Utilities > Water');
    });

    it('handles category type changes', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      // Add a category
      act(() => {
        result.current.addCategory({
          name: 'Freelance',
          type: 'income',
          level: 'sub',
          parentId: 'type-income',
        });
      });

      // Change its type (which should also update parent)
      act(() => {
        result.current.updateCategory('mock-uuid-123', {
          type: 'expense',
          parentId: 'type-expense',
        });
      });

      const updated = result.current.getCategoryById('mock-uuid-123');
      expect(updated?.type).toBe('expense');
      expect(updated?.parentId).toBe('type-expense');
    });

    it('handles batch operations efficiently', () => {
      const { result } = renderHook(() => useCategories(), { wrapper });

      const newCategories = Array.from({ length: 10 }, (_, i) => ({
        name: `Category ${i}`,
        type: 'expense' as const,
        level: 'sub' as const,
        parentId: 'type-expense',
      }));

      // Add multiple categories
      act(() => {
        newCategories.forEach(cat => {
          result.current.addCategory(cat);
        });
      });

      const expenseSubs = result.current.getSubCategories('type-expense');
      expect(expenseSubs.length).toBeGreaterThanOrEqual(10);
    });
  });
});