/**
 * Category Service for Supabase Integration
 * Handles category CRUD operations with proper transfer category support
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import { getDefaultCategories } from '../../data/defaultCategories';
import type { Category } from '../../types';
import { logger } from '../loggingService';

/**
 * Transform database snake_case to TypeScript camelCase
 */
function transformCategoryFromDb(dbCategory: any): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    type: dbCategory.type,
    level: dbCategory.level,
    parentId: dbCategory.parent_id,
    color: dbCategory.color,
    icon: dbCategory.icon,
    isSystem: dbCategory.is_system,
    isTransferCategory: dbCategory.is_transfer_category,
    accountId: dbCategory.account_id,
    isActive: dbCategory.is_active !== false // Default to true if not set
  };
}

/**
 * Get all categories for a user
 */
export async function getCategories(clerkId: string): Promise<Category[]> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Convert Clerk ID to database UUID
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      console.log('[CategoryService] No user found, returning default categories');
      return getDefaultCategories();
    }
    
    // Get all categories for the user (including transfer categories)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('level', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) {
      logger.error('[CategoryService] Error fetching categories:', error);
      throw error;
    }
    
    // If no categories exist, return defaults
    if (!data || data.length === 0) {
      console.log('[CategoryService] No categories in database, returning defaults');
      return getDefaultCategories();
    }
    
    // Transform and filter to only include active categories by default
    const categories = data
      .map(transformCategoryFromDb)
      .filter(cat => cat.isActive !== false);
    
    console.log(`[CategoryService] Loaded ${categories.length} categories (${data.length} total)`);
    return categories;
    
  } catch (error) {
    logger.error('[CategoryService] Error loading categories, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES);
    if (stored && stored.length > 0) {
      // Filter out inactive categories
      return stored.filter(cat => cat.isActive !== false);
    }
    
    // Return default categories as last resort
    return getDefaultCategories();
  }
}

/**
 * Create default categories for a new user
 */
export async function createDefaultCategoriesForUser(userId: string): Promise<void> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const defaultCategories = getDefaultCategories();
    
    // Transform categories for database insertion
    const categoriesToInsert = defaultCategories.map(cat => ({
      user_id: userId,
      name: cat.name,
      type: cat.type,
      level: cat.level,
      parent_id: cat.parentId || null,
      color: cat.color || null,
      icon: cat.icon || null,
      is_system: cat.isSystem || false,
      is_transfer_category: false,
      account_id: null,
      is_active: true
    }));
    
    // Insert in batches to handle parent-child relationships
    // First, insert type-level categories
    const typeLevelCats = categoriesToInsert.filter(cat => cat.level === 'type');
    const { error: typeError } = await supabase
      .from('categories')
      .insert(typeLevelCats);
    
    if (typeError) {
      logger.error('[CategoryService] Error creating type categories:', typeError);
      return;
    }
    
    // Get the inserted type categories to map IDs
    const { data: insertedTypes } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('level', 'type');
    
    if (!insertedTypes) return;
    
    // Create a mapping of old IDs to new IDs
    const idMapping: Record<string, string> = {};
    insertedTypes.forEach(cat => {
      const original = defaultCategories.find(dc => dc.name === cat.name && dc.level === 'type');
      if (original) {
        idMapping[original.id] = cat.id;
      }
    });
    
    // Update parent IDs for sub and detail categories
    const remainingCats = categoriesToInsert
      .filter(cat => cat.level !== 'type')
      .map(cat => ({
        ...cat,
        parent_id: cat.parent_id ? idMapping[cat.parent_id] || cat.parent_id : null
      }));
    
    // Insert remaining categories
    if (remainingCats.length > 0) {
      const { error: remainingError } = await supabase
        .from('categories')
        .insert(remainingCats);
      
      if (remainingError) {
        logger.error('[CategoryService] Error creating remaining categories:', remainingError);
      }
    }
    
    console.log('[CategoryService] Default categories created for user:', userId);
    
  } catch (error) {
    logger.error('[CategoryService] Error creating default categories:', error);
  }
}

/**
 * Create a category
 */
export async function createCategory(clerkId: string, category: Omit<Category, 'id'>): Promise<Category> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const userId = await userIdService.getDatabaseUserId(clerkId);
    if (!userId) {
      throw new Error('User not found');
    }
    
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: category.name,
        type: category.type,
        level: category.level,
        parent_id: category.parentId || null,
        color: category.color || null,
        icon: category.icon || null,
        is_system: category.isSystem || false,
        is_transfer_category: category.isTransferCategory || false,
        account_id: category.accountId || null,
        is_active: category.isActive !== false
      })
      .select()
      .single();
    
    if (error) throw error;
    return transformCategoryFromDb(data);
    
  } catch (error) {
    logger.error('[CategoryService] Error creating category:', error);
    
    // Fallback to localStorage
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID()
    };
    
    const categories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
    categories.push(newCategory);
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);
    
    return newCategory;
  }
}

/**
 * Update a category
 */
export async function updateCategory(categoryId: string, updates: Partial<Category>): Promise<Category> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.parentId !== undefined) updateData.parent_id = updates.parentId;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.isSystem !== undefined) updateData.is_system = updates.isSystem;
    if (updates.isTransferCategory !== undefined) updateData.is_transfer_category = updates.isTransferCategory;
    if (updates.accountId !== undefined) updateData.account_id = updates.accountId;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    
    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();
    
    if (error) throw error;
    return transformCategoryFromDb(data);
    
  } catch (error) {
    logger.error('[CategoryService] Error updating category:', error);
    
    // Fallback to localStorage
    const categories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
    const index = categories.findIndex(c => c.id === categoryId);
    
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      await storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);
      return categories[index];
    }
    
    throw new Error('Category not found');
  }
}

/**
 * Delete a category (soft delete if it's a transfer category)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Check if this is a transfer category
    const { data: category } = await supabase
      .from('categories')
      .select('is_transfer_category')
      .eq('id', categoryId)
      .single();
    
    if (category?.is_transfer_category) {
      // Soft delete transfer categories
      await updateCategory(categoryId, { isActive: false });
    } else {
      // Hard delete regular categories
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      
      if (error) throw error;
    }
    
  } catch (error) {
    logger.error('[CategoryService] Error deleting category:', error);
    
    // Fallback to localStorage
    const categories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
    const filtered = categories.filter(c => c.id !== categoryId);
    await storageAdapter.set(STORAGE_KEYS.CATEGORIES, filtered);
  }
}

export default {
  getCategories,
  createDefaultCategoriesForUser,
  createCategory,
  updateCategory,
  deleteCategory
};