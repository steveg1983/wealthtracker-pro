import React from 'react';

interface Category {
  id: string;
  name: string;
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
}

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
  className?: string;
  disabled?: boolean;
  showUncategorized?: boolean;
  showMultiple?: boolean;
  placeholder?: string;
}

export default function CategorySelect({
  value,
  onChange,
  categories,
  className = '',
  disabled = false,
  showUncategorized = true,
  showMultiple = false,
  placeholder = 'Select category'
}: CategorySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      {showUncategorized && <option value="">Uncategorized</option>}
      {showMultiple && <option value="multiple">Multiple</option>}
      {placeholder && !showUncategorized && !value && (
        <option value="" disabled>{placeholder}</option>
      )}
      
      {/* Group by type level categories */}
      {categories
        .filter(cat => cat.level === 'type')
        .map(typeCategory => {
          // Get sub categories for this type
          const subCategories = categories.filter(
            cat => cat.level === 'sub' && cat.parentId === typeCategory.id
          );
          
          if (subCategories.length > 0) {
            // Has subcategories - create optgroups
            return subCategories.map(subCategory => (
              <optgroup key={subCategory.id} label={`${typeCategory.name} > ${subCategory.name}`}>
                {categories
                  .filter(cat => cat.level === 'detail' && cat.parentId === subCategory.id)
                  .map(detail => (
                    <option key={detail.id} value={detail.id}>
                      {detail.name}
                    </option>
                  ))}
              </optgroup>
            ));
          } else {
            // No subcategories - show direct detail categories
            const detailCategories = categories.filter(
              cat => cat.level === 'detail' && cat.parentId === typeCategory.id
            );
            
            if (detailCategories.length > 0) {
              return (
                <optgroup key={typeCategory.id} label={typeCategory.name}>
                  {detailCategories.map(detail => (
                    <option key={detail.id} value={detail.id}>
                      {detail.name}
                    </option>
                  ))}
                </optgroup>
              );
            }
          }
          return null;
        })}
      
      {/* Include any standalone categories */}
      {categories
        .filter(cat => !cat.parentId && cat.level !== 'type')
        .map(cat => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
    </select>
  );
}