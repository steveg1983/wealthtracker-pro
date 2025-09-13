import { memo, useEffect } from 'react';
import { ArrowUpIcon, PlusIcon, XIcon } from '../../icons';
import { QueryBuilderService, type QuerySort, type FieldOption } from '../../../services/queryBuilderService';
import { logger } from '../../../services/loggingService';

interface SortBySectionProps {
  sortBy: QuerySort[];
  fields: FieldOption[];
  dataSource: string;
  onSortByChange: (sortBy: QuerySort[]) => void;
}

/**
 * Sort by section component
 * Manages sorting options for query results
 */
export const SortBySection = memo(function SortBySection({
  sortBy,
  fields,
  dataSource,
  onSortByChange
}: SortBySectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SortBySection component initialized', {
      componentName: 'SortBySection'
    });
  }, []);

  const addSort = () => {
    const newSort = QueryBuilderService.createDefaultSort(dataSource as any);
    onSortByChange([...sortBy, newSort]);
  };

  const updateSort = (index: number, updates: Partial<QuerySort>) => {
    const newSortBy = [...sortBy];
    const current = newSortBy[index];
    if (!current) return;
    newSortBy[index] = { field: current.field, direction: current.direction, ...updates } as QuerySort;
    onSortByChange(newSortBy);
  };

  const removeSort = (index: number) => {
    onSortByChange(sortBy.filter((_, i) => i !== index));
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpIcon size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Sort By</h3>
        </div>
        <button
          onClick={addSort}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
        >
          <PlusIcon size={16} />
          Add Sort
        </button>
      </div>
      <div className="space-y-2">
        {sortBy.map((sort, index) => (
          <SortRow
            key={index}
            sort={sort}
            fields={fields}
            onUpdate={(updates) => updateSort(index, updates)}
            onRemove={() => removeSort(index)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * Individual sort row component
 */
const SortRow = memo(function SortRow({
  sort,
  fields,
  onUpdate,
  onRemove
}: {
  sort: QuerySort;
  fields: FieldOption[];
  onUpdate: (updates: Partial<QuerySort>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <select
        value={sort.field}
        onChange={(e) => onUpdate({ field: e.target.value })}
        className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        {fields.map(field => (
          <option key={field.value} value={field.value}>{field.label}</option>
        ))}
      </select>
      <select
        value={sort.direction}
        onChange={(e) => onUpdate({ direction: e.target.value as 'asc' | 'desc' })}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});
