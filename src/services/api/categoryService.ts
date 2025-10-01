/**
 * Category Service for Supabase Integration
 * Handles category CRUD operations with proper transfer category support
 */

import { supabase } from './supabaseClient';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { userIdService } from '../userIdService';
import { getDefaultCategories } from '../../data/defaultCategories';
import type { Category } from '../../types';
import type { Database } from '../../types/supabase';
import { logger } from '../loggingService';

type CategoriesTable = Database['public']['Tables']['categories'];
type CategoryRow = CategoriesTable['Row'] & {
  is_transfer_category?: boolean | null;
  account_id?: string | null;
};
type CategoryInsert = CategoriesTable['Insert'] & {
  is_transfer_category?: boolean | null;
  account_id?: string | null;
};
type CategoryUpdate = CategoriesTable['Update'] & {
  is_transfer_category?: boolean | null;
  account_id?: string | null;
};

type SupabaseCategoryType = Exclude<CategoryInsert['type'], undefined>;

const SUPABASE_USER_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const looksLikeSupabaseUserId = (value: string | null | undefined): value is string => {
  return typeof value === 'string' && SUPABASE_USER_ID_PATTERN.test(value);
};

const logResolution = (phase: string, context: Record<string, unknown>): void => {
  logger.debug(`[CategoryService] resolveSupabaseUserId ${phase}`, context);
};

const resolveSupabaseUserId = async (
  client: typeof supabase,
  identifier: string
): Promise<string | null> => {
  const resolveFromMapping = async (): Promise<string | null> => {
    const mappedId = await userIdService.getDatabaseUserId(identifier);
    logResolution('mapping', { identifier, mappedId });
    if (looksLikeSupabaseUserId(mappedId)) {
      logResolution('mapping-hit', { identifier, resolvedUserId: mappedId });
      return mappedId;
    }

    if (mappedId) {
      logger.warn('[CategoryService] Resolved user identifier is not a Supabase UUID; ignoring mapped value', {
        identifier,
      });
    }

    return null;
  };

  if (!client) {
    if (looksLikeSupabaseUserId(identifier)) {
      logResolution('no-client-hit', { identifier });
      return identifier;
    }
    logResolution('no-client', { identifier });
    return resolveFromMapping();
  }

  const { data: authUser } = await client.auth.getUser();
  logResolution('auth-check', { identifier, sessionUserId: authUser.user?.id });
  if (authUser.user?.id) {
    logResolution('auth-hit', { identifier, resolvedUserId: authUser.user.id });
    return authUser.user.id;
  }

  if (looksLikeSupabaseUserId(identifier)) {
    logResolution('identifier-hit', { identifier });
    return identifier;
  }

  return resolveFromMapping();
};

const mapSupabaseTypeToDomain = (type: CategoryRow['type']): Category['type'] => {
  if (type === 'income' || type === 'expense') {
    return type;
  }
  return 'both';
};

const mapDomainTypeToSupabase = (
  type: Category['type'] | undefined
): SupabaseCategoryType => {
  if (type === 'income' || type === 'expense') {
    return type;
  }
  // Domain only tracks "both" for shared categories – persist as expense by default
  return 'expense';
};

const mapCategoryRowToDomain = (row: CategoryRow): Category => {
  const category: Category = {
    id: row.id,
    name: row.name,
    type: mapSupabaseTypeToDomain(row.type),
    level: row.level,
    isActive: row.is_active,
  };

  if (row.parent_id) category.parentId = row.parent_id;
  if (row.color) category.color = row.color;
  if (row.icon) category.icon = row.icon;
  if (row.is_system !== undefined) category.isSystem = row.is_system;
  if (row.is_transfer_category !== undefined && row.is_transfer_category !== null) {
    category.isTransferCategory = row.is_transfer_category;
  }
  if (row.account_id) category.accountId = row.account_id;

  return category;
};

const generateCategoryId = (): string => {
  const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `cat-${Math.random().toString(36).slice(2, 10)}`;
};

const normaliseCategory = (raw: Partial<Category>): Category => {
  const id = raw.id ?? generateCategoryId();
  const name = raw.name ?? 'Unnamed Category';
  const level: Category['level'] = raw.level ?? 'detail';
  const type: Category['type'] = ((): Category['type'] => {
    if (raw.type === 'income' || raw.type === 'expense' || raw.type === 'both') {
      return raw.type;
    }
    return 'expense';
  })();

  const category: Category = {
    id,
    name,
    type,
    level,
    isActive: raw.isActive ?? true,
  };

  if (raw.parentId !== undefined) {
    category.parentId = raw.parentId ?? null;
  }
  if (raw.color !== undefined) {
    category.color = raw.color;
  }
  if (raw.icon !== undefined) {
    category.icon = raw.icon;
  }
  if (raw.isSystem !== undefined) {
    category.isSystem = raw.isSystem;
  }
  if (raw.description !== undefined) {
    category.description = raw.description;
  }
  if (raw.isTransferCategory !== undefined) {
    category.isTransferCategory = raw.isTransferCategory;
  }
  if (raw.accountId !== undefined) {
    category.accountId = raw.accountId;
  }

  return category;
};

const buildCategoryInsert = (
  userId: string,
  category: Omit<Category, 'id'>
): CategoryInsert => {
  const insert: CategoryInsert = {
    user_id: userId,
    name: category.name,
    level: category.level ?? 'detail',
    is_active: category.isActive ?? true,
  };

  const mappedType = mapDomainTypeToSupabase(category.type);
  insert.type = mappedType;

  if (category.parentId !== undefined) {
    insert.parent_id = category.parentId ?? null;
  }
  if (category.color !== undefined) {
    insert.color = category.color ?? null;
  }
  if (category.icon !== undefined) {
    insert.icon = category.icon ?? null;
  }
  if (category.isSystem !== undefined) {
    insert.is_system = category.isSystem;
  }
  if (category.isTransferCategory !== undefined) {
    insert.is_transfer_category = category.isTransferCategory ?? null;
  } else {
    insert.is_transfer_category = null;
  }
  if (category.accountId !== undefined) {
    insert.account_id = category.accountId ?? null;
  } else {
    insert.account_id = null;
  }

  return insert;
};

const buildCategoryUpdate = (updates: Partial<Category>): CategoryUpdate => {
  const update: CategoryUpdate = {};
  if (updates.name !== undefined) update.name = updates.name;
  if (updates.type !== undefined) {
    update.type = mapDomainTypeToSupabase(updates.type);
  }
  if (updates.level !== undefined) update.level = updates.level;
  if (updates.parentId !== undefined) update.parent_id = updates.parentId ?? null;
  if (updates.color !== undefined) update.color = updates.color ?? null;
  if (updates.icon !== undefined) update.icon = updates.icon ?? null;
  if (updates.isSystem !== undefined) update.is_system = updates.isSystem;
  if (updates.isTransferCategory !== undefined) {
    update.is_transfer_category = updates.isTransferCategory ?? null;
  }
  if (updates.accountId !== undefined) {
    update.account_id = updates.accountId ?? null;
  }
  if (updates.isActive !== undefined) update.is_active = updates.isActive;
  return update;
};

/**
 * Retrieves all active categories for a specific user
 * @param {string} clerkId - The Clerk authentication ID of the user
 * @returns {Promise<Category[]>} Array of active categories, or defaults if none exist
 * @throws {Error} If Supabase is not configured or database query fails
 * @example
 * const categories = await getCategories('clerk_user_123');
 * // Returns: [{id: 'cat-1', name: 'Food & Dining', type: 'expense', ...}]
 */
export async function getCategories(clerkId: string): Promise<Category[]> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }
    
    const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
    logger.debug('[CategoryService] getCategories resolved user', { clerkId, resolvedUserId });
    if (!resolvedUserId) {
      logger.info('[CategoryService] No user found, returning default categories');
      return getDefaultCategories().map(normaliseCategory);
    }

    // Get all categories for the user (including transfer categories)
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('user_id', resolvedUserId)
      .order('level', { ascending: true })
      .order('name', { ascending: true });
    logger.debug('[CategoryService] getCategories query result', {
      clerkId,
      resolvedUserId,
      rowCount: data?.length ?? 0,
      example: data?.slice(0, 3) ?? []
    });
    
    if (error) {
      logger.error('[CategoryService] Error fetching categories:', error);
      throw error;
    }
    
    // If no categories exist, return defaults
    if (!data || data.length === 0) {
      logger.info('[CategoryService] No categories in database, returning defaults');
      return getDefaultCategories().map(normaliseCategory);
    }
    
    // Transform and filter to only include active categories by default
    const categories = data
      .map(mapCategoryRowToDomain)
      .filter(cat => cat.isActive !== false);
    
    logger.info('[CategoryService] Categories loaded', { categories: categories.length, total: data.length });
    return categories;
    
  } catch (error) {
    logger.error('[CategoryService] Error loading categories, falling back to localStorage:', error);
    
    // Fallback to localStorage
    const stored = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES);
    if (stored && stored.length > 0) {
      return stored
        .map(normaliseCategory)
        .filter(cat => cat.isActive !== false);
    }
    
    // Return default categories as last resort
    return getDefaultCategories().map(normaliseCategory);
  }
}

/**
 * Creates default categories for a new user during onboarding
 * @param {string} userId - The database UUID of the user
 * @returns {Promise<void>} Resolves when categories are created successfully
 * @throws {Error} If category creation fails
 * @description Initializes a standard set of expense and income categories for new users
 * @example
 * await createDefaultCategoriesForUser('uuid-123-456');
 */
export async function createDefaultCategoriesForUser(userId: string): Promise<void> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }
    
    const defaultCategories = getDefaultCategories().map(normaliseCategory);

    // Transform categories for database insertion
    const categoriesToInsert = defaultCategories.map(cat => {
      const { id: _omit, ...rest } = cat;
      return buildCategoryInsert(userId, rest);
    });
    
    // Insert in batches to handle parent-child relationships
    // First, insert type-level categories
    const typeLevelCats = categoriesToInsert.filter(cat => cat.level === 'type');
    const { error: typeError } = await client
      .from('categories')
      .insert(typeLevelCats);
    
    if (typeError) {
      logger.error('[CategoryService] Error creating type categories:', typeError);
      return;
    }
    
    // Get the inserted type categories to map IDs
    const { data: insertedTypes } = await client
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
      const { error: remainingError } = await client
        .from('categories')
        .insert(remainingCats);
      
      if (remainingError) {
        logger.error('[CategoryService] Error creating remaining categories:', remainingError);
      }
    }
    
    logger.info('[CategoryService] Default categories created for user', { userId });
    
  } catch (error) {
    logger.error('[CategoryService] Error creating default categories:', error);
  }
}

/**
 * Create a category
 */
export async function createCategory(clerkId: string, category: Omit<Category, 'id'>): Promise<Category> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }
    
    const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
    logger.debug('[CategoryService] createCategory resolved user', { clerkId, resolvedUserId });
    if (!resolvedUserId) {
      throw new Error('User not found');
    }

    const insertPayload = buildCategoryInsert(resolvedUserId, category);
    logger.debug('[CategoryService] createCategory insert payload', insertPayload);

    const { data, error } = await client
      .from('categories')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    logger.debug('[CategoryService] createCategory insert response', data);
    return mapCategoryRowToDomain(data);

  } catch (error) {
    logger.error('[CategoryService] Error creating category:', error);

    // Fallback to localStorage
    const newCategory: Category = normaliseCategory({
      ...category,
      id: generateCategoryId()
    });

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
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }

    const updateData = buildCategoryUpdate(updates);

    const { data, error } = await client
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return mapCategoryRowToDomain(data);

  } catch (error) {
    logger.error('[CategoryService] Error updating category:', error);

    const categories = await storageAdapter.get<Category[]>(STORAGE_KEYS.CATEGORIES) || [];
    const index = categories.findIndex(c => c.id === categoryId);

    if (index !== -1) {
      const existing = categories[index];
      if (!existing) {
        throw new Error('Category not found');
      }

      const merged = normaliseCategory({
        ...existing,
        ...updates,
        id: existing.id,
      });
      categories[index] = merged;
      await storageAdapter.set(STORAGE_KEYS.CATEGORIES, categories);
      return merged;
    }

    throw new Error('Category not found');
  }
}

/**
 * Delete a category (soft delete if it's a transfer category)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    const client = supabase;
    if (!client) {
      throw new Error('Supabase not configured');
    }
    
    // Check if this is a transfer category
    const { data: category } = await client
      .from('categories')
      .select('is_transfer_category')
      .eq('id', categoryId)
      .single();
    
    if (category?.is_transfer_category) {
      // Soft delete transfer categories
      await updateCategory(categoryId, { isActive: false });
    } else {
      // Hard delete regular categories
      const { error } = await client
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
