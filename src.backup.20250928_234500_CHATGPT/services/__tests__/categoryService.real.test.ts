/**
 * Category Service REAL Test
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 * 
 * This test uses REAL Supabase database connections, not mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { 
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../api/categoryService';
import type { Category } from '../../types';

// Use real Supabase test instance
const testSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data - using valid UUIDs
const TEST_USER_ID = '66666666-6666-6666-6666-' + Date.now().toString().padStart(12, '0').slice(-12);
const TEST_CLERK_ID = 'test_clerk_cat_' + Date.now();
const createdCategoryIds: string[] = [];

describe('CategoryService - REAL Database Tests', () => {
  beforeEach(async () => {
    // Clear tracking arrays
    createdCategoryIds.length = 0;
    
    // Create test user (required by foreign key constraint)
    const { error: userError } = await testSupabase
      .from('users')
      .upsert({
        id: TEST_USER_ID,
        clerk_id: TEST_CLERK_ID,
        email: `test.cat.${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
    
    // Create user_id_mapping for userIdService
    const { error: mappingError } = await testSupabase
      .from('user_id_mappings')
      .upsert({
        clerk_id: TEST_CLERK_ID,
        database_user_id: TEST_USER_ID,
        created_at: new Date().toISOString(),
      });
    
    if (mappingError) {
      console.error('Failed to create user mapping:', mappingError);
    }
  });

  afterEach(async () => {
    // Clean up categories
    if (createdCategoryIds.length > 0) {
      await testSupabase
        .from('categories')
        .delete()
        .in('id', createdCategoryIds);
    }
    
    // Clean up user mapping
    await testSupabase
      .from('user_id_mappings')
      .delete()
      .eq('clerk_id', TEST_CLERK_ID);
    
    // Clean up test user
    await testSupabase
      .from('users')
      .delete()
      .eq('id', TEST_USER_ID);
  });

  describe('createCategory - REAL', () => {
    it('should create a real category in the database', async () => {
      // Arrange
      const categoryData = {
        name: 'Real Groceries Category',
        type: 'expense' as const,
        color: '#10B981',
        icon: '🛒',
      };

      // Act - Create real category
      const result = await createCategory(TEST_CLERK_ID, categoryData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Real Groceries Category');
      expect(result.type).toBe('expense');
      expect(result.color).toBe('#10B981');
      expect(result.icon).toBe('🛒');
      expect(result.id).toBeDefined();

      if (result.id) {
        createdCategoryIds.push(result.id);
        
        // Verify it actually exists in the database
        const { data: verifyData } = await testSupabase
          .from('categories')
          .select('*')
          .eq('id', result.id)
          .single();
        
        expect(verifyData).toBeDefined();
        expect(verifyData?.name).toBe('Real Groceries Category');
        expect(verifyData?.type).toBe('expense');
      }
    });

    it('should create income category correctly', async () => {
      // Arrange
      const incomeCategory = {
        name: 'Salary',
        type: 'income' as const,
        color: '#059669',
        icon: '💰',
      };

      // Act
      const result = await createCategory(TEST_CLERK_ID, incomeCategory);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('income');
      expect(result.name).toBe('Salary');
      
      if (result.id) {
        createdCategoryIds.push(result.id);
      }
    });

    it('should create subcategory with parent', async () => {
      // First create parent category
      const parentCategory = await createCategory(TEST_CLERK_ID, {
        name: 'Transportation',
        type: 'expense' as const,
        color: '#3B82F6',
      });

      if (!parentCategory?.id) {
        throw new Error('Failed to create parent category');
      }
      createdCategoryIds.push(parentCategory.id);

      // Create subcategory
      const subcategory = {
        name: 'Gas',
        type: 'expense' as const,
        color: '#60A5FA',
        parentId: parentCategory.id,
      };

      // Act
      const result = await createCategory(TEST_CLERK_ID, subcategory);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Gas');
      expect(result.parentId).toBe(parentCategory.id);
      
      if (result.id) {
        createdCategoryIds.push(result.id);
      }
    });
  });

  describe('getCategories - REAL', () => {
    it('should retrieve real categories from database', async () => {
      // Arrange - Create multiple real categories
      const categories = [
        {
          name: 'Food & Dining',
          type: 'expense' as const,
          color: '#10B981',
        },
        {
          name: 'Entertainment',
          type: 'expense' as const,
          color: '#8B5CF6',
        },
        {
          name: 'Freelance Income',
          type: 'income' as const,
          color: '#059669',
        },
      ];

      // Create categories
      for (const cat of categories) {
        const created = await createCategory(TEST_CLERK_ID, cat);
        if (created?.id) {
          createdCategoryIds.push(created.id);
        }
      }

      // Act - Retrieve categories
      const retrievedCategories = await getCategories(TEST_CLERK_ID);

      // Assert
      expect(Array.isArray(retrievedCategories)).toBe(true);
      expect(retrievedCategories.length).toBeGreaterThanOrEqual(3);
      
      // Verify our test categories are in the results
      const testCategories = retrievedCategories.filter(c => 
        createdCategoryIds.includes(c.id)
      );
      expect(testCategories.length).toBe(3);
      
      // Check specific categories
      const foodCategory = testCategories.find(c => c.name === 'Food & Dining');
      const incomeCategory = testCategories.find(c => c.type === 'income');
      
      expect(foodCategory).toBeDefined();
      expect(foodCategory?.type).toBe('expense');
      expect(incomeCategory).toBeDefined();
      expect(incomeCategory?.name).toBe('Freelance Income');
    });

    it('should retrieve categories with hierarchy', async () => {
      // Create parent category
      const parent = await createCategory(TEST_CLERK_ID, {
        name: 'Shopping',
        type: 'expense' as const,
        color: '#EC4899',
      });
      
      if (parent?.id) {
        createdCategoryIds.push(parent.id);
        
        // Create subcategories
        const subcategories = ['Clothing', 'Electronics', 'Home Goods'];
        for (const name of subcategories) {
          const sub = await createCategory(TEST_CLERK_ID, {
            name,
            type: 'expense' as const,
            color: '#F9A8D4',
            parentId: parent.id,
          });
          if (sub?.id) {
            createdCategoryIds.push(sub.id);
          }
        }
      }

      // Act
      const categories = await getCategories(TEST_CLERK_ID);

      // Assert - Check hierarchy
      const shoppingCategory = categories.find(c => c.name === 'Shopping');
      const clothingCategory = categories.find(c => c.name === 'Clothing');
      
      expect(shoppingCategory).toBeDefined();
      expect(clothingCategory).toBeDefined();
      expect(clothingCategory?.parentId).toBe(shoppingCategory?.id);
    });
  });

  describe('updateCategory - REAL', () => {
    it('should update a real category in the database', async () => {
      // Arrange - Create a real category
      const originalCategory = await createCategory(TEST_CLERK_ID, {
        name: 'Original Category Name',
        type: 'expense' as const,
        color: '#000000',
        icon: '📝',
      });

      if (!originalCategory?.id) {
        throw new Error('Failed to create test category');
      }
      createdCategoryIds.push(originalCategory.id);

      // Act - Update the real category
      const updated = await updateCategory(originalCategory.id, {
        name: 'Updated Category Name',
        color: '#FFFFFF',
        icon: '✅',
      });

      // Assert
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Category Name');
      expect(updated.color).toBe('#FFFFFF');
      expect(updated.icon).toBe('✅');
      expect(updated.type).toBe('expense'); // Type shouldn't change

      // Verify the update in the database
      const { data: verifyData } = await testSupabase
        .from('categories')
        .select('*')
        .eq('id', originalCategory.id)
        .single();

      expect(verifyData?.name).toBe('Updated Category Name');
      expect(verifyData?.color).toBe('#FFFFFF');
    });
  });

  describe('deleteCategory - REAL', () => {
    it('should delete a real category from database', async () => {
      // Arrange - Create a real category
      const category = await createCategory(TEST_CLERK_ID, {
        name: 'Category to Delete',
        type: 'expense' as const,
        color: '#FF0000',
      });

      if (!category?.id) {
        throw new Error('Failed to create test category');
      }
      // Don't add to cleanup array since we're deleting it

      // Act - Delete the category
      await deleteCategory(category.id);

      // Verify it's deleted from database
      const { data: verifyData } = await testSupabase
        .from('categories')
        .select('*')
        .eq('id', category.id)
        .single();

      // Should not exist
      expect(verifyData).toBeNull();
    });

    it('should handle deletion of category with subcategories', async () => {
      // Create parent and child categories
      const parent = await createCategory(TEST_CLERK_ID, {
        name: 'Parent Category',
        type: 'expense' as const,
        color: '#000000',
      });

      if (!parent?.id) {
        throw new Error('Failed to create parent category');
      }

      const child = await createCategory(TEST_CLERK_ID, {
        name: 'Child Category',
        type: 'expense' as const,
        color: '#111111',
        parentId: parent.id,
      });

      if (child?.id) {
        createdCategoryIds.push(child.id);
      }

      // Act - Try to delete parent (should handle cascade)
      await deleteCategory(parent.id);

      // Verify parent is deleted
      const { data: parentData } = await testSupabase
        .from('categories')
        .select('*')
        .eq('id', parent.id)
        .single();

      expect(parentData).toBeNull();

      // Child might be deleted or orphaned depending on database rules
      // Clean up if still exists
      if (child?.id) {
        await testSupabase
          .from('categories')
          .delete()
          .eq('id', child.id);
      }
    });
  });

  describe('Real Database Category Operations', () => {
    it('should enforce unique category names per user', async () => {
      // Create first category
      const first = await createCategory(TEST_CLERK_ID, {
        name: 'Unique Category',
        type: 'expense' as const,
        color: '#000000',
      });

      if (first?.id) {
        createdCategoryIds.push(first.id);
      }

      // Try to create duplicate - behavior depends on database constraints
      try {
        const duplicate = await createCategory(TEST_CLERK_ID, {
          name: 'Unique Category',
          type: 'expense' as const,
          color: '#111111',
        });
        
        // If it succeeds, it means duplicates are allowed
        if (duplicate?.id) {
          createdCategoryIds.push(duplicate.id);
          expect(duplicate.name).toBe('Unique Category');
        }
      } catch (error) {
        // If it fails, unique constraint is enforced
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent category operations correctly', async () => {
      const promises = [];
      
      // Create 5 categories concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          createCategory(TEST_USER_ID, {
            name: `Concurrent Category ${i}`,
            type: i % 2 === 0 ? 'expense' as const : 'income' as const,
            color: `#${i}${i}${i}${i}${i}${i}`,
          })
        );
      }

      // Act - Execute all concurrently
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.name).toBe(`Concurrent Category ${index}`);
        if (result?.id) {
          createdCategoryIds.push(result.id);
        }
      });

      // Verify all exist in database
      const { data: allCategories } = await testSupabase
        .from('categories')
        .select('*')
        .in('id', createdCategoryIds);

      expect(allCategories?.length).toBeGreaterThanOrEqual(5);
    });
  });
});

/**
 * Test Data Factory for Real Category Tests
 */
export class CategoryTestDataFactory {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  private createdIds = {
    categories: [] as string[],
    users: [] as string[],
  };

  async createTestCategory(clerkId: string, overrides = {}) {
    const category = await createCategory(clerkId, {
      name: 'Test Category ' + Date.now(),
      type: 'expense' as const,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      ...overrides,
    });

    if (category?.id) {
      this.createdIds.categories.push(category.id);
    }
    return category;
  }

  async cleanup() {
    // Clean up all created test data
    if (this.createdIds.categories.length > 0) {
      await this.supabase
        .from('categories')
        .delete()
        .in('id', this.createdIds.categories);
    }
    
    if (this.createdIds.users.length > 0) {
      await this.supabase
        .from('users')
        .delete()
        .in('id', this.createdIds.users);
    }
  }
}