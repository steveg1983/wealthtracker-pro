import { memo, useEffect } from 'react';
import type { FieldOption } from '../../../services/queryBuilderService';
import { useLogger } from '../services/ServiceProvider';

interface GroupBySectionProps {
  groupBy: string[];
  fields: FieldOption[];
  onGroupByChange: (groupBy: string[]) => void;
}

/**
 * Group by section component
 * Manages field grouping for aggregations
 */
export const GroupBySection = memo(function GroupBySection({ groupBy,
  fields,
  onGroupByChange
 }: GroupBySectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('GroupBySection component initialized', {
      componentName: 'GroupBySection'
    });
  }, []);

  const toggleField = (fieldValue: string) => {
    if (groupBy.includes(fieldValue)) {
      onGroupByChange(groupBy.filter(f => f !== fieldValue));
    } else {
      onGroupByChange([...groupBy, fieldValue]);
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Group By
      </label>
      <div className="flex flex-wrap gap-2">
        {fields.map(field => (
          <button
            key={field.value}
            onClick={() => toggleField(field.value)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              groupBy.includes(field.value)
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {field.label}
          </button>
        ))}
      </div>
    </div>
  );
});