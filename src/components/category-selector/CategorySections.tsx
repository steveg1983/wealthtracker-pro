import React, { useCallback } from 'react';
import { CategoryItem } from './CategoryItem';
import type { Category } from '../../types';
import { useLogger } from '../services/ServiceProvider';

interface CategorySectionsProps {
  sections: Array<{ title: string; items: Category[] }>;
  onCategorySelect: (categoryId: string) => void;
  recentCategories: string[];
  frequentCategories: Map<string, number>;
}

export function CategorySections({ sections, 
  onCategorySelect, 
  recentCategories, 
  frequentCategories 
 }: CategorySectionsProps): React.JSX.Element {
  const logger = useLogger();
  
  const renderSection = useCallback((section: { title: string; items: Category[] }) => {
    try {
      type SectionItem = { isHeader: true; title: string } | (Category & { isHeader?: false });
      const items: SectionItem[] = [
        { isHeader: true, title: section.title },
        ...section.items
      ];

      return items.map((item, index) => {
        if (item.isHeader) {
          return (
            <div 
              key={`header-${item.title}`} 
              className="px-4 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-sm text-gray-600 dark:text-gray-400 sticky top-0 z-10"
            >
              {item.title}
            </div>
          );
        }
        
        const isRecent = recentCategories.includes(item.id);
        const frequency = frequentCategories.get(item.id) || 0;
        
        return (
          <div key={item.id}>
            <CategoryItem
              category={item}
              isRecent={isRecent}
              frequency={frequency}
              onSelect={onCategorySelect}
            />
          </div>
        );
      });
    } catch (error) {
      logger.error('Error rendering section:', error);
      return null;
    }
  }, [onCategorySelect, recentCategories, frequentCategories]);

  return (
    <div>
      {sections.map((section, idx) => (
        <div key={idx}>
          {renderSection(section)}
        </div>
      ))}
    </div>
  );
}