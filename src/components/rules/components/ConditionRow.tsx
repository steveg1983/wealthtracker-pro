/**
 * Condition Row Component
 * Renders a single rule condition editor
 */

import React, { useEffect, memo } from 'react';
import { XIcon } from '../../icons';
import { ruleEditorService } from '../../../services/ruleEditorService';
import type { ImportRuleCondition } from '../../../types/importRules';
import { useLogger } from '../services/ServiceProvider';

interface ConditionRowProps {
  condition: ImportRuleCondition;
  onChange: (condition: Partial<ImportRuleCondition>) => void;
  onRemove: () => void;
}

export const ConditionRow = memo(function ConditionRow({ condition,
  onChange,
  onRemove
 }: ConditionRowProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ConditionRow component initialized', {
      componentName: 'ConditionRow'
    });
  }, []);

  const fields = ruleEditorService.getConditionFields();
  const operators = ruleEditorService.getOperatorsForField(condition.field);
  const inputType = ruleEditorService.getInputTypeForField(condition.field);
  const showSecondValue = ruleEditorService.requiresSecondValue(condition.operator);

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
        type={inputType}
        value={condition.value}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
        placeholder="Value"
      />

      {showSecondValue && (
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
      >
        <XIcon size={16} />
      </button>
    </div>
  );
});