import { memo, useEffect } from 'react';
import { LayersIcon, PlusIcon, XIcon } from '../../icons';
import { QueryBuilderService, type QueryAggregation, type FieldOption } from '../../../services/queryBuilderService';
import { useLogger } from '../services/ServiceProvider';

interface AggregationsSectionProps {
  aggregations: QueryAggregation[];
  fields: FieldOption[];
  dataSource: string;
  onAggregationsChange: (aggregations: QueryAggregation[]) => void;
}

/**
 * Aggregations section component
 * Manages aggregation functions for the query
 */
export const AggregationsSection = memo(function AggregationsSection({ aggregations,
  fields,
  dataSource,
  onAggregationsChange
 }: AggregationsSectionProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AggregationsSection component initialized', {
      componentName: 'AggregationsSection'
    });
  }, []);

  const addAggregation = () => {
    const newAggregation = QueryBuilderService.createDefaultAggregation(dataSource as any);
    onAggregationsChange([...aggregations, newAggregation]);
  };

  const updateAggregation = (index: number, updates: Partial<QueryAggregation>) => {
    const newAggregations = [...aggregations];
    const current = newAggregations[index];
    if (!current) return;
    newAggregations[index] = {
      field: current.field,
      function: current.function,
      ...(current.alias ? { alias: current.alias } as any : {}),
      ...updates
    } as QueryAggregation;
    onAggregationsChange(newAggregations);
  };

  const removeAggregation = (index: number) => {
    onAggregationsChange(aggregations.filter((_, i) => i !== index));
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LayersIcon size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Aggregations</h3>
        </div>
        <button
          onClick={addAggregation}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
        >
          <PlusIcon size={16} />
          Add Aggregation
        </button>
      </div>
      <div className="space-y-2">
        {aggregations.map((agg, index) => (
          <AggregationRow
            key={index}
            aggregation={agg}
            fields={fields}
            onUpdate={(updates) => updateAggregation(index, updates)}
            onRemove={() => removeAggregation(index)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * Individual aggregation row component
 */
const AggregationRow = memo(function AggregationRow({
  aggregation,
  fields,
  onUpdate,
  onRemove
}: {
  aggregation: QueryAggregation;
  fields: FieldOption[];
  onUpdate: (updates: Partial<QueryAggregation>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <select
        value={aggregation.function}
        onChange={(e) => onUpdate({ function: e.target.value as QueryAggregation['function'] })}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        {QueryBuilderService.AGGREGATION_OPTIONS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <select
        value={aggregation.field}
        onChange={(e) => onUpdate({ field: e.target.value })}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
      >
        {fields.map(field => (
          <option key={field.value} value={field.value}>{field.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={aggregation.alias || ''}
        onChange={(e) => onUpdate({ alias: e.target.value })}
        className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
        placeholder="Alias (optional)"
      />
      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});
