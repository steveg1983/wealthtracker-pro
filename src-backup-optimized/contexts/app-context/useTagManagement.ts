import { useCallback } from 'react';
import type { Tag } from './types';
import type { DecimalTransaction } from '../../types/decimal-types';

/**
 * Custom hook for tag management operations
 * Handles CRUD operations and tag usage tracking
 */
export function useTagManagement(
  tags: Tag[],
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>,
  decimalTransactions: DecimalTransaction[],
  setDecimalTransactions: React.Dispatch<React.SetStateAction<DecimalTransaction[]>>
) {
  const addTag = useCallback((tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTag: Tag = {
      ...tag,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTags(prev => [...prev, newTag]);
  }, [setTags]);

  const updateTag = useCallback((id: string, updates: Partial<Tag>) => {
    setTags(prev => prev.map(tag => 
      tag.id === id 
        ? { ...tag, ...updates, updatedAt: new Date() }
        : tag
    ));
  }, [setTags]);

  const deleteTag = useCallback((id: string) => {
    const tag = tags.find(t => t.id === id);
    if (tag) {
      // Remove tag from all transactions
      setDecimalTransactions(prev => prev.map(transaction => ({
        ...transaction,
        tags: transaction.tags?.filter(t => t !== tag.name)
      })));
    }
    setTags(prev => prev.filter(t => t.id !== id));
  }, [tags, setTags, setDecimalTransactions]);

  const getTagUsageCount = useCallback((tagName: string): number => {
    return decimalTransactions.filter(t => t.tags?.includes(tagName)).length;
  }, [decimalTransactions]);

  const getAllUsedTags = useCallback((): string[] => {
    const usedTagsSet = new Set<string>();
    decimalTransactions.forEach(transaction => {
      transaction.tags?.forEach(tag => usedTagsSet.add(tag));
    });
    return Array.from(usedTagsSet);
  }, [decimalTransactions]);

  return {
    tags,
    addTag,
    updateTag,
    deleteTag,
    getTagUsageCount,
    getAllUsedTags
  };
}