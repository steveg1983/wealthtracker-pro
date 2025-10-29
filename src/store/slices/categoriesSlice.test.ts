/**
 * categoriesSlice Tests
 * Redux slice actions and reducers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import categoriesReducer, { addCategory, updateCategory, deleteCategory, setCategories, loadCategories, saveCategories } from './categoriesSlice';
import type { Category } from '../../types';

// Mock storageAdapter
vi.mock('../../services/storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
};

describe('categoriesSlice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        categories: categoriesReducer,
      },
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = store.getState().categories;
    expect(state).toEqual({
      categories: [],
      loading: false,
      error: null,
    });
  });

  it('handles setCategories action', () => {
    const testCategories: Category[] = [
      {
        id: '1',
        name: 'Food & Dining',
        color: '#FF6384',
        icon: 'restaurant',
      },
      {
        id: '2',
        name: 'Transportation',
        color: '#36A2EB',
        icon: 'car',
      },
    ];
    
    store.dispatch(setCategories(testCategories));
    
    const state = store.getState().categories;
    expect(state.categories).toEqual(testCategories);
    expect(state.error).toBeNull();
  });

  it('handles addCategory action', () => {
    const newCategory = {
      name: 'Shopping',
      color: '#4BC0C0',
      icon: 'shopping-bag',
    };
    
    store.dispatch(addCategory(newCategory));
    
    const state = store.getState().categories;
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0]).toMatchObject({
      ...newCategory,
      id: expect.stringContaining('test-uuid-'),
    });
  });

  it('handles updateCategory action', () => {
    // First add a category
    const initialCategory: Category = {
      id: 'cat-1',
      name: 'Entertainment',
      color: '#FFCE56',
      icon: 'music',
    };
    
    store.dispatch(setCategories([initialCategory]));
    
    // Update the category
    store.dispatch(updateCategory({
      id: 'cat-1',
      updates: {
        name: 'Entertainment & Fun',
        color: '#FF9F40',
      },
    }));
    
    const state = store.getState().categories;
    expect(state.categories[0]).toMatchObject({
      ...initialCategory,
      name: 'Entertainment & Fun',
      color: '#FF9F40',
    });
  });

  it('handles deleteCategory action', () => {
    const categories: Category[] = [
      {
        id: 'cat-1',
        name: 'Parent Category',
        color: '#FF6384',
        icon: 'folder',
      },
      {
        id: 'cat-2',
        name: 'Child Category',
        color: '#36A2EB',
        icon: 'file',
        parentId: 'cat-1',
      },
      {
        id: 'cat-3',
        name: 'Another Category',
        color: '#4BC0C0',
        icon: 'star',
      },
    ];
    
    store.dispatch(setCategories(categories));
    store.dispatch(deleteCategory('cat-1'));
    
    const state = store.getState().categories;
    expect(state.categories).toHaveLength(2);
    // Check that the child category no longer has a parent
    const childCategory = state.categories.find((c: Category) => c.id === 'cat-2');
    expect(childCategory?.parentId).toBeUndefined();
  });

  it('handles deleteCategory for subcategories correctly', () => {
    const categories: Category[] = [
      {
        id: 'parent',
        name: 'Parent',
        color: '#000000',
        icon: 'folder',
      },
      {
        id: 'child1',
        name: 'Child 1',
        color: '#111111',
        icon: 'file',
        parentId: 'parent',
      },
      {
        id: 'child2',
        name: 'Child 2',
        color: '#222222',
        icon: 'file',
        parentId: 'parent',
      },
    ];
    
    store.dispatch(setCategories(categories));
    store.dispatch(deleteCategory('parent'));
    
    const state = store.getState().categories;
    expect(state.categories).toHaveLength(2);
    // Both children should have no parent
    state.categories.forEach((cat: Category) => {
      expect(cat.parentId).toBeUndefined();
    });
  });
});
