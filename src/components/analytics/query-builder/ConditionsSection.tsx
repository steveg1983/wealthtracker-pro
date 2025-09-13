import { memo, useEffect } from 'react';
import { FilterIcon, PlusIcon, XIcon } from '../../icons';
import { QueryBuilderService, type QueryCondition, type FieldOption } from '../../../services/queryBuilderService';
import { logger } from '../../../services/loggingService';

interface ConditionsSectionProps {
  conditions: QueryCondition[];
  fields: FieldOption[];
  dataSource: string;
  onConditionsChange: (conditions: QueryCondition[]) => void;
}

/**
 * Conditions section component
 * Manages filter conditions for the query
 */
export const ConditionsSection = memo(function ConditionsSection({
  conditions,
  fields,
  dataSource,
  onConditionsChange
}: ConditionsSectionProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ConditionsSection component initialized', {
      componentName: 'ConditionsSection'
    });
  }, []);

  const addCondition = () => {
    const newCondition = QueryBuilderService.createDefaultCondition(dataSource as any);
    onConditionsChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<QueryCondition>) => {
    const newConditions = [...conditions];
    const current = newConditions[index];
    if (!current) return;
    newConditions[index] = {
      field: current.field,
      operator: current.operator,
      value: current.value,
      ...(current.value2 ? { value2: current.value2 } as any : {}),
      ...updates
    } as QueryCondition;
    onConditionsChange(newConditions);
  };

  const removeCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index));
  };

  const getFieldType = (fieldValue: string) => {
    return QueryBuilderService.getFieldType(dataSource as any, fieldValue);
  };

  const getValidOperators = (fieldValue: string) => {
    return QueryBuilderService.getValidOperators(dataSource as any, fieldValue);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FilterIcon size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
        </div>
        <button
          onClick={addCondition}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
        >
          <PlusIcon size={16} />
          Add Filter
        </button>
      </div>
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            fields={fields}
            validOperators={getValidOperators(condition.field)}
            fieldType={getFieldType(condition.field)}
            onUpdate={(updates) => updateCondition(index, updates)}
            onRemove={() => removeCondition(index)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * Individual condition row component
 */
const ConditionRow = memo(function ConditionRow({
  condition,
  fields,
  validOperators,
  fieldType,
  onUpdate,
  onRemove
}: {
  condition: QueryCondition;
  fields: FieldOption[];
  validOperators: any[];
  fieldType: string;
  onUpdate: (updates: Partial<QueryCondition>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <select
        value={condition.field}
        onChange={(e) => onUpdate({ field: e.target.value })}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        {fields.map(field => (
          <option key={field.value} value={field.value}>{field.label}</option>
        ))}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as QueryCondition['operator'] })}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        {validOperators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <input
        type={fieldType === 'number' ? 'number' : 'text'}
        value={condition.value as string}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
        placeholder="Value"
      />
      {condition.operator === 'between' && (
        <input
          type={fieldType === 'number' ? 'number' : 'text'}
          value={condition.value2 as string || ''}
          onChange={(e) => onUpdate({ value2: e.target.value })}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
          placeholder="To"
        />
      )}
      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});
