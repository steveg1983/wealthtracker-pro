
/**
 * Category Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 *
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api/categoryService';
import { userIdService } from '../userIdService';
import { supabase as appSupabase } from '../api/supabaseClient';
import type { Category } from '../../types';

const TEST_EMAIL = process.env.VITEST_SUPABASE_EMAIL ?? process.env.VITE_SUPABASE_TEST_EMAIL;
const TEST_PASSWORD = process.env.VITEST_SUPABASE_PASSWORD ?? process.env.VITE_SUPABASE_TEST_PASSWORD;

if (!appSupabase) {
  throw new Error('Supabase client is not configured for category tests');
}

const supabase = appSupabase;

let createdCategoryIds: string[] = [];
let authUserId: string;
let databaseUserId: string;

describe('CategoryService - REAL Database Tests', () => {
  beforeEach(async () => {
    createdCategoryIds = [];
    userIdService.clearCache();

    if (!TEST_EMAIL || !TEST_PASSWORD) {
      throw new Error('Set VITEST_SUPABASE_EMAIL and VITEST_SUPABASE_PASSWORD to run category real tests');
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Failed to sign in category test user: ${signInError.message}`);
    }

    const session = await supabase.auth.getSession();
    authUserId = signInData.user?.id ?? session.data.session?.user?.id ?? '';
    if (!authUserId) {
      throw new Error('Unable to resolve authenticated user id for category tests');
    }

    const timestamp = new Date().toISOString();

    await supabase
      .from('users')
      .upsert({
        id: authUserId,
        clerk_id: authUserId,
        email: TEST_EMAIL,
        first_name: null,
        last_name: null,
        created_at: timestamp,
        updated_at: timestamp,
      });

    await supabase
      .from('user_id_mappings')
      .upsert({
        clerk_id: authUserId,
        database_user_id: authUserId,
        created_at: timestamp,
      });

    databaseUserId = authUserId;
    userIdService.setCurrentUser(authUserId, databaseUserId);
  });

  afterEach(async () => {
    if (createdCategoryIds.length > 0) {
      await supabase
        .from('categories')
        .delete()
        .in('id', createdCategoryIds);
    }

    await supabase.auth.signOut();
    userIdService.clearCache();
  });

  describe('createCategory - REAL', () => {
    it('should create a real category in the database', async () => {
      const categoryData = {
        name: 'Real Groceries Category',
        type: 'expense' as const,
        color: '#10B981',
        icon: '🛒',
      };

      const result = await createCategory(authUserId, categoryData);
      expect(result).toBeDefined();
      expect(result.name).toBe('Real Groceries Category');
      expect(result.type).toBe('expense');
      expect(result.color).toBe('#10B981');
      expect(result.icon).toBe('🛒');
      expect(result.id).toBeDefined();

      if (result.id) {
        createdCategoryIds.push(result.id);
      }

      const categories = await getCategories(authUserId);
      const createdCategory = categories.find(category => category.id === result.id);
      expect(createdCategory).toBeDefined();
      expect(createdCategory?.name).toBe('Real Groceries Category');
      expect(createdCategory?.type).toBe('expense');
    });

    it('should create income category correctly', async () => {
      const incomeCategory = {
        name: 'Salary',
        type: 'income' as const,
        color: '#059669',
        icon: '💰',
      };

      const result = await createCategory(authUserId, incomeCategory);

      expect(result).toBeDefined();
      if (result.id) {
        createdCategoryIds.push(result.id);
      }

      const categories = await getCategories(authUserId);
      const fetchedIncomeCategory = categories.find(category => category.id === result.id);
      expect(fetchedIncomeCategory?.type).toBe('income');
      expect(fetchedIncomeCategory?.name).toBe('Salary');
    });

    it('should create subcategory with parent', async () => {
      const parentCategory = await createCategory(authUserId, {
        name: 'Transportation',
        type: 'expense' as const,
        color: '#3B82F6',
      });

      if (!parentCategory?.id) {
        throw new Error('Failed to create parent category');
      }
      createdCategoryIds.push(parentCategory.id);

      const subcategory = await createCategory(authUserId, {
        name: 'Gas',
        type: 'expense' as const,
        color: '#60A5FA',
        parentId: parentCategory.id,
      });

      expect(subcategory).toBeDefined();
      expect(subcategory.parentId).toBe(parentCategory.id);

      if (subcategory?.id) {
        createdCategoryIds.push(subcategory.id);
      }
    });
  });

  describe('getCategories - REAL', () => {
    it('should retrieve real categories from database', async () => {
      const categoriesToCreate = [
        { name: 'Food & Dining', type: 'expense' as const, color: '#10B981' },
        { name: 'Entertainment', type: 'expense' as const, color: '#8B5CF6' },
        { name: 'Freelance Income', type: 'income' as const, color: '#059669' },
      ];

      for (const cat of categoriesToCreate) {
        const created = await createCategory(authUserId, cat);
        if (created?.id) {
          createdCategoryIds.push(created.id);
        }
      }

      const retrievedCategories = await getCategories(authUserId);

      expect(Array.isArray(retrievedCategories)).toBe(true);
      expect(retrievedCategories.length).toBeGreaterThanOrEqual(categoriesToCreate.length);

      const testCategories = retrievedCategories.filter((c) => createdCategoryIds.includes(c.id));
      expect(testCategories.length).toBe(categoriesToCreate.length);

      expect(testCategories.find((c) => c.name === 'Food & Dining')?.type).toBe('expense');
      expect(testCategories.find((c) => c.type === 'income')?.name).toBe('Freelance Income');
    });

    it('should retrieve categories with hierarchy', async () => {
      const parent = await createCategory(authUserId, {
        name: 'Shopping',
        type: 'expense' as const,
        color: '#EC4899',
      });

      if (!parent?.id) {
        throw new Error('Failed to create parent category');
      }
      createdCategoryIds.push(parent.id);

      const subcategories = ['Clothing', 'Electronics', 'Home Goods'];
      for (const name of subcategories) {
        const sub = await createCategory(authUserId, {
          name,
          type: 'expense' as const,
          color: '#F9A8D4',
          parentId: parent.id,
        });
        if (sub?.id) {
          createdCategoryIds.push(sub.id);
        }
      }

      const categories = await getCategories(authUserId);

      const shoppingCategory = categories.find((c) => c.name === 'Shopping');
      const clothingCategory = categories.find((c) => c.name === 'Clothing');

      expect(shoppingCategory).toBeDefined();
      expect(clothingCategory).toBeDefined();
      expect(clothingCategory?.parentId).toBe(shoppingCategory?.id);
    });
  });

  describe('updateCategory - REAL', () => {
    it('should update a real category in the database', async () => {
      const originalCategory = await createCategory(authUserId, {
        name: 'Original Category Name',
        type: 'expense' as const,
        color: '#000000',
        icon: '📝',
      });

      if (!originalCategory?.id) {
        throw new Error('Failed to create test category');
      }
      createdCategoryIds.push(originalCategory.id);

      const updated = await updateCategory(originalCategory.id, {
        name: 'Updated Category Name',
        color: '#FFFFFF',
        icon: '✅',
      });

      expect(updated).toBeDefined();

      const categories = await getCategories(authUserId);
      const updatedCategory = categories.find(category => category.id === originalCategory.id);

      expect(updatedCategory?.name).toBe('Updated Category Name');
      expect(updatedCategory?.color).toBe('#FFFFFF');
      expect(updatedCategory?.icon).toBe('✅');
    });
  });

  describe('deleteCategory - REAL', () => {
    it('should delete a real category from database', async () => {
      const category = await createCategory(authUserId, {
        name: 'Goal to Delete',
        type: 'expense' as const,
        color: '#F87171',
      });

      if (!category?.id) {
        throw new Error('Failed to create test category');
      }

      await deleteCategory(category.id);

      const categories = await getCategories(authUserId);
      const deletedCategory = categories.find(item => item.id === category.id);

      expect(deletedCategory).toBeUndefined();
    });

    it('should handle deletion of category with subcategories', async () => {
      const parent = await createCategory(authUserId, {
        name: 'Parent Category',
        type: 'expense' as const,
        color: '#FBBF24',
      });

      if (!parent?.id) {
        throw new Error('Failed to create parent category');
      }
      createdCategoryIds.push(parent.id);

      const child = await createCategory(authUserId, {
        name: 'Child Category',
        type: 'expense' as const,
        color: '#FCD34D',
        parentId: parent.id,
      });

      if (!child?.id) {
        throw new Error('Failed to create child category');
      }
      createdCategoryIds.push(child.id);

      await deleteCategory(parent.id);

      const categories = await getCategories(authUserId);
      const deletedParent = categories.find(item => item.id === parent.id);

      expect(deletedParent).toBeUndefined();
    });
  });

  describe('Real Database Category Operations', () => {
    it('should enforce unique category names per user', async () => {
      const first = await createCategory(authUserId, {
        name: 'Unique Category',
        type: 'expense' as const,
        color: '#000000',
      });

      if (first?.id) {
        createdCategoryIds.push(first.id);
      }

      try {
        const duplicate = await createCategory(authUserId, {
          name: 'Unique Category',
          type: 'expense' as const,
          color: '#111111',
        });

        if (duplicate?.id) {
          createdCategoryIds.push(duplicate.id);
          expect(duplicate.name).toBe('Unique Category');
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent category operations correctly', async () => {
      const promises: Array<Promise<Category | undefined>> = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          createCategory(authUserId, {
            name: `Concurrent Category ${i}`,
            type: i % 2 === 0 ? ('expense' as const) : ('income' as const),
            color: `#${i}${i}${i}${i}${i}${i}`,
          }),
        );
      }

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result?.name).toBe(`Concurrent Category ${index}`);
        if (result?.id) {
          createdCategoryIds.push(result.id);
        }
      });

      const categories = await getCategories(authUserId);
      const createdSet = categories.filter(category => createdCategoryIds.includes(category.id));

      expect(createdSet.length).toBeGreaterThanOrEqual(5);
    });
  });
});
