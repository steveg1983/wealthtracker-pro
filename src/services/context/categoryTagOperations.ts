import { logger } from '../loggingService';
import { getDefaultCategories } from '../../data/defaultCategories';
import type { Category, Transaction, Tag } from '../../types';

export class CategoryOperations {
  static addCategory(
    category: Omit<Category, 'id'>,
    currentCategories: Category[]
  ): Category {
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID()
    };
    logger.debug('[CategoryOps] Category added:', { id: newCategory.id, name: newCategory.name });
    return newCategory;
  }

  static updateCategory(
    id: string,
    updates: Partial<Category>,
    currentCategories: Category[]
  ): Category[] {
    const updated = currentCategories.map(c => 
      c.id === id ? { ...c, ...updates } : c
    );
    logger.debug('[CategoryOps] Category updated:', { id });
    return updated;
  }

  static deleteCategory(
    id: string,
    currentCategories: Category[]
  ): Category[] {
    const filtered = currentCategories.filter(c => c.id !== id && c.parentId !== id);
    logger.debug('[CategoryOps] Category deleted:', { id });
    return filtered;
  }

  static getSubCategories(parentId: string, categories: Category[]): Category[] {
    return categories.filter(c => c.parentId === parentId);
  }

  static getDetailCategories(parentId: string, categories: Category[]): Category[] {
    return categories.filter(c => c.parentId === parentId);
  }

  static getDefaultCategories(): Category[] {
    return getDefaultCategories();
  }
}

export class TagOperations {
  static addTag(
    tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>,
    currentTags: Tag[]
  ): Tag {
    const newTag: Tag = {
      ...tag,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    logger.debug('[TagOps] Tag added:', { id: newTag.id, name: newTag.name });
    return newTag;
  }

  static updateTag(
    id: string,
    updates: Partial<Tag>,
    currentTags: Tag[]
  ): Tag[] {
    const updated = currentTags.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    );
    logger.debug('[TagOps] Tag updated:', { id });
    return updated;
  }

  static deleteTag(id: string, currentTags: Tag[]): Tag[] {
    const filtered = currentTags.filter(t => t.id !== id);
    logger.debug('[TagOps] Tag deleted:', { id });
    return filtered;
  }

  static getTagUsageCount(tagName: string, transactions: Transaction[]): number {
    return transactions.filter(t => t.tags?.includes(tagName) ?? false).length;
  }

  static getAllUsedTags(transactions: Transaction[]): string[] {
    const tagSet = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }
}