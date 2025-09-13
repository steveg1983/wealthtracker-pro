import React, { useEffect, memo } from 'react';
import { XIcon } from '../icons';
import type { ImportRuleCondition } from '../../types/importRules';
import { logger } from '../../services/loggingService';

interface ConditionRowProps {
  condition: ImportRuleCondition;
  onChange: (condition: Partial<ImportRuleCondition>) => void;
  onRemove: () => void;
}

const ConditionRow = memo(function ConditionRow({
  condition,
  onChange,
  onRemove
}: ConditionRowProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ConditionRow component initialized', {
      componentName: 'ConditionRow'
    });
  }, []);

  const fields = [
    { value: 'description', label: 'Description' },
    { value: 'amount', label: 'Amount' },
    { value: 'merchant', label: 'Merchant' }
  ];

  const operators = condition.field === 'amount' ? [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' }
  ] : [
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'equals', label: 'Equals' },
    { value: 'matches_regex', label: 'Matches pattern' }
  ];

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <select
        value={condition.field}
        onChange={(e) => onChange({ field: e.target.value as any })}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
      >
        {fields.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as any })}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
      >
        {operators.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <input
        type={condition.field === 'amount' ? 'number' : 'text'}
        value={condition.value}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
        placeholder="Value"
      />

      {condition.operator === 'between' && (
        <input
          type="number"
          value={condition.value2 || ''}
          onChange={(e) => onChange({ value2: e.target.value })}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 w-32"
          placeholder="Max"
        />
      )}

      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
        aria-label="Remove condition"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});

export default ConditionRow;