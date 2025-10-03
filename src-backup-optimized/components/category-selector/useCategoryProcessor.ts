import { useMemo } from 'react';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface UseCategoryProcessorProps {
  categories: Category[];
  search: string;
  showAll: boolean;
  recentCategories: string[];
  frequentCategories: Map<string, number>;
}

interface CategorySection {
  title: string;
  items: Category[];
}

export function useCategoryProcessor({
  categories,
  search,
  showAll,
  recentCategories,
  frequentCategories
}: UseCategoryProcessorProps) {
  const logger = useLogger();
  
  // Process and sort categories
  const processedCategories = useMemo(() => {
    try {
      let result = [...categories];
      
      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        result = result.filter(cat => 
          cat.name.toLowerCase().includes(searchLower)
        );
      }

      // Sort by frequency and recency if not searching
      if (!search && !showAll) {
        result.sort((a, b) => {
          // Recent categories first
          const aRecent = recentCategories.indexOf(a.id);
          const bRecent = recentCategories.indexOf(b.id);
          if (aRecent !== -1 && bRecent !== -1) {
            return aRecent - bRecent;
          }
          if (aRecent !== -1) return -1;
          if (bRecent !== -1) return 1;
          
          // Then by frequency
          const aFreq = frequentCategories.get(a.id) || 0;
          const bFreq = frequentCategories.get(b.id) || 0;
          if (aFreq !== bFreq) return bFreq - aFreq;
          
          // Finally alphabetically
          return a.name.localeCompare(b.name);
        });
      }

      logger.debug('Categories processed', {
        total: categories.length,
        filtered: result.length,
        hasSearch: !!search,
        showAll
      });

      return result;
    } catch (error) {
      logger.error('Error processing categories:', error);
      return categories;
    }
  }, [categories, search, showAll, recentCategories, frequentCategories]);

  // Separate into sections
  const categorySections = useMemo((): CategorySection[] => {
    if (search || showAll) {
      return [{ title: 'All Categories', items: processedCategories }];
    }

    const sections: CategorySection[] = [];
    const recentItems = processedCategories.filter(cat => 
      recentCategories.includes(cat.id)
    ).slice(0, 5);
    
    const frequentItems = processedCategories.filter(cat => 
      !recentCategories.includes(cat.id) && frequentCategories.get(cat.id)! > 5
    ).slice(0, 5);
    
    const otherItems = processedCategories.filter(cat =>
      !recentCategories.includes(cat.id) && (!frequentCategories.has(cat.id) || frequentCategories.get(cat.id)! <= 5)
    );

    if (recentItems.length > 0) {
      sections.push({ title: 'Recent', items: recentItems });
    }
    if (frequentItems.length > 0) {
      sections.push({ title: 'Frequent', items: frequentItems });
    }
    if (otherItems.length > 0) {
      sections.push({ title: 'All Categories', items: otherItems.slice(0, 10) });
    }

    return sections;
  }, [processedCategories, search, showAll, recentCategories, frequentCategories]);

  return {
    processedCategories,
    categorySections
  };
}
